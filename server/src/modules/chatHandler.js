import { randomUUID } from "node:crypto";
import { getRoomMessages, saveMessage } from "./db.js";
import { isMemberInRoom } from "./roomStore.js";

export function registerChatHandler(io, socket) {
  socket.on("chat:send", async ({ roomId, text }) => {
    try {
      const trimmed = String(text || "").trim();
      if (!trimmed) return;
      if (!isMemberInRoom(roomId, socket.id)) return;
      if (!socket.data.user) return;

      const sentAt = new Date().toISOString();

      const message = {
        id: randomUUID(),
        roomId,
        text: trimmed,
        userName: socket.data.user.username,
        senderId: socket.id,
        sentAt
      };

      await saveMessage(roomId, socket.data.user.id, trimmed, sentAt);
      io.to(roomId).emit("chat:message", message);
    } catch (_err) {
      socket.emit("chat:error", { error: "Failed to send message." });
    }
  });

  socket.on("chat:history:request", async ({ roomId }) => {
    try {
      if (!isMemberInRoom(roomId, socket.id)) return;

      const history = (await getRoomMessages(roomId, 200)).map((msg) => ({
        id: msg.id,
        roomId: msg.roomId,
        text: msg.text,
        userName: msg.userName,
        sentAt: msg.sentAt
      }));

      socket.emit("chat:history", history);
    } catch (_err) {
      socket.emit("chat:error", { error: "Failed to load chat history." });
    }
  });
}
