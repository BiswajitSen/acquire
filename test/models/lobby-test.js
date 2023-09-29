const assert = require("assert");
const { describe, it } = require("node:test");
const Lobby = require("../../src/models/lobby");

describe("Lobby", () => {
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
