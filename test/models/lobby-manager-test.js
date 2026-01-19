const assert = require("assert");
const { describe, it, beforeEach, afterEach } = require("node:test");
const LobbyManager = require("../../src/models/lobby-manager");
const { Game } = require("../../src/models/game");
const { Player } = require("../../src/models/player");
const { createCorporations } = require("../../src/models/corporation");

describe("LobbyManager", () => {
  let manager;

  beforeEach(() => {
    manager = new LobbyManager({
      CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
      MAX_LOBBIES: 10,
      MAX_ACTIVE_GAMES: 5,
    });
  });

  afterEach(() => {
    if (manager) {
      manager.stopCleanup();
    }
  });

  describe("constructor", () => {
    it("should create with default config", () => {
      const mgr = new LobbyManager();
      mgr.stopCleanup();
      
      assert.ok(mgr.config.MAX_LOBBIES);
      assert.ok(mgr.config.MAX_ACTIVE_GAMES);
    });

    it("should merge custom config", () => {
      const mgr = new LobbyManager({ MAX_LOBBIES: 50 });
      mgr.stopCleanup();
      
      assert.strictEqual(mgr.config.MAX_LOBBIES, 50);
    });
  });

  describe("createLobby", () => {
    it("should create a lobby and return its ID", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      
      assert.ok(lobbyId);
      assert.strictEqual(typeof lobbyId, "string");
    });

    it("should add host as first player", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      const lobby = manager.getLobby(lobbyId);
      const status = lobby.status();
      
      assert.strictEqual(status.players.length, 1);
      assert.strictEqual(status.players[0].username, "host");
    });

    it("should set host correctly", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "testHost");
      const lobby = manager.getLobby(lobbyId);
      const status = lobby.status();
      
      assert.strictEqual(status.host.username, "testHost");
    });

    it("should throw when max lobbies reached", () => {
      for (let i = 0; i < 10; i++) {
        manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, `host${i}`);
      }
      
      assert.throws(() => {
        manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "oneMore");
      }, /capacity/i);
    });

    it("should generate unique lobby IDs", () => {
      const id1 = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host1");
      const id2 = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host2");
      
      assert.notStrictEqual(id1, id2);
    });
  });

  describe("getLobby", () => {
    it("should return lobby by ID", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      
      const lobby = manager.getLobby(lobbyId);
      
      assert.ok(lobby);
      assert.strictEqual(lobby.status().host.username, "host");
    });

    it("should return undefined for non-existent lobby", () => {
      const lobby = manager.getLobby("nonexistent");
      
      assert.strictEqual(lobby, undefined);
    });
  });

  describe("deleteLobby", () => {
    it("should delete a lobby", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      
      manager.deleteLobby(lobbyId);
      
      assert.strictEqual(manager.getLobby(lobbyId), undefined);
    });

    it("should also delete associated game", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      manager.setGame(lobbyId, game);
      
      manager.deleteLobby(lobbyId);
      
      assert.strictEqual(manager.getGame(lobbyId), undefined);
    });

    it("should handle deleting non-existent lobby", () => {
      manager.deleteLobby("nonexistent");
    });
  });

  describe("getAllLobbies", () => {
    it("should return empty array when no lobbies", () => {
      const lobbies = manager.getAllLobbies();
      
      assert.deepStrictEqual(lobbies, []);
    });

    it("should return all lobby info", () => {
      manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host1");
      manager.createLobby({ lowerLimit: 3, upperLimit: 4 }, "host2");
      
      const lobbies = manager.getAllLobbies();
      
      assert.strictEqual(lobbies.length, 2);
    });

    it("should include lobby metadata", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "testHost");
      
      const lobbies = manager.getAllLobbies();
      const lobby = lobbies.find(l => l.id === lobbyId);
      
      assert.ok(lobby);
      assert.strictEqual(lobby.host, "testHost");
      assert.strictEqual(lobby.playerCount, 1);
      assert.strictEqual(lobby.maxPlayers, 6);
    });

    it("should filter out expired lobbies", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = manager.getLobby(lobbyId);

      lobby.expire();

      const lobbies = manager.getAllLobbies();
      const found = lobbies.find(l => l.id === lobbyId);
      assert.strictEqual(found, undefined);
    });
  });

  describe("setGame", () => {
    it("should store a game", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      
      const players = [new Player("host"), new Player("player2")];
      const game = new Game(players, x => x, createCorporations());
      manager.setGame(lobbyId, game);
      
      assert.ok(manager.getGame(lobbyId));
    });

    it("should track game metadata", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      const lobby = manager.getLobby(lobbyId);
      lobby.expire();

      const players = [new Player("host"), new Player("player2")];
      const game = new Game(players, x => x, createCorporations());
      manager.setGame(lobbyId, game);
      
      const stats = manager.getStats();
      assert.strictEqual(stats.activeGames, 1);
    });

    it("should throw when max active games reached", () => {
      for (let i = 0; i < 5; i++) {
        const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, `host${i}`);
        const lobby = manager.getLobby(lobbyId);
        lobby.expire();
        const players = [new Player(`host${i}`)];
        const game = new Game(players, x => x, createCorporations());
        manager.setGame(lobbyId, game);
      }
      
      const newLobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "extra");
      const players = [new Player("extra")];
      const game = new Game(players, x => x, createCorporations());
      
      assert.throws(() => {
        manager.setGame(newLobbyId, game);
      }, /many active games/i);
    });
  });

  describe("getGame", () => {
    it("should return game by lobby ID", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      manager.setGame(lobbyId, game);
      
      const retrievedGame = manager.getGame(lobbyId);
      
      assert.ok(retrievedGame);
      assert.strictEqual(retrievedGame, game);
    });

    it("should return undefined for non-existent game", () => {
      const game = manager.getGame("nonexistent");
      
      assert.strictEqual(game, undefined);
    });

    it("should return undefined for lobby without game", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      
      const game = manager.getGame(lobbyId);
      
      assert.strictEqual(game, undefined);
    });
  });

  describe("hasLobby", () => {
    it("should return true for existing lobby", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      
      assert.ok(manager.hasLobby(lobbyId));
    });

    it("should return false for non-existent lobby", () => {
      assert.ok(!manager.hasLobby("nonexistent"));
    });
  });

  describe("hasGame", () => {
    it("should return true when game exists", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      manager.setGame(lobbyId, game);
      
      assert.ok(manager.hasGame(lobbyId));
    });

    it("should return false when no game exists", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      
      assert.ok(!manager.hasGame(lobbyId));
    });
  });

  describe("updateGameActivity", () => {
    it("should update last activity timestamp", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = manager.getLobby(lobbyId);
      lobby.expire();
      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      manager.setGame(lobbyId, game);

      manager.updateGameActivity(lobbyId);
      
      const stats = manager.getStats();
      assert.strictEqual(stats.activeGames, 1);
    });

    it("should handle non-existent lobby gracefully", () => {
      manager.updateGameActivity("nonexistent");
    });
  });

  describe("markGameFinished", () => {
    it("should mark game as finished", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = manager.getLobby(lobbyId);
      lobby.expire();
      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      manager.setGame(lobbyId, game);
      
      manager.markGameFinished(lobbyId);
      
      const stats = manager.getStats();
      assert.strictEqual(stats.finishedGames, 1);
      assert.strictEqual(stats.activeGames, 0);
    });

    it("should handle non-existent lobby gracefully", () => {
      manager.markGameFinished("nonexistent");
    });
  });

  describe("getStats", () => {
    it("should return lobby statistics", () => {
      const stats = manager.getStats();
      
      assert.ok("waitingLobbies" in stats);
      assert.ok("activeGames" in stats);
      assert.ok("finishedGames" in stats);
      assert.ok("totalLobbies" in stats);
      assert.ok("totalPlayers" in stats);
      assert.ok("maxLobbies" in stats);
      assert.ok("maxActiveGames" in stats);
    });

    it("should count waiting lobbies", () => {
      manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host1");
      manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host2");
      
      const stats = manager.getStats();
      
      assert.strictEqual(stats.waitingLobbies, 2);
    });

    it("should count active games", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = manager.getLobby(lobbyId);
      lobby.expire();
      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      manager.setGame(lobbyId, game);
      
      const stats = manager.getStats();
      
      assert.strictEqual(stats.activeGames, 1);
    });

    it("should count total players", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      const lobby = manager.getLobby(lobbyId);
      lobby.addPlayer({ username: "player2" });
      
      const stats = manager.getStats();
      
      assert.strictEqual(stats.totalPlayers, 2);
    });
  });

  describe("stopCleanup", () => {
    it("should stop cleanup interval", () => {
      const mgr = new LobbyManager({
        CLEANUP_INTERVAL_MS: 100,
      });
      
      mgr.stopCleanup();
      assert.ok(true);
    });

    it("should be safe to call multiple times", () => {
      manager.stopCleanup();
      manager.stopCleanup();
      
      assert.ok(true);
    });
  });

  describe("getAllLobbies", () => {
    it("should return maxPlayers based on isFull status", () => {
      const fullLobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 2 }, "host1");
      const fullLobby = manager.getLobby(fullLobbyId);
      fullLobby.addPlayer({ username: "player2" });

      const openLobbyId = manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host2");

      const lobbies = manager.getAllLobbies();
      const full = lobbies.find(l => l.id === fullLobbyId);
      const open = lobbies.find(l => l.id === openLobbyId);

      assert.strictEqual(full.maxPlayers, 2);
      assert.strictEqual(full.isFull, true);
      assert.strictEqual(open.maxPlayers, 6);
      assert.strictEqual(open.isFull, false);
    });

    it("should sort lobbies by creation time (newest first)", () => {
      manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host1");
      manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host2");
      manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host3");

      const lobbies = manager.getAllLobbies();

      for (let i = 0; i < lobbies.length - 1; i++) {
        assert.ok(
          lobbies[i].createdAt >= lobbies[i + 1].createdAt,
          "Lobbies should be sorted by creation time (newest first)"
        );
      }
    });
  });

  describe("cleanup (internal)", () => {
    it("should remove empty lobbies when cleanup runs", async () => {
      const cleanupManager = new LobbyManager({
        CLEANUP_INTERVAL_MS: 50,
        LOBBY_IDLE_TIMEOUT_MS: 100000,
      });

      const lobbyId = cleanupManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      const lobby = cleanupManager.getLobby(lobbyId);

      lobby.removePlayer("host");
      assert.ok(lobby.isEmpty());

      await new Promise(resolve => setTimeout(resolve, 100));

      assert.strictEqual(cleanupManager.getLobby(lobbyId), undefined);
      cleanupManager.stopCleanup();
    });

    it("should remove idle waiting lobbies", async () => {
      const cleanupManager = new LobbyManager({
        CLEANUP_INTERVAL_MS: 50,
        LOBBY_IDLE_TIMEOUT_MS: 10,
      });

      const lobbyId = cleanupManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");

      await new Promise(resolve => setTimeout(resolve, 100));

      assert.strictEqual(cleanupManager.getLobby(lobbyId), undefined);
      cleanupManager.stopCleanup();
    });

    it("should remove finished games after retention period", async () => {
      const cleanupManager = new LobbyManager({
        CLEANUP_INTERVAL_MS: 50,
        FINISHED_GAME_RETENTION_MS: 10,
        LOBBY_IDLE_TIMEOUT_MS: 100000,
      });

      const lobbyId = cleanupManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = cleanupManager.getLobby(lobbyId);
      lobby.expire();

      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      cleanupManager.setGame(lobbyId, game);
      cleanupManager.markGameFinished(lobbyId);

      await new Promise(resolve => setTimeout(resolve, 100));

      assert.strictEqual(cleanupManager.getLobby(lobbyId), undefined);
      assert.strictEqual(cleanupManager.getGame(lobbyId), undefined);
      cleanupManager.stopCleanup();
    });

    it("should remove idle active games", async () => {
      const cleanupManager = new LobbyManager({
        CLEANUP_INTERVAL_MS: 50,
        GAME_IDLE_TIMEOUT_MS: 10,
        LOBBY_IDLE_TIMEOUT_MS: 100000,
      });

      const lobbyId = cleanupManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = cleanupManager.getLobby(lobbyId);
      lobby.expire();

      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      cleanupManager.setGame(lobbyId, game);

      await new Promise(resolve => setTimeout(resolve, 100));

      assert.strictEqual(cleanupManager.getGame(lobbyId), undefined);
      cleanupManager.stopCleanup();
    });

    it("should not remove active lobbies within idle timeout", async () => {
      const cleanupManager = new LobbyManager({
        CLEANUP_INTERVAL_MS: 50,
        LOBBY_IDLE_TIMEOUT_MS: 100000,
      });

      const lobbyId = cleanupManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");

      await new Promise(resolve => setTimeout(resolve, 100));

      assert.ok(cleanupManager.getLobby(lobbyId));
      cleanupManager.stopCleanup();
    });
  });

  describe("getStats edge cases", () => {
    it("should count expired lobby without game metadata as active", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = manager.getLobby(lobbyId);
      lobby.expire();

      const stats = manager.getStats();

      assert.strictEqual(stats.activeGames, 1);
      assert.strictEqual(stats.waitingLobbies, 0);
    });

    it("should count multiple states correctly", () => {
      manager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host1");

      const activeId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host2");
      const activeLobby = manager.getLobby(activeId);
      activeLobby.expire();
      const players1 = [new Player("host2")];
      const game1 = new Game(players1, x => x, createCorporations());
      manager.setGame(activeId, game1);

      const finishedId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host3");
      const finishedLobby = manager.getLobby(finishedId);
      finishedLobby.expire();
      const players2 = [new Player("host3")];
      const game2 = new Game(players2, x => x, createCorporations());
      manager.setGame(finishedId, game2);
      manager.markGameFinished(finishedId);

      const stats = manager.getStats();

      assert.strictEqual(stats.waitingLobbies, 1);
      assert.strictEqual(stats.activeGames, 1);
      assert.strictEqual(stats.finishedGames, 1);
      assert.strictEqual(stats.totalLobbies, 3);
      assert.strictEqual(stats.totalPlayers, 3);
    });
  });

  describe("deleteLobby edge cases", () => {
    it("should delete game metadata when deleting lobby", () => {
      const lobbyId = manager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = manager.getLobby(lobbyId);
      lobby.expire();
      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      manager.setGame(lobbyId, game);

      manager.deleteLobby(lobbyId);

      const stats = manager.getStats();
      assert.strictEqual(stats.activeGames, 0);
      assert.strictEqual(stats.totalLobbies, 0);
    });
  });
});
