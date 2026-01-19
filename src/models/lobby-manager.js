const Lobby = require("./lobby");
const crypto = require("crypto");

const CONFIG = {
  MAX_LOBBIES: 200,
  MAX_ACTIVE_GAMES: 100,
  LOBBY_IDLE_TIMEOUT_MS: 30 * 60 * 1000,
  GAME_IDLE_TIMEOUT_MS: 2 * 60 * 60 * 1000,
  CLEANUP_INTERVAL_MS: 60 * 1000,
  FINISHED_GAME_RETENTION_MS: 5 * 60 * 1000,
};

class LobbyManager {
  #lobbies;
  #games;
  #gameMetadata;
  #cleanupInterval;

  constructor(config = {}) {
    this.#lobbies = new Map();
    this.#games = new Map();
    this.#gameMetadata = new Map();
    this.config = { ...CONFIG, ...config };
    this.#startCleanupTask();
  }

  #startCleanupTask() {
    this.#cleanupInterval = setInterval(() => {
      this.#cleanup();
    }, this.config.CLEANUP_INTERVAL_MS);

    if (this.#cleanupInterval.unref) {
      this.#cleanupInterval.unref();
    }
  }

  stopCleanup() {
    if (this.#cleanupInterval) {
      clearInterval(this.#cleanupInterval);
      this.#cleanupInterval = null;
    }
  }

  #cleanup() {
    const now = Date.now();
    const toDelete = [];

    for (const [lobbyId, lobby] of this.#lobbies) {
      const status = lobby.status();
      const metadata = this.#gameMetadata.get(lobbyId) || {};

      if (lobby.isEmpty()) {
        toDelete.push(lobbyId);
        continue;
      }

      if (!status.hasExpired) {
        const idleTime = now - lobby.lastActivityAt;
        if (idleTime > this.config.LOBBY_IDLE_TIMEOUT_MS) {
          toDelete.push(lobbyId);
          continue;
        }
      }

      if (metadata.isFinished) {
        const finishedTime = now - metadata.finishedAt;
        if (finishedTime > this.config.FINISHED_GAME_RETENTION_MS) {
          toDelete.push(lobbyId);
          continue;
        }
      }

      if (status.hasExpired && this.#games.has(lobbyId)) {
        const lastActivity = metadata.lastActivityAt || lobby.lastActivityAt;
        const idleTime = now - lastActivity;
        if (idleTime > this.config.GAME_IDLE_TIMEOUT_MS) {
          toDelete.push(lobbyId);
          continue;
        }
      }
    }

    for (const lobbyId of toDelete) {
      this.deleteLobby(lobbyId);
    }

    if (toDelete.length > 0) {
      console.log(`[LobbyManager] Cleaned up ${toDelete.length} lobbies/games`);
    }
  }

  createLobby(size, hostUsername) {
    const activeLobbies = this.#countActiveLobbies();
    if (activeLobbies >= this.config.MAX_LOBBIES) {
      throw new Error("Server is at capacity. Please try again later.");
    }

    const lobbyId = crypto.randomBytes(8).toString("hex");
    const lobby = new Lobby(size);
    lobby.addPlayer({ username: hostUsername });
    this.#lobbies.set(lobbyId, lobby);
    return lobbyId;
  }

  #countActiveLobbies() {
    let count = 0;
    for (const [, lobby] of this.#lobbies) {
      if (!lobby.status().hasExpired) {
        count++;
      }
    }
    return count;
  }

  #countActiveGames() {
    let count = 0;
    for (const [lobbyId] of this.#games) {
      const metadata = this.#gameMetadata.get(lobbyId);
      if (!metadata?.isFinished) {
        count++;
      }
    }
    return count;
  }

  getLobby(lobbyId) {
    return this.#lobbies.get(lobbyId);
  }

  hasLobby(lobbyId) {
    return this.#lobbies.has(lobbyId);
  }

  deleteLobby(lobbyId) {
    this.#lobbies.delete(lobbyId);
    this.#games.delete(lobbyId);
    this.#gameMetadata.delete(lobbyId);
  }

  setGame(lobbyId, game) {
    const activeGames = this.#countActiveGames();
    if (activeGames >= this.config.MAX_ACTIVE_GAMES) {
      throw new Error("Too many active games. Please try again later.");
    }

    this.#games.set(lobbyId, game);
    this.#gameMetadata.set(lobbyId, {
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      isFinished: false,
    });
  }

  getGame(lobbyId) {
    return this.#games.get(lobbyId);
  }

  hasGame(lobbyId) {
    return this.#games.has(lobbyId);
  }

  updateGameActivity(lobbyId) {
    const metadata = this.#gameMetadata.get(lobbyId);
    if (metadata) {
      metadata.lastActivityAt = Date.now();
    }
  }

  markGameFinished(lobbyId) {
    const metadata = this.#gameMetadata.get(lobbyId);
    if (metadata) {
      metadata.isFinished = true;
      metadata.finishedAt = Date.now();
    }
  }

  getAllLobbies() {
    const result = [];

    for (const [id, lobby] of this.#lobbies) {
      const status = lobby.status();

      if (status.hasExpired) continue;

      result.push({
        id,
        playerCount: lobby.playerCount,
        maxPlayers: status.isFull ? lobby.playerCount : 6,
        isFull: status.isFull,
        host: status.host?.username,
        createdAt: lobby.createdAt,
      });
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  getStats() {
    let waitingLobbies = 0;
    let activeGames = 0;
    let finishedGames = 0;
    let totalPlayers = 0;

    for (const [lobbyId, lobby] of this.#lobbies) {
      const status = lobby.status();
      totalPlayers += lobby.playerCount;

      if (!status.hasExpired) {
        waitingLobbies++;
      } else {
        const metadata = this.#gameMetadata.get(lobbyId);
        if (metadata?.isFinished) {
          finishedGames++;
        } else {
          activeGames++;
        }
      }
    }

    return {
      waitingLobbies,
      activeGames,
      finishedGames,
      totalLobbies: this.#lobbies.size,
      totalPlayers,
      maxLobbies: this.config.MAX_LOBBIES,
      maxActiveGames: this.config.MAX_ACTIVE_GAMES,
    };
  }
}

module.exports = LobbyManager;
