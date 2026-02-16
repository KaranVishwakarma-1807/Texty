function formatTime(isoString) {
  const dt = new Date(isoString);
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function createChatModule({ socket, state, elements }) {
  const { messages, messageInput, sendBtn } = elements;

  function pushBubble({ text, userName, sentAt, senderId, isSystem = false }) {
    const item = document.createElement("article");
    item.className = `bubble ${senderId === state.selfSocketId ? "self" : ""}`;
    const senderLabel = isSystem ? "System" : userName || "Anonymous";
    item.innerHTML = `
      <span class="meta">${senderLabel} • ${formatTime(sentAt)}</span>
      <span>${text}</span>
    `;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  function sendCurrentMessage() {
    if (!state.roomId || !state.userName) return;
    const text = messageInput.value.trim();
    if (!text) return;
    socket.emit("chat:send", {
      roomId: state.roomId,
      text
    });
    messageInput.value = "";
  }

  sendBtn.addEventListener("click", sendCurrentMessage);
  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendCurrentMessage();
  });

  socket.on("chat:history", (history) => {
    messages.innerHTML = "";
    history.forEach(pushBubble);
  });

  socket.on("chat:message", pushBubble);
  socket.on("room:system", (msg) => pushBubble({ ...msg, isSystem: true }));

  return {
    requestHistory() {
      socket.emit("chat:history:request", { roomId: state.roomId });
    }
  };
}
