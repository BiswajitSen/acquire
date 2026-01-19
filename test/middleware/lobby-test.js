const assert = require("assert");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { resolveLobby, authorizeLobbyMember } = require("../../src/middleware/lobby");
const LobbyManager = require("../../src/models/lobby-manager");

describe("Lobby Middleware", () => {
  let lobbyManager;

  beforeEach(() => {
    lobbyManager = new LobbyManager({
      CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
    });
  });

  afterEach(() => {
    if (lobbyManager) {
      lobbyManager.stopCleanup();
    }
  });

  describe("resolveLobby", () => {
    it("should attach lobby to request when lobbyId is in params", () => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");

      const req = {
        app: { context: { lobbyManager } },
        params: { lobbyId },
        cookies: {},
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      resolveLobby(req, res, next);

      assert.ok(req.lobby);
      assert.strictEqual(req.lobbyId, lobbyId);
      assert.ok(nextCalled);
    });

    it("should attach lobby to request when lobbyId is in cookies", () => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");

      const req = {
        app: { context: { lobbyManager } },
        params: {},
        cookies: { lobbyId },
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      resolveLobby(req, res, next);

      assert.ok(req.lobby);
      assert.strictEqual(req.lobbyId, lobbyId);
      assert.ok(nextCalled);
    });

    it("should prefer params.lobbyId over cookies.lobbyId", () => {
      const lobbyId1 = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host1");
      const lobbyId2 = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host2");

      const req = {
        app: { context: { lobbyManager } },
        params: { lobbyId: lobbyId1 },
        cookies: { lobbyId: lobbyId2 },
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      resolveLobby(req, res, next);

      assert.strictEqual(req.lobbyId, lobbyId1);
      assert.ok(nextCalled);
    });

    it("should redirect to / when no lobbyId provided", () => {
      const req = {
        app: { context: { lobbyManager } },
        params: {},
        cookies: {},
      };
      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      resolveLobby(req, res, next);

      assert.strictEqual(redirectedTo, "/");
      assert.ok(!nextCalled);
    });

    it("should redirect to / when lobby does not exist", () => {
      const req = {
        app: { context: { lobbyManager } },
        params: { lobbyId: "nonexistent" },
        cookies: {},
      };
      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      resolveLobby(req, res, next);

      assert.strictEqual(redirectedTo, "/");
      assert.ok(!nextCalled);
    });

    it("should attach game to request when game exists", () => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.expire();

      const { Game } = require("../../src/models/game");
      const { Player } = require("../../src/models/player");
      const { createCorporations } = require("../../src/models/corporation");
      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      lobbyManager.setGame(lobbyId, game);

      const req = {
        app: { context: { lobbyManager } },
        params: { lobbyId },
        cookies: {},
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      resolveLobby(req, res, next);

      assert.ok(req.game);
      assert.strictEqual(req.game, game);
      assert.ok(nextCalled);
    });

    it("should set game to undefined when no game exists", () => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");

      const req = {
        app: { context: { lobbyManager } },
        params: { lobbyId },
        cookies: {},
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      resolveLobby(req, res, next);

      assert.strictEqual(req.game, undefined);
      assert.ok(nextCalled);
    });
  });

  describe("authorizeLobbyMember", () => {
    it("should call next() when user is a member of the lobby", () => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "testUser");
      const lobby = lobbyManager.getLobby(lobbyId);

      const req = {
        lobby,
        cookies: { username: "testUser" },
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authorizeLobbyMember(req, res, next);

      assert.ok(nextCalled);
    });

    it("should redirect to / when user is not a member", () => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      const lobby = lobbyManager.getLobby(lobbyId);

      const req = {
        lobby,
        cookies: { username: "stranger" },
      };
      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authorizeLobbyMember(req, res, next);

      assert.strictEqual(redirectedTo, "/");
      assert.ok(!nextCalled);
    });

    it("should redirect when username cookie is missing", () => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      const lobby = lobbyManager.getLobby(lobbyId);

      const req = {
        lobby,
        cookies: {},
      };
      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authorizeLobbyMember(req, res, next);

      assert.strictEqual(redirectedTo, "/");
      assert.ok(!nextCalled);
    });

    it("should allow any member of the lobby", () => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: "player2" });
      lobby.addPlayer({ username: "player3" });

      const members = ["host", "player2", "player3"];
      
      members.forEach(username => {
        const req = {
          lobby,
          cookies: { username },
        };
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        authorizeLobbyMember(req, {}, next);

        assert.ok(nextCalled, `Should allow member: ${username}`);
      });
    });

    it("should not allow non-members even with similar usernames", () => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      const lobby = lobbyManager.getLobby(lobbyId);

      const invalidUsernames = ["Host", "HOST", "host ", " host", "host1"];
      
      invalidUsernames.forEach(username => {
        const req = {
          lobby,
          cookies: { username },
        };
        let redirectedTo = null;
        const res = {
          redirect: (url) => { redirectedTo = url; },
        };
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        authorizeLobbyMember(req, res, next);

        assert.ok(!nextCalled, `Should not allow: ${username}`);
        assert.strictEqual(redirectedTo, "/");
      });
    });
  });
});
