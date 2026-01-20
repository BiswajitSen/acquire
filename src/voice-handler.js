const VOICE_EVENTS = {
  JOIN: "voice:join",
  LEAVE: "voice:leave",
  SIGNAL: "voice:signal",
  USER_JOINED: "voice:user-joined",
  USER_LEFT: "voice:user-left",
  ROOM_USERS: "voice:room-users",
  ERROR: "voice:error"
};

class VoiceHandler {
  constructor() {
    this.rooms = new Map(); // roomId -> Set of socketIds
    this.users = new Map(); // socketId -> { roomId, username }
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
      console.log(`[Voice] Connected: ${socket.username} (${socket.id})`);
      this.handleConnection(socket);
    });
    
    return voiceNamespace;
  }

  handleConnection(socket) {
    // Join voice room
    socket.on(VOICE_EVENTS.JOIN, (data, callback) => {
      const roomId = data?.roomId || socket.lobbyId;
      
      if (!roomId) {
        return callback?.({ success: false, error: "Room ID required" });
      }
      
      this.joinRoom(socket, roomId);
      
      callback?.({ 
        success: true, 
        socketId: socket.id,
        roomId 
      });
    });
    
    // Leave voice room
    socket.on(VOICE_EVENTS.LEAVE, (callback) => {
      this.leaveRoom(socket);
      callback?.({ success: true });
    });
    
    // WebRTC signaling - forward to target peer
    socket.on(VOICE_EVENTS.SIGNAL, ({ targetId, signal }) => {
      if (!targetId || !signal) {
        console.warn("[Voice] Invalid signal - missing targetId or signal");
        return;
      }
      
      // Forward the signal to the target peer
      socket.to(targetId).emit(VOICE_EVENTS.SIGNAL, {
        senderId: socket.id,
        senderName: socket.username,
        signal
      });
    });
    
    // Disconnect
    socket.on("disconnect", () => {
      console.log(`[Voice] Disconnected: ${socket.username} (${socket.id})`);
      this.leaveRoom(socket);
    });
  }

  joinRoom(socket, roomId) {
    // Leave any previous room
    this.leaveRoom(socket);
    
    // Create room if doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    const room = this.rooms.get(roomId);
    
    // Get existing users before adding new one
    const existingUsers = Array.from(room).map(socketId => ({
      socketId,
      username: this.users.get(socketId)?.username || "Unknown"
    }));
    
    // Add user to room
    room.add(socket.id);
    this.users.set(socket.id, { roomId, username: socket.username });
    socket.join(`voice:${roomId}`);
    
    console.log(`[Voice] ${socket.username} joined room ${roomId} (${room.size} users)`);
    
    // Send existing users to the new user
    socket.emit(VOICE_EVENTS.ROOM_USERS, { users: existingUsers });
    
    // Notify existing users about new user
    socket.to(`voice:${roomId}`).emit(VOICE_EVENTS.USER_JOINED, {
      socketId: socket.id,
      username: socket.username
    });
  }

  leaveRoom(socket) {
    const userData = this.users.get(socket.id);
    if (!userData) return;
    
    const { roomId } = userData;
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.delete(socket.id);
      
      if (room.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[Voice] Room ${roomId} is empty, removed`);
      }
    }
    
    this.users.delete(socket.id);
    socket.leave(`voice:${roomId}`);
    
    // Notify others
    socket.to(`voice:${roomId}`).emit(VOICE_EVENTS.USER_LEFT, {
      socketId: socket.id,
      username: socket.username
    });
    
    console.log(`[Voice] ${socket.username} left room ${roomId}`);
  }
}

const voiceHandler = new VoiceHandler();

module.exports = { 
  voiceHandler, 
  VOICE_EVENTS,
  setupVoice: (io) => voiceHandler.setup(io)
};
