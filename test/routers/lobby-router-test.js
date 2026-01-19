const assert = require("assert");
const request = require("supertest");
const { describe, it } = require("node:test");
const { createApp } = require("../../src/app");
const { createLobbiesRouter } = require("../../src/routers/lobbies-router");
const { createLobbyRouter } = require("../../src/routers/lobby-router");
const { createGameRouter } = require("../../src/routers/game-router");
const LobbyManager = require("../../src/models/lobby-manager");

const createTestApp = () => {
  const lobbyManager = new LobbyManager();
  const shuffle = x => x;
  const lobbiesRouter = createLobbiesRouter();
  const lobbyRouter = createLobbyRouter();
  const gameRouter = createGameRouter();
  const app = createApp(lobbiesRouter, lobbyRouter, gameRouter, { lobbyManager, shuffle });
  return { app, lobbyManager };
};

describe("GET /lobby/:lobbyId", () => {
  it("should serve the lobby page", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const username = "player";
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, username);

    request(app)
      .get(`/lobby/${lobbyId}`)
      .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
      .expect(200)
      .expect("content-type", new RegExp("text/html"))
      .end(done);
  });

  it("should not allow unauthorized access", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const username = "player";
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, username);

    request(app)
      .get(`/lobby/${lobbyId}`)
      .set("cookie", `username=abcd; lobbyId=${lobbyId}`)
      .expect(302)
      .expect("location", "/")
      .end(done);
  });

  it("should redirect if lobby does not exist", (_, done) => {
    const { app } = createTestApp();

    request(app)
      .get("/lobby/nonexistent")
      .set("cookie", "username=player; lobbyId=nonexistent")
      .expect(302)
      .expect("location", "/")
      .end(done);
  });
});

describe("POST /lobby/:lobbyId/players", () => {
  it("should add the player in the lobby", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const hostUsername = "host";
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, hostUsername);

    const username = "player";
    request(app)
      .post(`/lobby/${lobbyId}/players`)
      .send({ username })
      .expect(302)
      .expect("location", `/lobby/${lobbyId}`)
      .expect("set-cookie", new RegExp(`username=${username}`))
      .end(err => {
        const lobby = lobbyManager.getLobby(lobbyId);
        const players = lobby.status().players;
        const hasPlayer = players.some(p => p.username === username);
        assert.ok(hasPlayer);
        done(err);
      });
  });

  it("should not add player if the lobby is full", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const hostUsername = "host";
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, hostUsername);
    
    const lobby = lobbyManager.getLobby(lobbyId);
    lobby.addPlayer({ username: "player2" });

    request(app)
      .post(`/lobby/${lobbyId}/players`)
      .send({ username: "player3" })
      .expect(401)
      .expect({ error: "Lobby is full!" })
      .end(done);
  });
});

describe("POST /lobby/:lobbyId/players - edge cases", () => {
  it("should reject empty username", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, "host");

    request(app)
      .post(`/lobby/${lobbyId}/players`)
      .send({ username: "" })
      .expect(400)
      .end((err, res) => {
        assert.strictEqual(res.body.error, "Username is required");
        done(err);
      });
  });

  it("should reject whitespace-only username", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, "host");

    request(app)
      .post(`/lobby/${lobbyId}/players`)
      .send({ username: "   " })
      .expect(400)
      .end((err, res) => {
        assert.strictEqual(res.body.error, "Username is required");
        done(err);
      });
  });

  it("should reject missing username", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, "host");

    request(app)
      .post(`/lobby/${lobbyId}/players`)
      .send({})
      .expect(400)
      .end((err, res) => {
        assert.strictEqual(res.body.error, "Username is required");
        done(err);
      });
  });

  it("should reject duplicate username", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, "host");

    request(app)
      .post(`/lobby/${lobbyId}/players`)
      .send({ username: "host" })
      .expect(400)
      .end((err, res) => {
        assert.strictEqual(res.body.error, "Username already taken in this lobby");
        done(err);
      });
  });

  it("should trim username before adding", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, "host");

    request(app)
      .post(`/lobby/${lobbyId}/players`)
      .send({ username: "  player  " })
      .expect(302)
      .expect("set-cookie", /username=player/)
      .end(done);
  });
});

describe("POST /lobby/:lobbyId/leave", () => {
  it("should allow player to leave lobby", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
    const lobby = lobbyManager.getLobby(lobbyId);
    lobby.addPlayer({ username: "player2" });

    request(app)
      .post(`/lobby/${lobbyId}/leave`)
      .set("cookie", `username=player2; lobbyId=${lobbyId}`)
      .expect(200)
      .end((err, res) => {
        assert.strictEqual(res.body.success, true);
        const updatedLobby = lobbyManager.getLobby(lobbyId);
        assert.strictEqual(updatedLobby.playerCount, 1);
        done(err);
      });
  });

  it("should delete lobby when last player leaves", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");

    request(app)
      .post(`/lobby/${lobbyId}/leave`)
      .set("cookie", `username=host; lobbyId=${lobbyId}`)
      .expect(200)
      .end((err, res) => {
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(lobbyManager.getLobby(lobbyId), undefined);
        done(err);
      });
  });

  it("should not allow leaving after game has started", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, "host");
    const lobby = lobbyManager.getLobby(lobbyId);
    lobby.expire();

    request(app)
      .post(`/lobby/${lobbyId}/leave`)
      .set("cookie", `username=host; lobbyId=${lobbyId}`)
      .expect(400)
      .end((err, res) => {
        assert.strictEqual(res.body.error, "Cannot leave after game has started");
        done(err);
      });
  });

  it("should clear cookies when leaving", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");
    const lobby = lobbyManager.getLobby(lobbyId);
    lobby.addPlayer({ username: "player2" });

    request(app)
      .post(`/lobby/${lobbyId}/leave`)
      .set("cookie", `username=player2; lobbyId=${lobbyId}`)
      .expect(200)
      .expect("set-cookie", /username=;/)
      .end(done);
  });

  it("should redirect unauthorized users", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, "host");

    request(app)
      .post(`/lobby/${lobbyId}/leave`)
      .set("cookie", `username=stranger; lobbyId=${lobbyId}`)
      .expect(302)
      .expect("location", "/")
      .end(done);
  });
});

describe("GET /lobby/:lobbyId/status", () => {
  it("should provide fields to determine whether or not to start the game.", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const username = "player";
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, username);

    request(app)
      .get(`/lobby/${lobbyId}/status`)
      .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
      .expect(200)
      .expect("content-type", new RegExp("application/json"))
      .end((err, res) => {
        assert.ok(res.body.players);
        assert.ok(res.body.host);
        assert.strictEqual(res.body.hasExpired, false);
        done(err);
      });
  });

  it("should not allow if the player is not a member of the lobby", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const username = "player";
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, username);

    request(app)
      .get(`/lobby/${lobbyId}/status`)
      .set("cookie", `username=stranger; lobbyId=${lobbyId}`)
      .expect(302)
      .expect("location", "/")
      .end(done);
  });

  it("should include lobbyId in response", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const username = "player";
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, username);

    request(app)
      .get(`/lobby/${lobbyId}/status`)
      .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
      .expect(200)
      .end((err, res) => {
        assert.strictEqual(res.body.lobbyId, lobbyId);
        done(err);
      });
  });

  it("should include self in response for the requesting user", (_, done) => {
    const { app, lobbyManager } = createTestApp();
    const username = "player";
    const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, username);

    request(app)
      .get(`/lobby/${lobbyId}/status`)
      .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
      .expect(200)
      .end((err, res) => {
        assert.deepStrictEqual(res.body.self, { username });
        done(err);
      });
  });
});
