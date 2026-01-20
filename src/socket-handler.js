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
  GAME_END: "gameEnd"
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
    
    this.lobbyNamespace = io.of("/lobby");
    this.gameNamespace = io.of("/game");
    
    this.setupLobbyNamespace();
    this.setupGameNamespace();
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
