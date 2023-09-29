const request = require("supertest");
const assert = require("assert");
const chai = require("chai");
const { describe, it } = require("node:test");
const { createApp } = require("../../src/app");
const { createLobbyRouter } = require("../../src/routers/lobby-router");
const { createGameRouter } = require("../../src/routers/game-router");
const Lobby = require("../../src/models/lobby");
const gameEndData = require("../test-data/all-stable-coporations.json");
const mergerRound = require("../test-data/merger-round.json");
const multipleMergeTwoAcquirer = require("../test-data/merging-three-two-equal-acquirer.json");
const multipleMergeThreeAllEqual = require("../test-data/merging-three-all-equal.json");

const joinPlayer = (app, username) => {
  return request(app)
    .post("/lobby/players")
    .send({ username })
    .expect(302)
    .expect("location", "/lobby");
};

const startGame = (app, admin) => {
  return request(app)
    .post("/game/start")
    .set("cookie", `username=${admin}`)
    .expect(200);
};

const placeTile = (app, username, tile) => {
  return request(app)
    .post("/game/tile")
    .set("cookie", `username=${username}`)
    .send(tile)
    .expect(200);
};

const loadGame = (app, username, gameData) => {
  return request(app)
    .post("/game/test")
    .send(gameData)
    .set("cookie", `username=${username}`)
    .expect(201);
};

const establishCorp = (app, username, corpName) => {
  return request(app)
    .post("/game/establish")
    .send({ name: corpName })
    .set("cookie", `username=${username}`)
    .expect(200);
};

const buyStocks = (app, username, stocks) => {
  return request(app)
    .post("/game/buy-stocks")
    .set("cookie", `username=${username}`)
    .send(stocks)
    .expect(200);
};

const getGameStatus = async (app, username) => {
  const result = await request(app)
    .get("/game/status")
    .set("cookie", `username=${username}`);

  return result.body;
};

const endMerge = (app, username) => {
  return request(app)
    .post("/game/end-merge")
    .set("cookie", `username=${username}`)
    .expect(200);
};

const resolveConflict = (app, username, body) => {
  return request(app)
    .post("/game/merger/resolve-conflict")
    .set("cookie", `username=${username}`)
    .send(body)
    .expect(200);
};

const endTurn = (app, username) => {
  return request(app)
    .post("/game/end-turn")
    .set("cookie", `username=${username}`)
    .expect(200);
};

const dealDefunctStocks = (app, username, cart) => {
  return request(app)
    .post("/game/merger/deal")
    .send(cart)
    .set("cookie", `username=${username}`)
    .expect(200);
};

const endMergerTurn = (app, username) => {
  return request(app)
    .post("/game/merger/end-turn")
    .set("cookie", `username=${username}`)
    .expect(200);
};

const badRequest = (app, username, url) => {
  return request(app)
    .post(url)
    .set("cookie", `username=${username}`)
    .expect(400);
};

const gameResult = async (app, username) => {
  const result = await request(app)
    .get("/game/end-result")
    .set("cookie", `username=${username}`)
    .expect(200);

  return result.body;
};

const selectAcquirer = async (app, username, acquirer) => {
  return request(app)
    .post("/game/merger/resolve-acquirer")
    .set("cookie", `username=${username}`)
    .send({ acquirer })
    .expect(200);
};

const selectDefunct = async (app, username, defunct) => {
  return request(app)
    .post("/game/merger/confirm-defunct")
    .set("cookie", `username=${username}`)
    .send({ defunct })
    .expect(200);
};

describe("GameRouter", () => {
  const corporations = {
    phoenix: {
      stocks: 25,
      size: 0,
      isActive: false,
      isSafe: false,
      price: 0,
      majorityPrice: 0,
      minorityPrice: 0,
    },
    quantum: {
      stocks: 25,
      size: 0,
      isActive: false,
      isSafe: false,
      price: 0,
      majorityPrice: 0,
      minorityPrice: 0,
    },
    fusion: {
      stocks: 25,
      size: 0,
      isActive: false,
      isSafe: false,
      price: 0,
      majorityPrice: 0,
      minorityPrice: 0,
    },
    hydra: {
      stocks: 25,
      size: 0,
      isActive: false,
      isSafe: false,
      price: 0,
      majorityPrice: 0,
      minorityPrice: 0,
    },
    america: {
      stocks: 25,
      size: 0,
      isActive: false,
      isSafe: false,
      price: 0,
      majorityPrice: 0,
      minorityPrice: 0,
    },
    zeta: {
      stocks: 25,
      size: 0,
      isActive: false,
      isSafe: false,
      price: 0,
      majorityPrice: 0,
      minorityPrice: 0,
    },
    sackson: {
      stocks: 25,
      size: 0,
      isActive: false,
      isSafe: false,
      price: 0,
      majorityPrice: 0,
      minorityPrice: 0,
    },
  };

  describe("GET /game", () => {
    it("should serve the game page", (_, done) => {
      const size = { lowerLimit: 1, upperLimit: 1 };
      const lobby = new Lobby(size);
      const username = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const app = createApp(lobbyRouter, gameRouter, { lobby });
      lobby.addPlayer({ username });

      request(app)
        .get("/game")
        .set("cookie", "username=player")
        .expect(200)
        .expect("content-type", new RegExp("text/html"))
        .end(done);
    });

    it("should not allow if the player is not in game", (_, done) => {
      const size = { lowerLimit: 3, upperLimit: 3 };
      const lobby = new Lobby(size);
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const app = createApp(lobbyRouter, gameRouter, { lobby });
      request(app).get("/game").expect(302).expect("location", "/").end(done);
    });
  });

  describe("GET /game/status", () => {
    it("should get current game status", (_, done) => {
      const size = { lowerLimit: 1, upperLimit: 1 };
      const lobby = new Lobby(size);
      const username = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;

      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });
      const portfolio = {
        tiles: [
          { position: { x: 0, y: 0 }, isPlaced: false },
          { position: { x: 0, y: 1 }, isPlaced: false },
          { position: { x: 0, y: 2 }, isPlaced: false },
          { position: { x: 0, y: 3 }, isPlaced: false },
          { position: { x: 0, y: 4 }, isPlaced: false },
          { position: { x: 0, y: 5 }, isPlaced: false },
        ],
        stocks: {
          phoenix: 0,
          quantum: 0,
          hydra: 0,
          fusion: 0,
          america: 0,
          sackson: 0,
          zeta: 0,
        },
        balance: 6000,
      };

      const gameStatus = {
        setupTiles: [["player", { position: { x: 0, y: 6 }, isPlaced: true }]],
        state: "place-tile",
        stateInfo: {},
        placedTiles: [
          {
            position: { x: 0, y: 6 },
            isPlaced: true,
            belongsTo: "incorporated",
          },
        ],
        turns: {
          currentTurn: {
            activities: [
              {
                id: "tile-place",
              },
            ],
            player: {
              username: "player",
              you: true,
            },
          },
          previousTurn: null,
        },
        players: [{ username, isTakingTurn: true, you: true }],
        portfolio,
        corporations,
      };

      request(app)
        .post("/lobby/players")
        .set("cookie", "username=player")
        .send({ username })
        .end(() => {
          request(app)
            .post("/game/start")
            .set("cookie", "username=player")
            .end(() => {
              request(app)
                .get("/game/status")
                .set("cookie", "username=player")
                .expect(200)
                .end((err, res) => {
                  assert.deepStrictEqual(res.body, gameStatus);
                  done(err);
                });
            });
        });
    });
  });

  describe("POST /game/tile", () => {
    it("should place a tile on the board, in the specified position", (_, done) => {
      const size = { lowerLimit: 1, upperLimit: 1 };
      const lobby = new Lobby(size);
      const username = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      const gameStatus = {
        state: "buy-stocks",
        stateInfo: {},
        setupTiles: [["player", { position: { x: 0, y: 6 }, isPlaced: true }]],
        placedTiles: [
          {
            position: { x: 0, y: 6 },
            isPlaced: true,
            belongsTo: "incorporated",
          },
          {
            position: { x: 0, y: 0 },
            isPlaced: true,
            belongsTo: "incorporated",
          },
        ],
        players: [{ username, isTakingTurn: true, you: true }],
        turns: {
          currentTurn: {
            activities: [
              {
                data: {
                  belongsTo: "incorporated",
                  isPlaced: true,
                  position: {
                    x: 0,
                    y: 0,
                  },
                },
                id: "tile-place",
              },
              {
                id: "buy-stocks",
              },
            ],
            player: {
              username: "player",
              you: true,
            },
          },
          previousTurn: null,
        },
        portfolio: {
          tiles: [
            { position: { x: 0, y: 0 }, isPlaced: true },
            { position: { x: 0, y: 1 }, isPlaced: false },
            { position: { x: 0, y: 2 }, isPlaced: false },
            { position: { x: 0, y: 3 }, isPlaced: false },
            { position: { x: 0, y: 4 }, isPlaced: false },
            { position: { x: 0, y: 5 }, isPlaced: false },
          ],
          stocks: {
            phoenix: 0,
            quantum: 0,
            hydra: 0,
            fusion: 0,
            america: 0,
            sackson: 0,
            zeta: 0,
          },
          balance: 6000,
        },
        corporations,
      };

      request(app)
        .post("/lobby/players")
        .send({ username })
        .expect(200)
        .end(() => {
          request(app)
            .post("/game/start")
            .set("cookie", "username=player")
            .end(() => {
              request(app)
                .post("/game/tile")
                .set("cookie", "username=player")
                .send({ x: 0, y: 0 })
                .expect(200)
                .end(() => {
                  request(app)
                    .get("/game/status")
                    .set("cookie", "username=player")
                    .expect(200)
                    .expect("content-type", new RegExp("application/json"))
                    .end((err, res) => {
                      assert.deepStrictEqual(res.body, gameStatus);
                      done(err);
                    });
                });
            });
        });
    });
  });

  describe("POST /game/end-turn", () => {
    it("should change the turn of a player", (_, done) => {
      const size = { lowerLimit: 2, upperLimit: 2 };
      const lobby = new Lobby(size);
      const username1 = "player1";
      const username2 = "player2";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      const expectedPlayers = [
        { username: username1, isTakingTurn: false, you: true },
        { username: username2, isTakingTurn: true, you: false },
      ];

      request(app)
        .post("/lobby/players")
        .send({ username: username1 })
        .expect(200)
        .end(() => {
          request(app)
            .post("/lobby/players")
            .send({ username: username2 })
            .expect(200)
            .end(() => {
              request(app)
                .post("/game/start")
                .set("cookie", "username=player1")
                .expect(200)
                .end(() => {
                  request(app)
                    .post("/game/end-turn")
                    .set("cookie", "username=player1")
                    .expect(200)
                    .end(() => {
                      request(app)
                        .get("/game/status")
                        .set("cookie", "username=player1")
                        .expect(200)
                        .end((err, res) => {
                          const { players } = res.body;
                          assert.deepStrictEqual(players, expectedPlayers);
                          done(err);
                        });
                    });
                });
            });
        });
    });
  });

  describe("POST /game/start", () => {
    it("should start the game when has enough players", (_, done) => {
      const size = { lowerLimit: 1, upperLimit: 1 };
      const lobby = new Lobby(size);
      const username = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      request(app)
        .post("/lobby/players")
        .send({ username })
        .expect(200)
        .end(() => {
          request(app)
            .post("/game/start")
            .set("cookie", "username=player")
            .expect(200)
            .end(err => {
              const { hasExpired } = lobby.status();
              assert.ok(hasExpired);
              done(err);
            });
        });
    });

    it("should redirect to the home page when not enough players has joined", (_, done) => {
      const size = { lowerLimit: 2, upperLimit: 2 };
      const lobby = new Lobby(size);
      const username = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      request(app)
        .post("/lobby/players")
        .send({ username })
        .expect(200)
        .end(() => {
          request(app)
            .post("/game/start")
            .set("cookie", "username=player")
            .expect(302)
            .expect("location", "/lobby")
            .end(done);
        });
    });

    it("should start the game on host request", (_, done) => {
      const size = { lowerLimit: 2, upperLimit: 2 };
      const lobby = new Lobby(size);
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      const username1 = "player1";
      const username2 = "player2";

      request(app)
        .post("/lobby/players")
        .send({ username: username1 })
        .expect(302)
        .expect("location", "/lobby")
        .end(() => {
          request(app)
            .post("/lobby/players")
            .send({ username: username2 })
            .expect(302)
            .expect("location", "/lobby")
            .end(() => {
              request(app)
                .post("/game/start")
                .set("cookie", "username=player1")
                .expect(200)
                .end(done);
            });
        });
    });

    it("should start the game only on host request", (_, done) => {
      const size = { lowerLimit: 2, upperLimit: 2 };
      const lobby = new Lobby(size);
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      const username1 = "player1";
      const username2 = "player2";

      request(app)
        .post("/lobby/players")
        .send({ username: username1 })
        .expect(302)
        .expect("location", "/lobby")
        .end(() => {
          request(app)
            .post("/lobby/players")
            .send({ username: username2 })
            .expect(302)
            .expect("location", "/lobby")
            .end(() => {
              request(app)
                .post("/game/start")
                .set("cookie", "username=player2")
                .expect(400)
                .end(done);
            });
        });
    });
  });

  describe("POST /game/establish", () => {
    it("should establish selected corporation", (_, done) => {
      const size = { lowerLimit: 2, upperLimit: 2 };
      const lobby = new Lobby(size);
      const username1 = "player1";
      const username2 = "player2";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      const portfolio = {
        tiles: [
          { position: { x: 0, y: 0 }, isPlaced: true },
          { position: { x: 0, y: 1 }, isPlaced: false },
          { position: { x: 0, y: 2 }, isPlaced: false },
          { position: { x: 0, y: 3 }, isPlaced: false },
          { position: { x: 0, y: 4 }, isPlaced: false },
          { position: { x: 0, y: 5 }, isPlaced: false },
        ],
        stocks: {
          phoenix: 1,
          quantum: 0,
          hydra: 0,
          fusion: 0,
          america: 0,
          sackson: 0,
          zeta: 0,
        },
        balance: 6000,
      };

      const gameStatus = {
        setupTiles: [
          [
            "player1",
            {
              position: { x: 1, y: 0 },
              isPlaced: true,
            },
          ],
          [
            "player2",
            {
              position: { x: 1, y: 1 },
              isPlaced: true,
            },
          ],
        ],
        turns: {
          currentTurn: {
            activities: [
              {
                data: {
                  belongsTo: "phoenix",
                  isPlaced: true,
                  position: {
                    x: 0,
                    y: 0,
                  },
                },
                id: "tile-place",
              },
              {
                data: {
                  name: "phoenix",
                },
                id: "establish",
              },
              {
                id: "buy-stocks",
              },
            ],
            player: {
              username: "player1",
              you: true,
            },
          },
          previousTurn: null,
        },
        state: "buy-stocks",
        stateInfo: {},
        placedTiles: [
          {
            belongsTo: "phoenix",
            isPlaced: true,
            position: {
              x: 1,
              y: 0,
            },
          },
          {
            belongsTo: "phoenix",
            isPlaced: true,
            position: {
              x: 1,
              y: 1,
            },
          },
          {
            belongsTo: "phoenix",
            isPlaced: true,
            position: {
              x: 0,
              y: 0,
            },
          },
        ],

        players: [
          { username: username1, isTakingTurn: true, you: true },
          { username: username2, isTakingTurn: false, you: false },
        ],
        portfolio,
        corporations: {
          ...corporations,
          phoenix: {
            stocks: 24,
            size: 3,
            isActive: true,
            isSafe: false,
            price: 500,
            majorityPrice: 5000,
            minorityPrice: 2500,
          },
        },
      };

      request(app)
        .post("/lobby/players")
        .send({ username: username1 })
        .expect(302)
        .end(() => {
          request(app)
            .post("/lobby/players")
            .send({ username: username2 })
            .expect(302)
            .end(() => {
              request(app)
                .post("/game/start")
                .set("cookie", "username=player1")
                .expect(200)
                .end(() => {
                  request(app)
                    .post("/game/tile")
                    .set("cookie", "username=player1")
                    .send({ x: 0, y: 0 })
                    .expect(200)
                    .end(() => {
                      request(app)
                        .post("/game/establish")
                        .send({ name: "phoenix" })
                        .set("cookie", "username=player1")
                        .expect(200)
                        .end(() => {
                          request(app)
                            .get("/game/status")
                            .set("cookie", "username=player1")
                            .expect(200)
                            .end((err, res) => {
                              assert.deepStrictEqual(res.body, gameStatus);
                              done(err);
                            });
                        });
                    });
                });
            });
        });
    });
  });

  describe("POST /game/buy-stocks", () => {
    it("should buy stocks of an active corporation", async () => {
      const size = { lowerLimit: 2, upperLimit: 2 };
      const lobby = new Lobby(size);
      const username1 = "player1";
      const username2 = "player2";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      const portfolio = {
        tiles: [
          { position: { x: 0, y: 0 }, isPlaced: true },
          { position: { x: 0, y: 1 }, isPlaced: false },
          { position: { x: 0, y: 2 }, isPlaced: false },
          { position: { x: 0, y: 3 }, isPlaced: false },
          { position: { x: 0, y: 4 }, isPlaced: false },
          { position: { x: 0, y: 5 }, isPlaced: false },
        ],
        stocks: {
          phoenix: 2,
          quantum: 0,
          hydra: 0,
          fusion: 0,
          america: 0,
          sackson: 0,
          zeta: 0,
        },
        balance: 5500,
      };

      await joinPlayer(app, username1);
      await joinPlayer(app, username2);
      await startGame(app, username1);
      await placeTile(app, username1, { x: 0, y: 0 });
      await establishCorp(app, username1, "phoenix");
      await buyStocks(app, username1, [{ name: "phoenix", price: 1000 }]);

      const status = await getGameStatus(app, username1);
      assert.strictEqual(status.state, "tile-placed");
      assert.deepStrictEqual(status.portfolio, portfolio);
    });
  });

  describe("POST /game/test", () => {
    it("should load a game from a state", (_, done) => {
      const size = { lowerLimit: 1, upperLimit: 2 };
      const lobby = new Lobby(size);
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      const expectedStatus = {
        "state": "place-tile",
        "stateInfo": {},
        "setupTiles": [
          [
            "biswa",
            {
              "position": {
                "x": 1,
                "y": 6,
              },
              "isPlaced": true,
            },
          ],
        ],
        "players": [
          {
            "username": "biswa",
            "isTakingTurn": true,
            "you": true,
          },
        ],
        turns: {
          currentTurn: {
            activities: [
              {
                id: "tile-place",
              },
            ],
            player: {
              username: "biswa",
              you: true,
            },
          },
          previousTurn: null,
        },
        "portfolio": {
          "tiles": [
            {
              "position": {
                "x": 0,
                "y": 0,
              },
              "isPlaced": false,
            },
            {
              "position": {
                "x": 0,
                "y": 1,
              },
              "isPlaced": false,
            },
            {
              "position": {
                "x": 0,
                "y": 2,
              },
              "isPlaced": false,
            },
            {
              "position": {
                "x": 0,
                "y": 3,
              },
              "isPlaced": false,
            },
            {
              "position": {
                "x": 0,
                "y": 4,
              },
              "isPlaced": false,
            },
            {
              "position": {
                "x": 0,
                "y": 5,
              },
              "isPlaced": false,
            },
          ],
          "stocks": {
            "phoenix": 0,
            "quantum": 0,
            "hydra": 0,
            "fusion": 0,
            "america": 0,
            "sackson": 0,
            "zeta": 0,
          },
          "balance": 6000,
        },
        "placedTiles": [
          {
            "position": {
              "x": 0,
              "y": 6,
            },
            "isPlaced": true,
            "belongsTo": "incorporated",
          },
        ],
        corporations,
      };

      const gameState = {
        "setupTiles": [
          [
            { username: "biswa" },
            {
              "position": {
                "x": 1,
                "y": 6,
              },
              "isPlaced": true,
            },
          ],
        ],
        "players": [
          {
            "username": "biswa",
            "portfolio": {
              "tiles": [
                {
                  "position": {
                    "x": 0,
                    "y": 0,
                  },
                  "isPlaced": false,
                },
                {
                  "position": {
                    "x": 0,
                    "y": 1,
                  },
                  "isPlaced": false,
                },
                {
                  "position": {
                    "x": 0,
                    "y": 2,
                  },
                  "isPlaced": false,
                },
                {
                  "position": {
                    "x": 0,
                    "y": 3,
                  },
                  "isPlaced": false,
                },
                {
                  "position": {
                    "x": 0,
                    "y": 4,
                  },
                  "isPlaced": false,
                },
                {
                  "position": {
                    "x": 0,
                    "y": 5,
                  },
                  "isPlaced": false,
                },
              ],
              "stocks": {
                "phoenix": 0,
                "quantum": 0,
                "hydra": 0,
                "fusion": 0,
                "america": 0,
                "sackson": 0,
                "zeta": 0,
              },
              "balance": 6000,
            },
          },
        ],
        "placedTiles": [
          {
            "position": {
              "x": 0,
              "y": 6,
            },
            "isPlaced": true,
            "belongsTo": "incorporated",
          },
        ],
        corporations: {
          "phoenix": {
            "stocks": 25,
            "size": 0,
            "isActive": false,
            "price": 0,
            "majorityPrice": 2000,
            "minorityPrice": 1000,
            "isSafe": false,
          },
          "quantum": {
            "stocks": 25,
            "size": 0,
            "isActive": false,
            "price": 0,
            "majorityPrice": 2000,
            "minorityPrice": 1000,
            "isSafe": false,
          },
          "fusion": {
            "stocks": 25,
            "size": 0,
            "isActive": false,
            "price": 0,
            "majorityPrice": 2000,
            "minorityPrice": 1000,
            "isSafe": false,
          },
          "hydra": {
            "stocks": 25,
            "size": 0,
            "isActive": false,
            "price": 800,
            "majorityPrice": 2000,
            "minorityPrice": 1000,
            "isSafe": false,
          },
          "america": {
            "stocks": 25,
            "size": 0,
            "isActive": false,
            "price": 0,
            "majorityPrice": 2000,
            "minorityPrice": 1000,
            "isSafe": false,
          },
          "zeta": {
            "stocks": 25,
            "size": 0,
            "isActive": false,
            "price": 0,
            "majorityPrice": 2000,
            "minorityPrice": 1000,
            "isSafe": false,
          },
          "sackson": {
            "stocks": 25,
            "size": 0,
            "isActive": false,
            "price": 0,
            "majorityPrice": 2000,
            "minorityPrice": 1000,
            "isSafe": false,
          },
        },
      };

      request(app)
        .post("/lobby/players")
        .send({ username: "biswa" })
        .expect(200)
        .end(() => {
          request(app)
            .post("/game/start")
            .set("cookie", "username=biswa")
            .expect(200)
            .end(() => {
              request(app)
                .post("/game/test")
                .send(gameState)
                .expect(200)
                .end(() => {
                  request(app)
                    .get("/game/status")
                    .expect(200)
                    .set("cookie", "username=biswa")
                    .end((err, res) => {
                      assert.deepStrictEqual(res.body, expectedStatus);
                      done(err);
                    });
                });
            });
        });
    });
  });

  describe("POST /game/end-merge", () => {
    it("should end the merge state", async () => {
      const size = { lowerLimit: 1, upperLimit: 2 };
      const lobby = new Lobby(size);
      const player = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      await joinPlayer(app, player);
      await startGame(app, player);
      await placeTile(app, player, { x: 0, y: 5 });
      await establishCorp(app, player, "phoenix");

      await placeTile(app, player, { x: 0, y: 1 });
      await placeTile(app, player, { x: 0, y: 2 });
      await placeTile(app, player, { x: 0, y: 3 });
      await establishCorp(app, player, "quantum");

      await placeTile(app, player, { x: 0, y: 4 });

      let status = await getGameStatus(app, player);
      assert.strictEqual(status.state, "merge");

      await endMerge(app, player);
      status = await getGameStatus(app, player);
      chai.expect(status.state).to.not.equal("merge");
    });
  });

  describe("POST /game/resolve-conflict", () => {
    it("should resolve merge conflict by merge maker", async () => {
      const size = { lowerLimit: 1, upperLimit: 2 };
      const lobby = new Lobby(size);
      const player = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      await joinPlayer(app, player);
      await startGame(app, player);
      await placeTile(app, player, { x: 0, y: 5 });
      await establishCorp(app, player, "phoenix");

      await placeTile(app, player, { x: 0, y: 2 });
      await placeTile(app, player, { x: 0, y: 3 });
      await establishCorp(app, player, "quantum");

      await placeTile(app, player, { x: 0, y: 4 });

      let status = await getGameStatus(app, player);
      assert.strictEqual(status.state, "merge-conflict");

      await resolveConflict(app, player, {
        acquirer: "phoenix",
        defunct: "quantum",
      });

      await endMerge(app, player);
      status = await getGameStatus(app, player);
      chai.expect(status.state).to.not.equal("merge");
    });
  });

  describe("POST /game/end-result", () => {
    it("should give the game result", async () => {
      const size = { lowerLimit: 1, upperLimit: 2 };
      const lobby = new Lobby(size);
      const player = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      await joinPlayer(app, player);
      await startGame(app, player);
      await loadGame(app, player, gameEndData);
      await placeTile(app, player, { "x": 6, "y": 6 });
      await endMergerTurn(app, player);
      await endTurn(app, player);

      let status = await getGameStatus(app, player);
      assert.strictEqual(status.state, "game-end");

      const { players } = await gameResult(app, player);
      assert.deepStrictEqual(players, [
        {
          balance: 4800,
          name: "player",
          stocks: {
            america: 0,
            fusion: 0,
            hydra: 0,
            phoenix: 3,
            quantum: 0,
            sackson: 0,
            zeta: 0,
          },
        },
      ]);
    });
  });

  describe("POST /game/merger/deal", () => {
    it("should sell defunct stocks", async () => {
      const size = { lowerLimit: 1, upperLimit: 2 };
      const lobby = new Lobby(size);
      const playerName = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      await joinPlayer(app, playerName);
      await startGame(app, playerName);
      await loadGame(app, playerName, mergerRound);
      await placeTile(app, playerName, { "x": 6, "y": 6 });

      let status = await getGameStatus(app, playerName);
      assert.strictEqual(status.state, "merge");

      await dealDefunctStocks(app, playerName, { sell: 5, trade: 0 });

      const {
        portfolio: { stocks, balance },
        corporations: { zeta },
      } = await getGameStatus(app, playerName);

      assert.deepStrictEqual(stocks.zeta, 0);
      assert.deepStrictEqual(balance, 16800);
      assert.deepStrictEqual(zeta.stocks, 25);
    });

    it("should trade defunct stocks for 2:1", async () => {
      const size = { lowerLimit: 1, upperLimit: 2 };
      const lobby = new Lobby(size);
      const playerName = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      await joinPlayer(app, playerName);
      await startGame(app, playerName);
      await loadGame(app, playerName, mergerRound);
      await placeTile(app, playerName, { "x": 6, "y": 6 });

      let status = await getGameStatus(app, playerName);
      assert.strictEqual(status.state, "merge");

      await dealDefunctStocks(app, playerName, { sell: 0, trade: 4 });

      const {
        portfolio: { stocks, balance },
        corporations: { zeta },
      } = await getGameStatus(app, playerName);

      assert.deepStrictEqual(stocks.zeta, 1);
      assert.deepStrictEqual(stocks.quantum, 2);
      assert.deepStrictEqual(balance, 13800);
      assert.deepStrictEqual(zeta.stocks, 24);
    });

    it("should not trade when stocks of acquirer are not available", async () => {
      const size = { lowerLimit: 1, upperLimit: 2 };
      const lobby = new Lobby(size);
      const playerName = "player";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      await joinPlayer(app, playerName);
      await startGame(app, playerName);
      await loadGame(app, playerName, mergerRound);
      await placeTile(app, playerName, { "x": 6, "y": 6 });

      let status = await getGameStatus(app, playerName);
      assert.strictEqual(status.state, "merge");

      await dealDefunctStocks(app, playerName, { sell: 0, trade: 6 });

      const {
        portfolio: { stocks, balance },
        corporations: { zeta },
      } = await getGameStatus(app, playerName);

      assert.deepStrictEqual(stocks.zeta, 5);
      assert.deepStrictEqual(stocks.quantum, 0);
      assert.deepStrictEqual(balance, 13800);
      assert.deepStrictEqual(zeta.stocks, 20);
    });
  });

  describe("POST /game/buy-stocks", () => {
    it("should buy stocks of an active corporation", async () => {
      const size = { lowerLimit: 2, upperLimit: 2 };
      const lobby = new Lobby(size);
      const username1 = "player1";
      const username2 = "player2";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      await joinPlayer(app, username1);
      await joinPlayer(app, username2);
      await startGame(app, username1);
      await placeTile(app, username1, { x: 0, y: 0 });
      await endTurn(app, username1);
      await badRequest(app, username1, "/game/end-turn");
    });
  });

  describe("POST /game/merge/resolve-acquirer", () => {
    it("should select acquirer from multiple acquirer", async () => {
      const size = { lowerLimit: 3, upperLimit: 6 };
      const lobby = new Lobby(size);
      const player1 = "Bittu";
      const player2 = "Debu";
      const player3 = "Swagato";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      await joinPlayer(app, player1);
      await joinPlayer(app, player2);
      await joinPlayer(app, player3);
      await loadGame(app, player1, multipleMergeTwoAcquirer);

      await placeTile(app, player1, { x: 4, y: 6 });

      const { state } = await getGameStatus(app, player1);
      assert.strictEqual(state, "acquirer-selection");

      await selectAcquirer(app, player1, "phoenix");
      const { state: mergeState } = await getGameStatus(app, player1);
      assert.strictEqual(mergeState, "merge");
    });
  });

  describe("POST /game/merge/confirm-defunct", () => {
    it("should select defunct from defunct acquirer", async () => {
      const size = { lowerLimit: 3, upperLimit: 6 };
      const lobby = new Lobby(size);
      const player1 = "Bittu";
      const player2 = "Debu";
      const player3 = "Swagato";
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const shuffle = x => x;
      const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

      await joinPlayer(app, player1);
      await joinPlayer(app, player2);
      await joinPlayer(app, player3);
      await loadGame(app, player1, multipleMergeThreeAllEqual);

      await placeTile(app, player1, { x: 4, y: 6 });

      const { state: acquirerSelection } = await getGameStatus(app, player1);
      assert.strictEqual(acquirerSelection, "acquirer-selection");
      await selectAcquirer(app, player1, "phoenix");

      const { state: defunctSelection } = await getGameStatus(app, player1);
      assert.strictEqual(defunctSelection, "defunct-selection");
      await selectDefunct(app, player1, "quantum");

      const { state: mergeState } = await getGameStatus(app, player1);
      assert.strictEqual(mergeState, "merge");
    });
  });
});
