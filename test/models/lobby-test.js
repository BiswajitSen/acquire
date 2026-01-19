const assert = require("assert");
const { describe, it } = require("node:test");
const Lobby = require("../../src/models/lobby");

describe("Lobby", () => {
  describe("constructor", () => {
    it("should create an empty lobby with given size", () => {
      const size = { lowerLimit: 2, upperLimit: 4 };
      const lobby = new Lobby(size);

      assert.strictEqual(lobby.playerCount, 0);
      assert.ok(lobby.isEmpty());
      assert.ok(!lobby.isFull());
    });

    it("should set createdAt timestamp", () => {
      const before = Date.now();
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      const after = Date.now();

      assert.ok(lobby.createdAt >= before);
      assert.ok(lobby.createdAt <= after);
    });

    it("should set lastActivityAt timestamp", () => {
      const before = Date.now();
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      const after = Date.now();

      assert.ok(lobby.lastActivityAt >= before);
      assert.ok(lobby.lastActivityAt <= after);
    });
  });

  describe("status", () => {
    it("should get the lobby status", () => {
      const size = { lowerLimit: 3, upperLimit: 3 };
      const lobby = new Lobby(size);
      const expectedStatus = {
        players: [],
        isFull: false,
        hasExpired: false,
        isPossibleToStartGame: false,
        host: undefined,
        self: undefined,
      };

      assert.deepEqual(lobby.status(), expectedStatus);
    });

    it("should return self when username matches a player", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "player1" });
      lobby.addPlayer({ username: "player2" });

      const status = lobby.status("player2");

      assert.deepStrictEqual(status.self, { username: "player2" });
    });

    it("should return undefined self when username does not match", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "player1" });

      const status = lobby.status("stranger");

      assert.strictEqual(status.self, undefined);
    });

    it("should return undefined self when no username provided", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "player1" });

      const status = lobby.status();

      assert.strictEqual(status.self, undefined);
    });

    it("should return host as first player", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "host" });
      lobby.addPlayer({ username: "player2" });

      const status = lobby.status();

      assert.deepStrictEqual(status.host, { username: "host" });
    });

    it("should return copies of players (not references)", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      const player = { username: "player1", data: "test" };
      lobby.addPlayer(player);

      const status1 = lobby.status();
      const status2 = lobby.status();

      assert.notStrictEqual(status1.players[0], status2.players[0]);
    });
  });

  describe("addPlayer", () => {
    it("should add a player to the lobby", () => {
      const size = { lowerLimit: 3, upperLimit: 3 };
      const lobby = new Lobby(size);
      const username = "player";
      const player = { username };

      lobby.addPlayer(player);

      assert.deepStrictEqual(lobby.status("player").players, [player]);
    });

    it("should update lastActivityAt when adding player", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      const initialActivity = lobby.lastActivityAt;

      lobby.addPlayer({ username: "player1" });

      assert.ok(lobby.lastActivityAt >= initialActivity);
    });

    it("should increment playerCount", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });

      assert.strictEqual(lobby.playerCount, 0);
      lobby.addPlayer({ username: "player1" });
      assert.strictEqual(lobby.playerCount, 1);
      lobby.addPlayer({ username: "player2" });
      assert.strictEqual(lobby.playerCount, 2);
    });
  });

  describe("removePlayer", () => {
    it("should remove a player from the lobby", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "player1" });
      lobby.addPlayer({ username: "player2" });

      const result = lobby.removePlayer("player1");

      assert.strictEqual(result, true);
      assert.strictEqual(lobby.playerCount, 1);
      assert.strictEqual(lobby.status().players[0].username, "player2");
    });

    it("should return false when player not found", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "player1" });

      const result = lobby.removePlayer("nonexistent");

      assert.strictEqual(result, false);
      assert.strictEqual(lobby.playerCount, 1);
    });

    it("should update lastActivityAt when removing player", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "player1" });
      const initialActivity = lobby.lastActivityAt;

      lobby.removePlayer("player1");

      assert.ok(lobby.lastActivityAt >= initialActivity);
    });

    it("should make lobby empty when last player removed", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "player1" });

      lobby.removePlayer("player1");

      assert.ok(lobby.isEmpty());
    });

    it("should update host when host is removed", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "host" });
      lobby.addPlayer({ username: "player2" });

      lobby.removePlayer("host");

      assert.strictEqual(lobby.status().host.username, "player2");
    });
  });

  describe("isEmpty", () => {
    it("should return true for empty lobby", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });

      assert.ok(lobby.isEmpty());
    });

    it("should return false when lobby has players", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "player1" });

      assert.ok(!lobby.isEmpty());
    });
  });

  describe("playerCount", () => {
    it("should return 0 for empty lobby", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });

      assert.strictEqual(lobby.playerCount, 0);
    });

    it("should return correct count after adding players", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 4 });
      lobby.addPlayer({ username: "player1" });
      lobby.addPlayer({ username: "player2" });
      lobby.addPlayer({ username: "player3" });

      assert.strictEqual(lobby.playerCount, 3);
    });
  });

  describe("isPossibleToStartGame", () => {
    it("should return false when below lower limit", () => {
      const lobby = new Lobby({ lowerLimit: 3, upperLimit: 6 });
      lobby.addPlayer({ username: "player1" });
      lobby.addPlayer({ username: "player2" });

      assert.strictEqual(lobby.status().isPossibleToStartGame, false);
    });

    it("should return true when at lower limit", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 6 });
      lobby.addPlayer({ username: "player1" });
      lobby.addPlayer({ username: "player2" });

      assert.strictEqual(lobby.status().isPossibleToStartGame, true);
    });

    it("should return true when above lower limit", () => {
      const lobby = new Lobby({ lowerLimit: 2, upperLimit: 6 });
      lobby.addPlayer({ username: "player1" });
      lobby.addPlayer({ username: "player2" });
      lobby.addPlayer({ username: "player3" });

      assert.strictEqual(lobby.status().isPossibleToStartGame, true);
    });
  });

  describe("isFull", () => {
    it("should not be full when lobby is empty", () => {
      const size = { lowerLimit: 3, upperLimit: 3 };
      const lobby = new Lobby(size);

      assert.strictEqual(lobby.isFull(), false);
    });

    it("should not be full when lobby has less than maximum lobby size", () => {
      const size = { lowerLimit: 3, upperLimit: 3 };
      const lobby = new Lobby(size);
      const username1 = "player1";
      const username2 = "player2";
      const player1 = { username: username1 };
      const player2 = { username: username2 };

      lobby.addPlayer(player1);
      lobby.addPlayer(player2);

      assert.strictEqual(lobby.isFull(), false);
    });

    it("should be full if player count is same as max lobby size", () => {
      const size = { lowerLimit: 2, upperLimit: 2 };
      const lobby = new Lobby(size);
      const username1 = "player1";
      const username2 = "player2";
      const player1 = { username: username1 };
      const player2 = { username: username2 };

      lobby.addPlayer(player1);
      lobby.addPlayer(player2);

      assert.ok(lobby.isFull());
    });

    describe("expire", () => {
      it("should mark the lobby as expired", () => {
        const size = { lowerLimit: 2, upperLimit: 2 };
        const lobby = new Lobby(size);
        const username1 = "player1";
        const username2 = "player2";

        const player1 = { username: username1 };
        const player2 = { username: username2 };

        lobby.addPlayer(player1);
        lobby.addPlayer(player2);
        lobby.expire();

        const expectedLobbyStatus = {
          players: [player1, player2],
          isFull: true,
          hasExpired: true,
          isPossibleToStartGame: true,
          host: player1,
          self: player1,
        };

        assert.deepStrictEqual(lobby.status("player1"), expectedLobbyStatus);
      });
    });
  });
});
