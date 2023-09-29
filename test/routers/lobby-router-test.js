const assert = require("assert");
const request = require("supertest");
const { describe, it } = require("node:test");
const { createApp } = require("../../src/app");
const { createLobbyRouter } = require("../../src/routers/lobby-router");
const { createGameRouter } = require("../../src/routers/game-router");
const Lobby = require("../../src/models/lobby");

describe("GET /lobby", () => {
  it("should serve the lobby page", (_, done) => {
    const size = { lowerLimit: 3, upperLimit: 3 };
    const username = "player";
    const lobby = new Lobby(size);
    lobby.addPlayer({ username });
    const lobbyRouter = createLobbyRouter();
    const gameRouter = createGameRouter({});
    const app = createApp(lobbyRouter, gameRouter, { lobby });
    request(app)
      .get("/lobby")
      .set("cookie", `username=${username}`)
      .expect(200)
      .expect("content-type", new RegExp("text/html"))
      .end(done);
  });

  it("should not allow unauthorized access", (_, done) => {
    const size = { lowerLimit: 3, upperLimit: 3 };
    const username = "player";
    const lobby = new Lobby(size);
    lobby.addPlayer({ username });
    const lobbyRouter = createLobbyRouter();
    const gameRouter = createGameRouter({});
    const app = createApp(lobbyRouter, gameRouter, { lobby });
    request(app)
      .get("/lobby")
      .set("cookie", "username=abcd")
      .expect(302)
      .expect("location", "/")
      .end(done);
  });

  it("should not allow if player is not in lobby", (_, done) => {
    const size = { lowerLimit: 3, upperLimit: 3 };
    const username = "player";
    const lobby = new Lobby(size);
    lobby.addPlayer({ username });
    const lobbyRouter = createLobbyRouter();
    const gameRouter = createGameRouter({});
    const app = createApp(lobbyRouter, gameRouter, { lobby });
    request(app).get("/lobby").expect(302).expect("location", "/").end(done);
  });
});

describe("POST /lobby/players", () => {
  it("should add the player in the lobby", (_, done) => {
    const size = { lowerLimit: 3, upperLimit: 3 };
    const lobby = new Lobby(size);
    const lobbyRouter = createLobbyRouter();
    const gameRouter = createGameRouter({});
    const shuffle = x => x;
    const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

    const username = "player";
    request(app)
      .post("/lobby/players")
      .send({ username })
      .expect(302)
      .expect("location", "/lobby")
      .expect("set-cookie", new RegExp(`username=${username}`))
      .end(err => {
        assert.deepStrictEqual(lobby.status().players, [{ username }]);
        done(err);
      });
  });

  it("should not add player if the lobby is full", (_, done) => {
    const size = { lowerLimit: 3, upperLimit: 3 };
    const lobby = new Lobby(size);
    const lobbyRouter = createLobbyRouter();
    const gameRouter = createGameRouter();
    const shuffle = x => x;
    const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });
    const players = [
      { username: "player1" },
      { username: "player2" },
      { username: "player3" },
    ];

    const player4 = { username: "player4" };

    lobby.addPlayer(players[0]);
    lobby.addPlayer(players[1]);

    request(app)
      .post("/lobby/players")
      .send(players[2])
      .end(() => {
        request(app)
          .post("/lobby/players")
          .send(player4)
          .expect(401)
          .expect({ error: "Lobby is full !" })
          .end(err => {
            assert.deepStrictEqual(lobby.isFull(), true);
            done(err);
          });
      });
  });
});

describe("GET /lobby/status", () => {
  it("should provide fields to determine whether or not to start the game.", (_, done) => {
    const size = { lowerLimit: 3, upperLimit: 3 };
    const lobby = new Lobby(size);
    const lobbyRouter = createLobbyRouter();
    const gameRouter = createGameRouter();
    const shuffle = x => x;

    const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });
    const player = { username: "player" };

    lobby.addPlayer(player);

    const expectedStatus = {
      players: [player],
      isFull: false,
      hasExpired: false,
      isPossibleToStartGame: false,
      host: player,
      self: player,
    };

    request(app)
      .get("/lobby/status")
      .set("cookie", "username=player")
      .expect(200)
      .expect("content-type", new RegExp("application/json"))
      .expect(expectedStatus)
      .end(done);
  });

  it("should not allow if the player is not a member of the lobby", (_, done) => {
    const size = { lowerLimit: 3, upperLimit: 3 };
    const lobby = new Lobby(size);
    const lobbyRouter = createLobbyRouter();
    const gameRouter = createGameRouter();
    const shuffle = x => x;

    const app = createApp(lobbyRouter, gameRouter, { lobby, shuffle });

    request(app)
      .get("/lobby/status")
      .set("cookie", "username=player")
      .expect(302)
      .expect("location", "/")
      .end(done);
  });
});
