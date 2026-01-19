const assert = require("assert");
const request = require("supertest");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { createTestApp } = require("../test-helpers");

describe("LobbiesRouter", () => {
  let app;
  let lobbyManager;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    lobbyManager = testApp.lobbyManager;
  });

  afterEach(() => {
    if (lobbyManager) {
      lobbyManager.stopCleanup();
    }
  });

  describe("GET /", () => {
    it("should serve the home page", (_, done) => {
      request(app)
        .get("/")
        .expect(200)
        .expect("content-type", /text\/html/)
        .end(done);
    });
  });

  describe("GET /list", () => {
    it("should return empty list when no lobbies", (_, done) => {
      request(app)
        .get("/list")
        .expect(200)
        .expect("content-type", /application\/json/)
        .end((err, res) => {
          assert.deepStrictEqual(res.body, { lobbies: [] });
          done(err);
        });
    });

    it("should return list of available lobbies", (_, done) => {
      lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host1");
      lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 4 }, "host2");

      request(app)
        .get("/list")
        .expect(200)
        .end((err, res) => {
          assert.strictEqual(res.body.lobbies.length, 2);
          done(err);
        });
    });

    it("should include lobby metadata", (_, done) => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "testHost");

      request(app)
        .get("/list")
        .expect(200)
        .end((err, res) => {
          const lobby = res.body.lobbies.find(l => l.id === lobbyId);
          assert.ok(lobby);
          assert.strictEqual(lobby.host, "testHost");
          assert.strictEqual(lobby.playerCount, 1);
          assert.strictEqual(lobby.maxPlayers, 6);
          done(err);
        });
    });

    it("should not include expired lobbies", (_, done) => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.expire();

      request(app)
        .get("/list")
        .expect(200)
        .end((err, res) => {
          assert.deepStrictEqual(res.body.lobbies, []);
          done(err);
        });
    });
  });

  describe("POST /host", () => {
    it("should create a new lobby", (_, done) => {
      request(app)
        .post("/host")
        .send({ username: "newHost" })
        .expect(201)
        .expect("content-type", /application\/json/)
        .end((err, res) => {
          assert.ok(res.body.lobbyId);
          done(err);
        });
    });

    it("should set username cookie", (_, done) => {
      request(app)
        .post("/host")
        .send({ username: "testUser" })
        .expect(201)
        .expect("set-cookie", /username=testUser/)
        .end(done);
    });

    it("should set lobbyId cookie", (_, done) => {
      request(app)
        .post("/host")
        .send({ username: "testUser" })
        .expect(201)
        .expect("set-cookie", /lobbyId=/)
        .end(done);
    });

    it("should reject empty username", (_, done) => {
      request(app)
        .post("/host")
        .send({ username: "" })
        .expect(400)
        .end((err, res) => {
          assert.ok(res.body.error);
          done(err);
        });
    });

    it("should reject missing username", (_, done) => {
      request(app)
        .post("/host")
        .send({})
        .expect(400)
        .end((err, res) => {
          assert.ok(res.body.error);
          done(err);
        });
    });

    it("should reject whitespace-only username", (_, done) => {
      request(app)
        .post("/host")
        .send({ username: "   " })
        .expect(400)
        .end(done);
    });

    it("should trim username", (_, done) => {
      request(app)
        .post("/host")
        .send({ username: "  trimmed  " })
        .expect(201)
        .expect("set-cookie", /username=trimmed/)
        .end(done);
    });

    it("should return 503 when max lobbies reached", (_, done) => {
      lobbyManager.stopCleanup();
      
      const smallManager = require("../../src/models/lobby-manager");
      const customLobbyManager = new smallManager({
        MAX_LOBBIES: 2,
        CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
      });
      
      const { createApp } = require("../../src/app");
      const { createLobbiesRouter } = require("../../src/routers/lobbies-router");
      const { createLobbyRouter } = require("../../src/routers/lobby-router");
      const { createGameRouter } = require("../../src/routers/game-router");
      
      const customApp = createApp(
        createLobbiesRouter(),
        createLobbyRouter(),
        createGameRouter(),
        { lobbyManager: customLobbyManager, shuffle: x => x }
      );

      customLobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host1");
      customLobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host2");

      request(customApp)
        .post("/host")
        .send({ username: "tooMany" })
        .expect(503)
        .end((err, res) => {
          customLobbyManager.stopCleanup();
          assert.ok(res.body.error);
          done(err);
        });
    });
  });

  describe("GET /stats", () => {
    it("should return server statistics", (_, done) => {
      request(app)
        .get("/stats")
        .expect(200)
        .expect("content-type", /application\/json/)
        .end((err, res) => {
          assert.ok("waitingLobbies" in res.body);
          assert.ok("activeGames" in res.body);
          assert.ok("totalLobbies" in res.body);
          assert.ok("totalPlayers" in res.body);
          done(err);
        });
    });

    it("should return correct waiting lobbies count", (_, done) => {
      lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host1");
      lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host2");

      request(app)
        .get("/stats")
        .expect(200)
        .end((err, res) => {
          assert.strictEqual(res.body.waitingLobbies, 2);
          done(err);
        });
    });

    it("should return correct active games count", (_, done) => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.expire();

      const { Game } = require("../../src/models/game");
      const { Player } = require("../../src/models/player");
      const { createCorporations } = require("../../src/models/corporation");
      const players = [new Player("host")];
      const game = new Game(players, x => x, createCorporations());
      lobbyManager.setGame(lobbyId, game);

      request(app)
        .get("/stats")
        .expect(200)
        .end((err, res) => {
          assert.strictEqual(res.body.activeGames, 1);
          done(err);
        });
    });

    it("should return correct total players count", (_, done) => {
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: "player2" });
      lobby.addPlayer({ username: "player3" });

      request(app)
        .get("/stats")
        .expect(200)
        .end((err, res) => {
          assert.strictEqual(res.body.totalPlayers, 3);
          done(err);
        });
    });
  });
});
