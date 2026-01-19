const http = require("http");
const { Server } = require("socket.io");
const { shuffle } = require("lodash");
const LobbyManager = require("./src/models/lobby-manager");
const { createApp } = require("./src/app");
const { createGameRouter } = require("./src/routers/game-router");
const { createLobbyRouter } = require("./src/routers/lobby-router");
const { createLobbiesRouter } = require("./src/routers/lobbies-router");
const { setupSocketServer } = require("./src/socket-handler");

const PORT = process.env.PORT || 8080;

const logServerInfo = () => {
  console.log("Listening on", PORT);
  console.log("Local:", `http://localhost:${PORT}`);
};

const main = () => {
  const lobbyManager = new LobbyManager();
  const lobbiesRouter = createLobbiesRouter();
  const lobbyRouter = createLobbyRouter();
  const gameRouter = createGameRouter();

  const context = { lobbyManager, shuffle };
  const app = createApp(lobbiesRouter, lobbyRouter, gameRouter, context);

  // Create HTTP server and Socket.IO
  const httpServer = http.createServer(app);
  const io = new Server(httpServer);

  // Setup socket handlers and get broadcaster functions
  const socketBroadcaster = setupSocketServer(io, lobbyManager);

  // Attach broadcaster to app context for use in routers
  app.set("socketBroadcaster", socketBroadcaster);

  httpServer.listen(PORT, logServerInfo);
};

main();
