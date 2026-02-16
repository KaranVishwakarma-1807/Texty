import { isMemberInRoom } from "./roomStore.js";

function canRelay(roomId, fromSocketId, targetSocketId) {
  return isMemberInRoom(roomId, fromSocketId) && isMemberInRoom(roomId, targetSocketId);
}

export function registerVoiceCallHandler(io, socket) {
  socket.on("voice:offer", ({ roomId, targetSocketId, sdp }) => {
    if (!canRelay(roomId, socket.id, targetSocketId)) return;
    if (!socket.data.user) return;
    io.to(targetSocketId).emit("voice:offer", {
      roomId,
      targetSocketId,
      callerSocketId: socket.id,
      callerName: socket.data.user.username,
      sdp
    });
  });

  socket.on("voice:answer", ({ roomId, targetSocketId, sdp }) => {
    if (!canRelay(roomId, socket.id, targetSocketId)) return;
    io.to(targetSocketId).emit("voice:answer", {
      roomId,
      fromSocketId: socket.id,
      sdp
    });
  });

  socket.on("voice:ice-candidate", ({ roomId, targetSocketId, candidate }) => {
    if (!canRelay(roomId, socket.id, targetSocketId)) return;
    io.to(targetSocketId).emit("voice:ice-candidate", {
      roomId,
      fromSocketId: socket.id,
      candidate
    });
  });

  socket.on("voice:hangup", ({ roomId, targetSocketId }) => {
    if (!canRelay(roomId, socket.id, targetSocketId)) return;
    io.to(targetSocketId).emit("voice:hangup", {
      roomId,
      fromSocketId: socket.id
    });
  });
}
