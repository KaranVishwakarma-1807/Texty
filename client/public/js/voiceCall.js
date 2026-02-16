const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export function createVoiceCallModule({ socket, state, elements }) {
  const { voiceStatus, voiceRemoteAudio, targetSelect, voiceCallBtn, voiceHangupBtn } = elements;

  let peerConnection = null;
  let localStream = null;
  let activePeerId = null;

  function setStatus(text) {
    voiceStatus.textContent = text;
  }

  async function setupPeer(targetSocketId) {
    peerConnection = new RTCPeerConnection(RTC_CONFIG);
    activePeerId = targetSocketId;

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit("voice:ice-candidate", {
        roomId: state.roomId,
        targetSocketId: activePeerId,
        candidate: event.candidate
      });
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      voiceRemoteAudio.srcObject = stream;
    };

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
  }

  async function startVoiceCall() {
    if (!state.roomId) return;
    const targetSocketId = targetSelect.value;
    if (!targetSocketId) return;
    if (targetSocketId === state.selfSocketId) return;

    await setupPeer(targetSocketId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("voice:offer", {
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
    voiceRemoteAudio.srcObject = null;
    activePeerId = null;
    setStatus("Idle");
  }

  function hangupVoiceCall() {
    if (activePeerId) {
      socket.emit("voice:hangup", {
        roomId: state.roomId,
        targetSocketId: activePeerId
      });
    }
    cleanupCall();
  }

  voiceCallBtn.addEventListener("click", async () => {
    try {
      await startVoiceCall();
    } catch (err) {
      console.error(err);
      cleanupCall();
      setStatus("Voice call error");
    }
  });

  voiceHangupBtn.addEventListener("click", hangupVoiceCall);

  socket.on("voice:offer", async ({ callerSocketId, callerName, sdp }) => {
    if (!state.roomId) return;
    const accepted = window.confirm(`${callerName || "Someone"} is calling you (voice). Accept?`);
    if (!accepted) return;
    await setupPeer(callerSocketId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("voice:answer", {
      roomId: state.roomId,
      targetSocketId: callerSocketId,
      sdp: answer
    });
    setStatus("Connected");
  });

  socket.on("voice:answer", async ({ sdp }) => {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    setStatus("Connected");
  });

  socket.on("voice:ice-candidate", async ({ candidate }) => {
    if (!peerConnection || !candidate) return;
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on("voice:hangup", () => {
    cleanupCall();
  });

  return {
    endCall: cleanupCall
  };
}
