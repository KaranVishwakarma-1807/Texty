import { isMemberInRoom } from "./roomStore.js";

function canRelay(roomId, fromSocketId, targetSocketId) {
  return isMemberInRoom(roomId, fromSocketId) && isMemberInRoom(roomId, targetSocketId);
}

export function registerVideoCallHandler(io, socket) {
  socket.on("video:offer", ({ roomId, targetSocketId, sdp }) => {
    if (!canRelay(roomId, socket.id, targetSocketId)) return;
    if (!socket.data.user) return;
    io.to(targetSocketId).emit("video:offer", {
      roomId,
      targetSocketId,
      callerSocketId: socket.id,
      callerName: socket.data.user.username,
      sdp
    });
  });

  socket.on("video:answer", ({ roomId, targetSocketId, sdp }) => {
    if (!canRelay(roomId, socket.id, targetSocketId)) return;
    io.to(targetSocketId).emit("video:answer", {
      roomId,
      fromSocketId: socket.id,
      sdp
    });
  });

  socket.on("video:ice-candidate", ({ roomId, targetSocketId, candidate }) => {
    if (!canRelay(roomId, socket.id, targetSocketId)) return;
    io.to(targetSocketId).emit("video:ice-candidate", {
      roomId,
      fromSocketId: socket.id,
      candidate
    });
  });

  socket.on("video:hangup", ({ roomId, targetSocketId }) => {
    if (!canRelay(roomId, socket.id, targetSocketId)) return;
    io.to(targetSocketId).emit("video:hangup", {
      roomId,
      fromSocketId: socket.id
    });
  });
}
