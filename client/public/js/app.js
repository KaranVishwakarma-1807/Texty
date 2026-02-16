import { createChatModule } from "./chat.js";
import { createVoiceCallModule } from "./voiceCall.js";
import { createVideoCallModule } from "./videoCall.js";

const state = {
  roomId: "",
  userName: "",
  token: localStorage.getItem("texty_token") || "",
  selfSocketId: "",
  participants: []
};

const socket = io({
  autoConnect: false,
  auth: (cb) => cb({ token: state.token })
});

const elements = {
  nameInput: document.getElementById("nameInput"),
  passwordInput: document.getElementById("passwordInput"),
  registerBtn: document.getElementById("registerBtn"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  authStatus: document.getElementById("authStatus"),
  roomInput: document.getElementById("roomInput"),
  joinBtn: document.getElementById("joinBtn"),
  participantsList: document.getElementById("participantsList"),
  currentRoomLabel: document.getElementById("currentRoomLabel"),
  statusBadge: document.getElementById("statusBadge"),
  messages: document.getElementById("messages"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  targetSelect: document.getElementById("targetSelect"),
  voiceStatus: document.getElementById("voiceStatus"),
  voiceRemoteAudio: document.getElementById("voiceRemoteAudio"),
  voiceCallBtn: document.getElementById("voiceCallBtn"),
  voiceHangupBtn: document.getElementById("voiceHangupBtn"),
  videoStatus: document.getElementById("videoStatus"),
  localVideo: document.getElementById("localVideo"),
  remoteVideo: document.getElementById("remoteVideo"),
  videoCallBtn: document.getElementById("videoCallBtn"),
  videoHangupBtn: document.getElementById("videoHangupBtn")
};

const chat = createChatModule({ socket, state, elements });
const voiceCall = createVoiceCallModule({ socket, state, elements });
const videoCall = createVideoCallModule({ socket, state, elements });

function setConnectionState(connected) {
  elements.statusBadge.textContent = connected ? "Connected" : "Disconnected";
}

function setAuthStatus(text) {
  elements.authStatus.textContent = text;
}

function setToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem("texty_token", token);
  } else {
    localStorage.removeItem("texty_token");
  }
}

async function authRequest(endpoint, payload) {
  const response = await fetch(`/api/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Authentication failed");
  }
  return data;
}

async function fetchCurrentUser() {
  if (!state.token) return null;

  const response = await fetch("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${state.token}`
    }
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.user || null;
}

function syncParticipantsUI() {
  const people = state.participants;

  elements.participantsList.innerHTML = "";
  elements.targetSelect.innerHTML = "";

  people.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = `${user.userName}${user.socketId === state.selfSocketId ? " (you)" : ""}`;
    elements.participantsList.appendChild(li);

    if (user.socketId !== state.selfSocketId) {
      const option = document.createElement("option");
      option.value = user.socketId;
      option.textContent = user.userName;
      elements.targetSelect.appendChild(option);
    }
  });
}

function connectSocketIfNeeded() {
  if (!state.token) return;
  if (socket.connected) return;
  socket.connect();
}

function resetSessionUi() {
  state.roomId = "";
  state.selfSocketId = "";
  state.participants = [];
  elements.currentRoomLabel.textContent = "Room: -";
  elements.messages.innerHTML = "";
  syncParticipantsUI();
  voiceCall.endCall();
  videoCall.endCall();
}

elements.registerBtn.addEventListener("click", async () => {
  try {
    const username = elements.nameInput.value.trim();
    const password = elements.passwordInput.value;
    const data = await authRequest("register", { username, password });
    setToken(data.token);
    state.userName = data.user.username;
    setAuthStatus(`Logged in as @${state.userName}`);
    connectSocketIfNeeded();
  } catch (err) {
    window.alert(err.message);
  }
});

elements.loginBtn.addEventListener("click", async () => {
  try {
    const username = elements.nameInput.value.trim();
    const password = elements.passwordInput.value;
    const data = await authRequest("login", { username, password });
    setToken(data.token);
    state.userName = data.user.username;
    setAuthStatus(`Logged in as @${state.userName}`);
    connectSocketIfNeeded();
  } catch (err) {
    window.alert(err.message);
  }
});

elements.logoutBtn.addEventListener("click", () => {
  setToken("");
  state.userName = "";
  setAuthStatus("Not logged in");
  resetSessionUi();
  socket.disconnect();
});

elements.joinBtn.addEventListener("click", () => {
  const roomId = elements.roomInput.value.trim() || "general";
  if (!state.token || !state.userName) {
    window.alert("Please login first.");
    return;
  }

  connectSocketIfNeeded();
  state.roomId = roomId;
  socket.emit("room:join", { roomId });
});

socket.on("connect", () => setConnectionState(true));
socket.on("disconnect", () => setConnectionState(false));
socket.on("connect_error", (err) => {
  if (String(err.message || "").toLowerCase().includes("unauthorized")) {
    setToken("");
    setAuthStatus("Session expired. Please login again.");
  }
});

socket.on("room:joined", ({ roomId, socketId }) => {
  state.roomId = roomId;
  state.selfSocketId = socketId;
  elements.currentRoomLabel.textContent = `Room: ${roomId}`;
  chat.requestHistory();
});

socket.on("room:users", (users) => {
  state.participants = users;
  syncParticipantsUI();
});

(async () => {
  const currentUser = await fetchCurrentUser();
  if (currentUser) {
    state.userName = currentUser.username;
    elements.nameInput.value = currentUser.username;
    setAuthStatus(`Logged in as @${state.userName}`);
    connectSocketIfNeeded();
  } else {
    setToken("");
    setAuthStatus("Not logged in");
  }
})();
