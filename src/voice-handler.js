const VOICE_EVENTS = {
  JOIN: "voice:join",
  LEAVE: "voice:leave",
  OFFER: "voice:offer",
  ANSWER: "voice:answer",
  ICE_CANDIDATE: "voice:ice",
  USER_JOINED: "voice:user-joined",
  USER_LEFT: "voice:user-left",
  ROOM_USERS: "voice:room-users",
  ERROR: "voice:error"
};

class VoiceHandler {
  constructor() {
    this.rooms = new Map();
    this.users = new Map();
  }

  setup(io) {
    const voiceNamespace = io.of("/voice");
    
    voiceNamespace.use((socket, next) => {
      const { username, lobbyId } = socket.handshake.auth;
      
      if (!username) {
        return next(new Error("Username required"));
      }
      
      socket.username = username;
      socket.lobbyId = lobbyId;
      next();
    });
    
    voiceNamespace.on("connection", (socket) => {
      console.log(`[Voice] User connected: ${socket.username} (${socket.id})`);
      
      this.handleConnection(socket, voiceNamespace);
    });
    
    return voiceNamespace;
  }

  handleConnection(socket, namespace) {
    socket.on(VOICE_EVENTS.JOIN, (data, callback) => {
      const roomId = data?.roomId || socket.lobbyId;
      
      if (!roomId) {
        return this.sendError(socket, callback, "Room ID required");
      }
      
      this.joinRoom(socket, roomId, namespace);
      
      if (callback) {
        callback({ 
          success: true, 
          socketId: socket.id,
          roomId 
        });
      }
    });
    
    socket.on(VOICE_EVENTS.LEAVE, (callback) => {
      this.leaveRoom(socket, namespace);
      
      if (callback) {
        callback({ success: true });
      }
    });
    
    socket.on(VOICE_EVENTS.OFFER, ({ targetId, offer }) => {
      if (!targetId || !offer) {
        console.warn("[Voice] Invalid offer - missing targetId or offer");
        return;
      }
      
      namespace.to(targetId).emit(VOICE_EVENTS.OFFER, {
        senderId: socket.id,
        senderName: socket.username,
        offer
      });
    });
    
    socket.on(VOICE_EVENTS.ANSWER, ({ targetId, answer }) => {
      if (!targetId || !answer) {
        console.warn("[Voice] Invalid answer - missing targetId or answer");
        return;
      }
      
      namespace.to(targetId).emit(VOICE_EVENTS.ANSWER, {
        senderId: socket.id,
        answer
      });
    });
    
    socket.on(VOICE_EVENTS.ICE_CANDIDATE, ({ targetId, candidate }) => {
      if (!targetId) {
        return;
      }
      
      namespace.to(targetId).emit(VOICE_EVENTS.ICE_CANDIDATE, {
        senderId: socket.id,
        candidate
      });
    });
    
    socket.on("disconnect", () => {
      console.log(`[Voice] User disconnected: ${socket.username} (${socket.id})`);
      this.leaveRoom(socket, namespace);
    });
  }

  joinRoom(socket, roomId, namespace) {
    this.leaveRoom(socket, namespace);
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    const room = this.rooms.get(roomId);
    
    const existingUsers = Array.from(room).map(socketId => ({
      socketId,
      username: this.users.get(socketId)?.username || "Unknown"
    }));
    
    room.add(socket.id);
    this.users.set(socket.id, { roomId, username: socket.username });
    socket.join(`voice:${roomId}`);
    
    console.log(`[Voice] ${socket.username} joined room ${roomId} (${room.size} users)`);
    
    socket.emit(VOICE_EVENTS.ROOM_USERS, { users: existingUsers });
    
    socket.to(`voice:${roomId}`).emit(VOICE_EVENTS.USER_JOINED, {
      socketId: socket.id,
      username: socket.username
    });
  }

  leaveRoom(socket, namespace) {
    const userData = this.users.get(socket.id);
    
    if (!userData) {
      return;
    }
    
    const { roomId } = userData;
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.delete(socket.id);
      
      if (room.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[Voice] Room ${roomId} is now empty, removed`);
      }
    }
    
    this.users.delete(socket.id);
    socket.leave(`voice:${roomId}`);
    
    namespace.to(`voice:${roomId}`).emit(VOICE_EVENTS.USER_LEFT, {
      socketId: socket.id,
      username: socket.username
    });
    
    console.log(`[Voice] ${socket.username} left room ${roomId}`);
  }

  sendError(socket, callback, message) {
    const error = { code: "VOICE_ERROR", message };
    
    if (callback) {
      callback({ success: false, error });
    } else {
      socket.emit(VOICE_EVENTS.ERROR, error);
    }
  }

  getStats() {
    const stats = {
      totalRooms: this.rooms.size,
      totalUsers: this.users.size,
      rooms: {}
    };
    
    this.rooms.forEach((users, roomId) => {
      stats.rooms[roomId] = {
        userCount: users.size,
        users: Array.from(users)
      };
    });
    
    return stats;
  }
}

const voiceHandler = new VoiceHandler();

module.exports = { 
  voiceHandler, 
  VOICE_EVENTS,
  setupVoice: (io) => voiceHandler.setup(io)
};
