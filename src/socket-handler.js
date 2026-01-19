const setupSocketServer = (io, lobbyManager) => {
  const clients = new Map();
  const voiceRooms = new Map();

  io.on("connection", (socket) => {
    socket.on("joinLobbyRoom", (lobbyId) => {
      socket.join(`lobby:${lobbyId}`);
      clients.set(socket.id, { lobbyId });
    });

    socket.on("joinGameRoom", (lobbyId) => {
      socket.join(`game:${lobbyId}`);
      const clientInfo = clients.get(socket.id) || {};
      clientInfo.lobbyId = lobbyId;
      clients.set(socket.id, clientInfo);
    });

    socket.on("voiceJoin", () => {
      const clientInfo = clients.get(socket.id);
      if (!clientInfo?.lobbyId) return;

      const lobbyId = clientInfo.lobbyId;
      clientInfo.inVoice = true;

      if (!voiceRooms.has(lobbyId)) {
        voiceRooms.set(lobbyId, new Set());
      }

      const room = voiceRooms.get(lobbyId);
      
      const existingUsers = Array.from(room);
      socket.emit("voiceRoomUsers", { users: existingUsers });
      
      room.forEach(peerId => {
        io.to(peerId).emit("voiceUserJoined", { oderId: socket.id });
      });

      room.add(socket.id);
      socket.join(`voice:${lobbyId}`);
    });

    socket.on("voiceMicOn", () => {
      const clientInfo = clients.get(socket.id);
      if (clientInfo) {
        clientInfo.micOn = true;
      }
    });

    socket.on("voiceMicOff", () => {
      const clientInfo = clients.get(socket.id);
      if (clientInfo) {
        clientInfo.micOn = false;
      }
    });

    socket.on("voiceLeave", () => {
      handleVoiceLeave(socket);
    });

    socket.on("voiceOffer", ({ to, offer }) => {
      io.to(to).emit("voiceOffer", { from: socket.id, offer });
    });

    socket.on("voiceAnswer", ({ to, answer }) => {
      io.to(to).emit("voiceAnswer", { from: socket.id, answer });
    });

    socket.on("voiceIceCandidate", ({ to, candidate }) => {
      io.to(to).emit("voiceIceCandidate", { from: socket.id, candidate });
    });

    socket.on("disconnect", () => {
      handleVoiceLeave(socket);
      clients.delete(socket.id);
    });
  });

  const handleVoiceLeave = (socket) => {
    const clientInfo = clients.get(socket.id);
    if (!clientInfo?.lobbyId || !clientInfo.inVoice) return;

    const lobbyId = clientInfo.lobbyId;
    const room = voiceRooms.get(lobbyId);

    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        voiceRooms.delete(lobbyId);
      }
    }

    clientInfo.inVoice = false;
    socket.leave(`voice:${lobbyId}`);
    
    io.to(`voice:${lobbyId}`).emit("voiceUserLeft", { oderId: socket.id });
  };

  const broadcastLobbyListUpdate = () => {
    const lobbies = lobbyManager.getAllLobbies();
    io.emit("lobbyListUpdate", { lobbies });
  };

  const broadcastLobbyUpdate = (lobbyId) => {
    const lobby = lobbyManager.getLobby(lobbyId);
    if (lobby) {
      io.to(`lobby:${lobbyId}`).emit("lobbyUpdate");
    }
  };

  const broadcastGameUpdate = (lobbyId) => {
    const game = lobbyManager.getGame(lobbyId);
    if (game) {
      io.to(`game:${lobbyId}`).emit("gameUpdate");
    }
  };

  const broadcastGameEnd = (lobbyId, gameResult) => {
    io.to(`game:${lobbyId}`).emit("gameEnd", gameResult);
  };

  return {
    broadcastLobbyListUpdate,
    broadcastLobbyUpdate,
    broadcastGameUpdate,
    broadcastGameEnd
  };
};

module.exports = { setupSocketServer };
