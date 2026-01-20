/**
 * Voice Communication Handler
 * 
 * This module handles the signaling layer for WebRTC voice communication.
 * It uses Socket.IO to exchange WebRTC offers, answers, and ICE candidates
 * between peers in the same game room.
 * 
 * Architecture:
 * - Each game has a voice "room" identified by the game/lobby ID
 * - When a player joins a game, they join the corresponding voice room
 * - The server relays signaling messages between peers
 * - Actual audio flows directly between peers via WebRTC (not through server)
 * 
 * Flow:
 * 1. Player A joins voice room → server tracks them
 * 2. Player B joins voice room → server notifies A, sends B list of existing users
 * 3. B creates WebRTC offers for each existing user
 * 4. Server relays offers to recipients
 * 5. Recipients create answers, server relays back
 * 6. ICE candidates are exchanged until connection established
 * 7. Audio streams directly between peers
 */

// Event names for voice communication
const VOICE_EVENTS = {
  // Client → Server
  JOIN: "voice:join",           // Join a voice room
  LEAVE: "voice:leave",         // Leave the voice room
  OFFER: "voice:offer",         // Send WebRTC offer to a peer
  ANSWER: "voice:answer",       // Send WebRTC answer to a peer
  ICE_CANDIDATE: "voice:ice",   // Send ICE candidate to a peer
  
  // Server → Client
  USER_JOINED: "voice:user-joined",   // A new user joined the room
  USER_LEFT: "voice:user-left",       // A user left the room
  ROOM_USERS: "voice:room-users",     // List of users already in the room
  ERROR: "voice:error"                // Error occurred
};

/**
 * VoiceHandler - Manages voice room signaling
 */
class VoiceHandler {
  constructor() {
    // Map of roomId → Set of socket IDs in that room
    this.rooms = new Map();
    
    // Map of socketId → { roomId, username }
    this.users = new Map();
  }

  /**
   * Set up the voice namespace on Socket.IO
   * @param {Server} io - Socket.IO server instance
   */
  setup(io) {
    const voiceNamespace = io.of("/voice");
    
    // Authentication middleware
    voiceNamespace.use((socket, next) => {
      const { username, lobbyId } = socket.handshake.auth;
      
      if (!username) {
        return next(new Error("Username required"));
      }
      
      socket.username = username;
      socket.lobbyId = lobbyId;
      next();
    });
    
    // Handle new connections
    voiceNamespace.on("connection", (socket) => {
      console.log(`[Voice] User connected: ${socket.username} (${socket.id})`);
      
      this.handleConnection(socket, voiceNamespace);
    });
    
    return voiceNamespace;
  }

  /**
   * Handle a new socket connection
   */
  handleConnection(socket, namespace) {
    // Join voice room
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
    
    // Leave voice room
    socket.on(VOICE_EVENTS.LEAVE, (callback) => {
      this.leaveRoom(socket, namespace);
      
      if (callback) {
        callback({ success: true });
      }
    });
    
    // Relay WebRTC offer to target peer
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
    
    // Relay WebRTC answer to target peer
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
    
    // Relay ICE candidate to target peer
    socket.on(VOICE_EVENTS.ICE_CANDIDATE, ({ targetId, candidate }) => {
      if (!targetId) {
        return;
      }
      
      namespace.to(targetId).emit(VOICE_EVENTS.ICE_CANDIDATE, {
        senderId: socket.id,
        candidate
      });
    });
    
    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`[Voice] User disconnected: ${socket.username} (${socket.id})`);
      this.leaveRoom(socket, namespace);
    });
  }

  /**
   * Add a user to a voice room
   */
  joinRoom(socket, roomId, namespace) {
    // Leave any existing room first
    this.leaveRoom(socket, namespace);
    
    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    const room = this.rooms.get(roomId);
    
    // Get list of existing users before adding new one
    const existingUsers = Array.from(room).map(socketId => ({
      socketId,
      username: this.users.get(socketId)?.username || "Unknown"
    }));
    
    // Add user to room
    room.add(socket.id);
    this.users.set(socket.id, { roomId, username: socket.username });
    socket.join(`voice:${roomId}`);
    
    console.log(`[Voice] ${socket.username} joined room ${roomId} (${room.size} users)`);
    
    // Send list of existing users to the new user
    socket.emit(VOICE_EVENTS.ROOM_USERS, { users: existingUsers });
    
    // Notify existing users about the new user
    socket.to(`voice:${roomId}`).emit(VOICE_EVENTS.USER_JOINED, {
      socketId: socket.id,
      username: socket.username
    });
  }

  /**
   * Remove a user from their voice room
   */
  leaveRoom(socket, namespace) {
    const userData = this.users.get(socket.id);
    
    if (!userData) {
      return;
    }
    
    const { roomId } = userData;
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.delete(socket.id);
      
      // Clean up empty rooms
      if (room.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[Voice] Room ${roomId} is now empty, removed`);
      }
    }
    
    this.users.delete(socket.id);
    socket.leave(`voice:${roomId}`);
    
    // Notify other users in the room
    namespace.to(`voice:${roomId}`).emit(VOICE_EVENTS.USER_LEFT, {
      socketId: socket.id,
      username: socket.username
    });
    
    console.log(`[Voice] ${socket.username} left room ${roomId}`);
  }

  /**
   * Send an error to the client
   */
  sendError(socket, callback, message) {
    const error = { code: "VOICE_ERROR", message };
    
    if (callback) {
      callback({ success: false, error });
    } else {
      socket.emit(VOICE_EVENTS.ERROR, error);
    }
  }

  /**
   * Get room statistics (for debugging)
   */
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

// Export singleton instance and events
const voiceHandler = new VoiceHandler();

module.exports = { 
  voiceHandler, 
  VOICE_EVENTS,
  setupVoice: (io) => voiceHandler.setup(io)
};
