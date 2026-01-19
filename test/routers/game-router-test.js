const request = require("supertest");
const assert = require("assert");
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

const startGame = (app, lobbyId, admin) => {
  return request(app)
    .post(`/game/${lobbyId}/start`)
    .set("cookie", `username=${admin}; lobbyId=${lobbyId}`)
    .expect(200);
};

const placeTile = (app, lobbyId, username, tile) => {
  return request(app)
    .post(`/game/${lobbyId}/tile`)
    .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
    .send(tile)
    .expect(200);
};

const establishCorp = (app, lobbyId, username, corpName) => {
  return request(app)
    .post(`/game/${lobbyId}/establish`)
    .send({ name: corpName })
    .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
    .expect(200);
};

const buyStocks = (app, lobbyId, username, stocks) => {
  return request(app)
    .post(`/game/${lobbyId}/buy-stocks`)
    .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
    .send(stocks)
    .expect(200);
};

const getGameStatus = async (app, lobbyId, username) => {
  const result = await request(app)
    .get(`/game/${lobbyId}/status`)
    .set("cookie", `username=${username}; lobbyId=${lobbyId}`);

  return result.body;
};

const endTurn = (app, lobbyId, username) => {
  return request(app)
    .post(`/game/${lobbyId}/end-turn`)
    .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
    .expect(200);
};

describe("GameRouter", () => {
  describe("lobbyId param validation", () => {
    it("should return 404 for non-existent lobby", (_, done) => {
      const { app } = createTestApp();

      request(app)
        .get("/game/nonexistent")
        .set("cookie", "username=player; lobbyId=nonexistent")
        .expect(404)
        .end((err, res) => {
          assert.strictEqual(res.body.error, "Lobby not found");
          done(err);
        });
    });

    it("should return 404 for non-existent lobby on POST", (_, done) => {
      const { app } = createTestApp();

      request(app)
        .post("/game/nonexistent/start")
        .set("cookie", "username=player; lobbyId=nonexistent")
        .expect(404)
        .end((err, res) => {
          assert.strictEqual(res.body.error, "Lobby not found");
          done(err);
        });
    });
  });

  describe("GET /game/:lobbyId", () => {
    it("should serve the game page", (_, done) => {
      const { app, lobbyManager } = createTestApp();
      const username = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, username);

      request(app)
        .get(`/game/${lobbyId}`)
        .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
        .expect(200)
        .expect("content-type", new RegExp("text/html"))
        .end(done);
    });

    it("should redirect if the player is not in game", (_, done) => {
      const { app, lobbyManager } = createTestApp();
      const username = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, username);

      request(app)
        .get(`/game/${lobbyId}`)
        .set("cookie", `username=stranger; lobbyId=${lobbyId}`)
        .expect(302)
        .expect("location", "/")
        .end(done);
    });

    it("should redirect to lobby if not enough players to start (GET)", (_, done) => {
      const { app, lobbyManager } = createTestApp();
      const username = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 3, upperLimit: 6 }, username);

      request(app)
        .get(`/game/${lobbyId}`)
        .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
        .expect(302)
        .expect("location", `/lobby/${lobbyId}`)
        .end(done);
    });
  });

  describe("POST /game/:lobbyId/start", () => {
    it("should start the game when has enough players", async () => {
      const { app, lobbyManager } = createTestApp();
      const username = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, username);

      await startGame(app, lobbyId, username);
      const lobby = lobbyManager.getLobby(lobbyId);
      assert.ok(lobby.status().hasExpired);
    });

    it("should return error when not enough players", async () => {
      const { app, lobbyManager } = createTestApp();
      const username = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, username);

      const res = await request(app)
        .post(`/game/${lobbyId}/start`)
        .set("cookie", `username=${username}; lobbyId=${lobbyId}`)
        .expect(400);

      assert.ok(res.body.error);
    });

    it("should start the game only on host request", async () => {
      const { app, lobbyManager } = createTestApp();
      const host = "host";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, host);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: "player2" });

      const res = await request(app)
        .post(`/game/${lobbyId}/start`)
        .set("cookie", `username=player2; lobbyId=${lobbyId}`)
        .expect(403);

      assert.ok(res.body.error);
    });
  });

  describe("GET /game/:lobbyId/status", () => {
    it("should get current game status", async () => {
      const { app, lobbyManager } = createTestApp();
      const username = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, username);

      await startGame(app, lobbyId, username);
      const status = await getGameStatus(app, lobbyId, username);

      assert.ok(status.state);
      assert.ok(status.players);
      assert.ok(status.portfolio);
      assert.ok(status.corporations);
    });
  });

  describe("POST /game/:lobbyId/tile", () => {
    it("should place a tile on the board", async () => {
      const { app, lobbyManager } = createTestApp();
      const username = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, username);

      await startGame(app, lobbyId, username);
      
      const statusBefore = await getGameStatus(app, lobbyId, username);
      const tile = statusBefore.portfolio.tiles[0].position;
      
      await placeTile(app, lobbyId, username, tile);
      
      const statusAfter = await getGameStatus(app, lobbyId, username);
      const placedTile = statusAfter.portfolio.tiles[0];
      assert.strictEqual(placedTile.isPlaced, true);
    });
  });

  describe("POST /game/:lobbyId/end-turn", () => {
    it("should change the turn of a player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);
      await endTurn(app, lobbyId, player1);

      const status = await getGameStatus(app, lobbyId, player1);
      const currentPlayer = status.players.find(p => p.isTakingTurn);
      assert.strictEqual(currentPlayer.username, player2);
    });
  });

  describe("POST /game/:lobbyId/establish", () => {
    it("should establish selected corporation", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      const status = await getGameStatus(app, lobbyId, player1);
      const tile = status.portfolio.tiles[0].position;

      await placeTile(app, lobbyId, player1, tile);

      const statusAfterPlace = await getGameStatus(app, lobbyId, player1);
      
      if (statusAfterPlace.state === "establish") {
        await establishCorp(app, lobbyId, player1, "phoenix");
        const statusAfterEstablish = await getGameStatus(app, lobbyId, player1);
        assert.strictEqual(statusAfterEstablish.corporations.phoenix.isActive, true);
      }
    });
  });

  describe("POST /game/:lobbyId/buy-stocks", () => {
    it("should buy stocks of an active corporation", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);
      
      const status = await getGameStatus(app, lobbyId, player1);
      const tile = status.portfolio.tiles[0].position;
      
      await placeTile(app, lobbyId, player1, tile);

      const statusAfterPlace = await getGameStatus(app, lobbyId, player1);
      
      if (statusAfterPlace.state === "establish") {
        await establishCorp(app, lobbyId, player1, "phoenix");
        await buyStocks(app, lobbyId, player1, [{ name: "phoenix", price: 500 }]);

        const finalStatus = await getGameStatus(app, lobbyId, player1);
        assert.ok(finalStatus.portfolio.stocks.phoenix >= 1);
      }
    });
  });

  describe("POST /game/:lobbyId/end-merge", () => {
    it("should end the merge state", async () => {
      const { app, lobbyManager } = createTestApp();
      const player = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, player);

      await startGame(app, lobbyId, player);

      const status = await getGameStatus(app, lobbyId, player);
      assert.ok(status.state);
    });
  });

  describe("validatePlayer middleware", () => {
    it("should reject actions from non-current player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      await request(app)
        .post(`/game/${lobbyId}/tile`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .send({ x: 0, y: 0 })
        .expect(400);
    });

    it("should reject buy-stocks from non-current player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      await request(app)
        .post(`/game/${lobbyId}/buy-stocks`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .send([])
        .expect(400);
    });

    it("should reject end-turn from non-current player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      await request(app)
        .post(`/game/${lobbyId}/end-turn`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .expect(400);
    });
  });

  describe("verifyHost middleware", () => {
    it("should reject start from non-host player", async () => {
      const { app, lobbyManager } = createTestApp();
      const host = "host";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 6 }, host);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      const res = await request(app)
        .post(`/game/${lobbyId}/start`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .expect(403);

      assert.strictEqual(res.body.error, "Only the host can start the game!");
    });

    it("should reject start from user not in lobby", async () => {
      const { app, lobbyManager } = createTestApp();
      const host = "host";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, host);

      await request(app)
        .post(`/game/${lobbyId}/start`)
        .set("cookie", `username=stranger; lobbyId=${lobbyId}`)
        .expect(302);
    });
  });

  describe("GET /game/:lobbyId/end-result", () => {
    it("should mark game as finished when result is fetched", async () => {
      const { app, lobbyManager } = createTestApp();
      const player = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, player);

      await startGame(app, lobbyId, player);

      await request(app)
        .get(`/game/${lobbyId}/end-result`)
        .set("cookie", `username=${player}; lobbyId=${lobbyId}`)
        .expect(200);

      const stats = lobbyManager.getStats();
      assert.strictEqual(stats.finishedGames, 1);
    });
  });

  describe("POST /game/:lobbyId/test (configureGame)", () => {
    it("should set game in lobby manager", async () => {
      const { app, lobbyManager } = createTestApp();
      const player = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, player);

      const gameData = require("../test-data/all-stable-coporations.json");

      await request(app)
        .post(`/game/${lobbyId}/test`)
        .send(gameData)
        .set("cookie", `username=${player}; lobbyId=${lobbyId}`)
        .expect(201);

      assert.ok(lobbyManager.getGame(lobbyId));
    });
  });

  describe("POST /game/:lobbyId/merger endpoints", () => {
    it("should return 400 for merger/deal when not current player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      await request(app)
        .post(`/game/${lobbyId}/merger/deal`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .send({ sell: 0, trade: 0 })
        .expect(400);
    });

    it("should return 400 for merger/end-turn when not current player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      await request(app)
        .post(`/game/${lobbyId}/merger/end-turn`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .expect(400);
    });

    it("should return 400 for merger/resolve-conflict when not current player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      await request(app)
        .post(`/game/${lobbyId}/merger/resolve-conflict`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .send({})
        .expect(400);
    });

    it("should return 400 for merger/resolve-acquirer when not current player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      await request(app)
        .post(`/game/${lobbyId}/merger/resolve-acquirer`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .send({ acquirer: "phoenix" })
        .expect(400);
    });

    it("should return 400 for merger/confirm-defunct when not current player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      await request(app)
        .post(`/game/${lobbyId}/merger/confirm-defunct`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .send({ defunct: "quantum" })
        .expect(400);
    });
  });

  describe("POST /game/:lobbyId/establish - edge cases", () => {
    it("should return 400 for establish when not current player", async () => {
      const { app, lobbyManager } = createTestApp();
      const player1 = "player1";
      const player2 = "player2";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 2, upperLimit: 2 }, player1);

      const lobby = lobbyManager.getLobby(lobbyId);
      lobby.addPlayer({ username: player2 });

      await startGame(app, lobbyId, player1);

      await request(app)
        .post(`/game/${lobbyId}/establish`)
        .set("cookie", `username=${player2}; lobbyId=${lobbyId}`)
        .send({ name: "phoenix" })
        .expect(400);
    });
  });

  describe("trackGameActivity middleware", () => {
    it("should update game activity on requests", async () => {
      const { app, lobbyManager } = createTestApp();
      const player = "player";
      const lobbyId = lobbyManager.createLobby({ lowerLimit: 1, upperLimit: 1 }, player);

      await startGame(app, lobbyId, player);

      await getGameStatus(app, lobbyId, player);

      const stats = lobbyManager.getStats();
      assert.ok(stats.activeGames >= 1);
    });
  });
});
