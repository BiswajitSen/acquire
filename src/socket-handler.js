const EVENTS = {
  CONNECTION: "connection",
  DISCONNECT: "disconnect",
  ERROR: "error",
  JOIN_LOBBY: "joinLobby",
  LEAVE_LOBBY: "leaveLobby",
  LOBBY_UPDATE: "lobbyUpdate",
  LOBBY_LIST_UPDATE: "lobbyListUpdate",
  JOIN_GAME: "joinGame",
  LEAVE_GAME: "leaveGame",
  GAME_UPDATE: "gameUpdate",
  GAME_END: "gameEnd",
  VOICE_JOIN: "voiceJoin",
  VOICE_LEAVE: "voiceLeave",
  VOICE_OFFER: "voiceOffer",
  VOICE_ANSWER: "voiceAnswer",
  VOICE_ICE_CANDIDATE: "voiceIceCandidate",
  VOICE_USER_JOINED: "voiceUserJoined",
  VOICE_USER_LEFT: "voiceUserLeft",
  VOICE_ROOM_USERS: "voiceRoomUsers",
  VOICE_MIC_ON: "voiceMicOn",
  VOICE_MIC_OFF: "voiceMicOff"
};

const ERROR_CODES = {
  INVALID_LOBBY: "INVALID_LOBBY",
  INVALID_GAME: "INVALID_GAME",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR"
};

class SocketManager {
  constructor(io, lobbyManager) {
    this.io = io;
    this.lobbyManager = lobbyManager;
    this.clients = new Map();
    this.voiceRooms = new Map();
    
    this.lobbyNamespace = io.of("/lobby");
    this.gameNamespace = io.of("/game");
    this.voiceNamespace = io.of("/voice");
    
    this.setupLobbyNamespace();
    this.setupGameNamespace();
    this.setupVoiceNamespace();
  }

  authenticateSocket(socket, next) {
    const { username, lobbyId } = socket.handshake.auth;
    
    if (!username) {
      return next(new Error(ERROR_CODES.UNAUTHORIZED));
    }
    
    socket.username = username;
    socket.lobbyId = lobbyId;
    next();
  }

  setupLobbyNamespace() {
    this.lobbyNamespace.use((socket, next) => this.authenticateSocket(socket, next));
    
    this.lobbyNamespace.on(EVENTS.CONNECTION, (socket) => {
      this.handleLobbyConnection(socket);
    });
  }

  handleLobbyConnection(socket) {
    const { username, lobbyId } = socket;
    
    this.clients.set(socket.id, { 
      username, 
      lobbyId, 
      namespace: "lobby",
      connectedAt: Date.now()
    });

    socket.on(EVENTS.JOIN_LOBBY, (data, callback) => {
      const id = data?.lobbyId || lobbyId;
      if (!id) {
        return this.sendError(socket, callback, ERROR_CODES.INVALID_LOBBY, "Lobby ID required");
      }
      
      const lobby = this.lobbyManager.getLobby(id);
      if (!lobby) {
        return this.sendError(socket, callback, ERROR_CODES.INVALID_LOBBY, "Lobby not found");
      }
      
      socket.join(`lobby:${id}`);
      this.clients.get(socket.id).lobbyId = id;
      
      if (callback) callback({ success: true });
    });

    socket.on(EVENTS.LEAVE_LOBBY, (data, callback) => {
      const clientInfo = this.clients.get(socket.id);
      if (clientInfo?.lobbyId) {
        socket.leave(`lobby:${clientInfo.lobbyId}`);
      }
      if (callback) callback({ success: true });
    });

    socket.on(EVENTS.DISCONNECT, () => {
      this.clients.delete(socket.id);
    });
  }

  setupGameNamespace() {
    this.gameNamespace.use((socket, next) => this.authenticateSocket(socket, next));
    
    this.gameNamespace.on(EVENTS.CONNECTION, (socket) => {
      this.handleGameConnection(socket);
    });
  }

  handleGameConnection(socket) {
    const { username, lobbyId } = socket;
    
    this.clients.set(socket.id, {
      username,
      lobbyId,
      namespace: "game",
      connectedAt: Date.now()
    });

    socket.on(EVENTS.JOIN_GAME, (data, callback) => {
      const id = data?.lobbyId || lobbyId;
      if (!id) {
        return this.sendError(socket, callback, ERROR_CODES.INVALID_GAME, "Game ID required");
      }
      
      const game = this.lobbyManager.getGame(id);
      if (!game) {
        return this.sendError(socket, callback, ERROR_CODES.INVALID_GAME, "Game not found");
      }
      
      socket.join(`game:${id}`);
      this.clients.get(socket.id).lobbyId = id;
      
      if (callback) callback({ success: true });
    });

    socket.on(EVENTS.LEAVE_GAME, (data, callback) => {
      const clientInfo = this.clients.get(socket.id);
      if (clientInfo?.lobbyId) {
        socket.leave(`game:${clientInfo.lobbyId}`);
      }
      if (callback) callback({ success: true });
    });

    socket.on(EVENTS.DISCONNECT, () => {
      this.clients.delete(socket.id);
    });
  }

  setupVoiceNamespace() {
    this.voiceNamespace.use((socket, next) => this.authenticateSocket(socket, next));
    
    this.voiceNamespace.on(EVENTS.CONNECTION, (socket) => {
      this.handleVoiceConnection(socket);
    });
  }

  handleVoiceConnection(socket) {
    const { username, lobbyId } = socket;
    
    this.clients.set(socket.id, {
      username,
      lobbyId,
      namespace: "voice",
      inVoice: false,
      micOn: false,
      connectedAt: Date.now()
    });

    socket.on(EVENTS.VOICE_JOIN, (data, callback) => {
      const id = data?.lobbyId || lobbyId;
      if (!id) {
        return this.sendError(socket, callback, ERROR_CODES.INVALID_LOBBY, "Lobby ID required");
      }

      const clientInfo = this.clients.get(socket.id);
      clientInfo.lobbyId = id;
      clientInfo.inVoice = true;

      if (!this.voiceRooms.has(id)) {
        this.voiceRooms.set(id, new Set());
      }

      const room = this.voiceRooms.get(id);
      const existingUsers = Array.from(room);
      
      socket.emit(EVENTS.VOICE_ROOM_USERS, { users: existingUsers });
      
      room.forEach(peerId => {
        this.voiceNamespace.to(peerId).emit(EVENTS.VOICE_USER_JOINED, { oderId: socket.id });
      });

      room.add(socket.id);
      socket.join(`voice:${id}`);
      
      if (callback) callback({ success: true, users: existingUsers, socketId: socket.id });
    });

    socket.on(EVENTS.VOICE_LEAVE, (callback) => {
      this.handleVoiceLeave(socket);
      if (callback) callback({ success: true });
    });

    socket.on(EVENTS.VOICE_OFFER, ({ to, offer }) => {
      if (!to || !offer) return;
      this.voiceNamespace.to(to).emit(EVENTS.VOICE_OFFER, { from: socket.id, offer });
    });

    socket.on(EVENTS.VOICE_ANSWER, ({ to, answer }) => {
      if (!to || !answer) return;
      this.voiceNamespace.to(to).emit(EVENTS.VOICE_ANSWER, { from: socket.id, answer });
    });

    socket.on(EVENTS.VOICE_ICE_CANDIDATE, ({ to, candidate }) => {
      if (!to) return;
      this.voiceNamespace.to(to).emit(EVENTS.VOICE_ICE_CANDIDATE, { from: socket.id, candidate });
    });

    socket.on(EVENTS.VOICE_MIC_ON, () => {
      const clientInfo = this.clients.get(socket.id);
      if (clientInfo) clientInfo.micOn = true;
    });

    socket.on(EVENTS.VOICE_MIC_OFF, () => {
      const clientInfo = this.clients.get(socket.id);
      if (clientInfo) clientInfo.micOn = false;
    });

    socket.on(EVENTS.DISCONNECT, () => {
      this.handleVoiceLeave(socket);
      this.clients.delete(socket.id);
    });
  }

  handleVoiceLeave(socket) {
    const clientInfo = this.clients.get(socket.id);
    if (!clientInfo?.lobbyId || !clientInfo.inVoice) return;

    const lobbyId = clientInfo.lobbyId;
    const room = this.voiceRooms.get(lobbyId);

    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        this.voiceRooms.delete(lobbyId);
      }
    }

    clientInfo.inVoice = false;
    socket.leave(`voice:${lobbyId}`);
    
    this.voiceNamespace.to(`voice:${lobbyId}`).emit(EVENTS.VOICE_USER_LEFT, { oderId: socket.id });
  }

  sendError(socket, callback, code, message) {
    const error = { code, message };
    if (callback) {
      callback({ success: false, error });
    } else {
      socket.emit(EVENTS.ERROR, error);
    }
  }

  broadcastLobbyListUpdate() {
    const lobbies = this.lobbyManager.getAllLobbies();
    this.lobbyNamespace.emit(EVENTS.LOBBY_LIST_UPDATE, { lobbies });
  }

  broadcastLobbyUpdate(lobbyId) {
    const lobby = this.lobbyManager.getLobby(lobbyId);
    if (lobby) {
      this.lobbyNamespace.to(`lobby:${lobbyId}`).emit(EVENTS.LOBBY_UPDATE);
    }
  }

  broadcastGameUpdate(lobbyId) {
    const game = this.lobbyManager.getGame(lobbyId);
    if (game) {
      this.gameNamespace.to(`game:${lobbyId}`).emit(EVENTS.GAME_UPDATE);
    }
  }

  broadcastGameEnd(lobbyId, gameResult) {
    this.gameNamespace.to(`game:${lobbyId}`).emit(EVENTS.GAME_END, gameResult);
  }
}

const setupSocketServer = (io, lobbyManager) => {
  const socketManager = new SocketManager(io, lobbyManager);

  return {
    broadcastLobbyListUpdate: () => socketManager.broadcastLobbyListUpdate(),
    broadcastLobbyUpdate: (lobbyId) => socketManager.broadcastLobbyUpdate(lobbyId),
    broadcastGameUpdate: (lobbyId) => socketManager.broadcastGameUpdate(lobbyId),
    broadcastGameEnd: (lobbyId, gameResult) => socketManager.broadcastGameEnd(lobbyId, gameResult)
  };
};

module.exports = { setupSocketServer, EVENTS, ERROR_CODES };
