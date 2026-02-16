import "dotenv/config";
import express from "express";
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import authRoutes from "./routes/authRoutes.js";
import { ensureMembership, ensureRoom, findUserById, initializeDatabase } from "./modules/db.js";
import { parseBearerToken, verifyAuthToken } from "./modules/authService.js";
import { registerChatHandler } from "./modules/chatHandler.js";
import { registerVoiceCallHandler } from "./modules/voiceCallHandler.js";
import { registerVideoCallHandler } from "./modules/videoCallHandler.js";
import { getRoomMembers, joinRoom, leaveAllRooms } from "./modules/roomStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const publicPath = path.resolve(__dirname, "../../client/public");
app.use(express.json());
app.use(express.static(publicPath));
app.use("/api/auth", authRoutes);

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "Texty" });
});

io.use(async (socket, next) => {
  const handshakeToken = socket.handshake.auth?.token;
  const authHeaderToken = parseBearerToken(socket.handshake.headers?.authorization);
  const token = handshakeToken || authHeaderToken;

  const payload = verifyAuthToken(token);
  if (!payload?.sub) {
    next(new Error("Unauthorized"));
    return;
  }

  try {
    const user = await findUserById(Number(payload.sub));
    if (!user) {
      next(new Error("Unauthorized"));
      return;
    }

    socket.data.user = {
      id: Number(user.id),
      username: user.username
    };

    next();
  } catch (_err) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.on("room:join", async ({ roomId }) => {
    try {
      if (!socket.data.user) return;

      const safeRoomId = String(roomId || "general").trim().slice(0, 40) || "general";
      const safeUserName = socket.data.user.username;

      const departed = leaveAllRooms(socket.id);
      for (const { roomId: departedRoomId, user } of departed) {
        socket.leave(departedRoomId);
        io.to(departedRoomId).emit("room:users", getRoomMembers(departedRoomId));
        io.to(departedRoomId).emit("room:system", {
          id: randomUUID(),
          text: `${user.userName} left ${departedRoomId}`,
          sentAt: new Date().toISOString()
        });
      }

      socket.join(safeRoomId);
      joinRoom(safeRoomId, {
        socketId: socket.id,
        userId: socket.data.user.id,
        userName: safeUserName
      });
      const room = await ensureRoom(safeRoomId);
      await ensureMembership(socket.data.user.id, Number(room.id));

      socket.emit("room:joined", {
        roomId: safeRoomId,
        socketId: socket.id,
        userName: safeUserName
      });

      io.to(safeRoomId).emit("room:users", getRoomMembers(safeRoomId));
      io.to(safeRoomId).emit("room:system", {
        id: randomUUID(),
        text: `${safeUserName} joined ${safeRoomId}`,
        sentAt: new Date().toISOString()
      });
    } catch (_err) {
      socket.emit("room:error", { error: "Failed to join room." });
    }
  });

  registerChatHandler(io, socket);
  registerVoiceCallHandler(io, socket);
  registerVideoCallHandler(io, socket);

  socket.on("disconnect", () => {
    const updates = leaveAllRooms(socket.id);

    for (const { roomId, user } of updates) {
      io.to(roomId).emit("room:users", getRoomMembers(roomId));
      io.to(roomId).emit("room:system", {
        id: randomUUID(),
        text: `${user.userName} left ${roomId}`,
        sentAt: new Date().toISOString()
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initializeDatabase();
    server.listen(PORT, () => {
      console.log(`Texty running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }
}

startServer();
