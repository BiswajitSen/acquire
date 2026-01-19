const request = require("supertest");
const { describe, it } = require("node:test");
const { createApp } = require("../src/app");
const { createLobbiesRouter } = require("../src/routers/lobbies-router");
const { createLobbyRouter } = require("../src/routers/lobby-router");
const { createGameRouter } = require("../src/routers/game-router");
const LobbyManager = require("../src/models/lobby-manager");

describe("App", () => {
  describe("GET /", () => {
    it("should serve the home page", (_, done) => {
      const lobbyManager = new LobbyManager();
      const lobbiesRouter = createLobbiesRouter();
      const lobbyRouter = createLobbyRouter();
      const gameRouter = createGameRouter();
      const app = createApp(lobbiesRouter, lobbyRouter, gameRouter, { lobbyManager });
      request(app)
        .get("/")
        .expect(200)
        .expect("content-type", new RegExp("text/html"))
        .end(done);
    });
  });
});
