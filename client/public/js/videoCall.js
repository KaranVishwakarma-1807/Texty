const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export function createVideoCallModule({ socket, state, elements }) {
  const { targetSelect, localVideo, remoteVideo, videoStatus, videoCallBtn, videoHangupBtn } = elements;

  let peerConnection = null;
  let localStream = null;
  let activePeerId = null;

  function setStatus(text) {
    videoStatus.textContent = text;
  }

  async function setupPeer(targetSocketId) {
    peerConnection = new RTCPeerConnection(RTC_CONFIG);
    activePeerId = targetSocketId;

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit("video:ice-candidate", {
        roomId: state.roomId,
        targetSocketId: activePeerId,
        candidate: event.candidate
      });
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      remoteVideo.srcObject = stream;
    };

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
  }

  async function startVideoCall() {
    if (!state.roomId) return;
    const targetSocketId = targetSelect.value;
    if (!targetSocketId || targetSocketId === state.selfSocketId) return;

    await setupPeer(targetSocketId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("video:offer", {
      roomId: state.roomId,
      targetSocketId,
      sdp: offer
    });

    setStatus("Calling...");
  }

  function cleanupCall() {
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.close();
      peerConnection = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    activePeerId = null;
    setStatus("Idle");
  }

  function hangupVideoCall() {
    if (activePeerId) {
      socket.emit("video:hangup", {
        roomId: state.roomId,
        targetSocketId: activePeerId
      });
    }
    cleanupCall();
  }

  videoCallBtn.addEventListener("click", async () => {
    try {
      await startVideoCall();
    } catch (err) {
      console.error(err);
      cleanupCall();
      setStatus("Video call error");
    }
  });

  videoHangupBtn.addEventListener("click", hangupVideoCall);

  socket.on("video:offer", async ({ callerSocketId, callerName, sdp }) => {
    if (!state.roomId) return;
    const accepted = window.confirm(`${callerName || "Someone"} is calling you (video). Accept?`);
    if (!accepted) return;
    await setupPeer(callerSocketId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("video:answer", {
      roomId: state.roomId,
      targetSocketId: callerSocketId,
      sdp: answer
    });
    setStatus("Connected");
  });

  socket.on("video:answer", async ({ sdp }) => {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    setStatus("Connected");
  });

  socket.on("video:ice-candidate", async ({ candidate }) => {
    if (!peerConnection || !candidate) return;
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on("video:hangup", () => {
    cleanupCall();
  });

  return {
    endCall: cleanupCall
  };
}
