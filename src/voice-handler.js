/**
 * Voice Handler - Minimal version for Agora integration
 * 
 * Agora handles all the actual voice communication.
 * This just tracks who's in voice rooms for UI indicators.
 */

const VOICE_EVENTS = {
  JOIN: "voice:join",
  LEAVE: "voice:leave",
  USER_JOINED: "voice:user-joined",
  USER_LEFT: "voice:user-left",
  ROOM_USERS: "voice:room-users"
};

class VoiceHandler {
  constructor() {
    this.rooms = new Map(); // roomId -> Set of usernames
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
      console.log(`[Voice] Connected: ${socket.username}`);
      
      socket.on(VOICE_EVENTS.JOIN, (data, callback) => {
        const roomId = data?.roomId || socket.lobbyId;
        if (!roomId) {
          return callback?.({ success: false, error: "Room ID required" });
        }
        
        // Track user in room
        if (!this.rooms.has(roomId)) {
          this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId).add(socket.username);
        socket.join(`voice:${roomId}`);
        socket.currentRoom = roomId;
        
        // Notify others
        socket.to(`voice:${roomId}`).emit(VOICE_EVENTS.USER_JOINED, {
          username: socket.username
        });
        
        callback?.({ success: true, roomId });
      });
      
      socket.on(VOICE_EVENTS.LEAVE, (callback) => {
        this.handleLeave(socket);
        callback?.({ success: true });
      });
      
      socket.on("disconnect", () => {
        console.log(`[Voice] Disconnected: ${socket.username}`);
        this.handleLeave(socket);
      });
    });
    
    return voiceNamespace;
  }

  handleLeave(socket) {
    const roomId = socket.currentRoom;
    if (!roomId) return;
    
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(socket.username);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
    
    socket.to(`voice:${roomId}`).emit(VOICE_EVENTS.USER_LEFT, {
      username: socket.username
    });
    
    socket.leave(`voice:${roomId}`);
    socket.currentRoom = null;
  }
}

const voiceHandler = new VoiceHandler();

module.exports = { 
  voiceHandler, 
  VOICE_EVENTS,
  setupVoice: (io) => voiceHandler.setup(io)
};
