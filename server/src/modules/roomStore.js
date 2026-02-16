const rooms = new Map();

function createRoomIfMissing(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      members: new Map()
    });
  }
  return rooms.get(roomId);
}

export function joinRoom(roomId, user) {
  const room = createRoomIfMissing(roomId);
  room.members.set(user.socketId, user);
  return room;
}

export function leaveAllRooms(socketId) {
  const updates = [];

  for (const [roomId, room] of rooms.entries()) {
    if (!room.members.has(socketId)) continue;

    const user = room.members.get(socketId);
    room.members.delete(socketId);

    updates.push({ roomId, user });

    if (room.members.size === 0) {
      rooms.delete(roomId);
    }
  }

  return updates;
}

export function getRoomMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.members.values());
}

export function isMemberInRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  return Boolean(room && room.members.has(socketId));
}
