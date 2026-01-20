const http = require("http");
const compression = require("compression");
const { Server } = require("socket.io");
const { shuffle } = require("lodash");
const LobbyManager = require("./src/models/lobby-manager");
const { createApp } = require("./src/app");
const { createGameRouter } = require("./src/routers/game-router");
const { createLobbyRouter } = require("./src/routers/lobby-router");
const { createLobbiesRouter } = require("./src/routers/lobbies-router");
const { setupSocketServer } = require("./src/socket-handler");
const { setupVoice } = require("./src/voice-handler");

const PORT = process.env.PORT || 8080;

const logServerInfo = () => {
  console.log("Listening on", PORT);
  console.log("Local:", `http://localhost:${PORT}`);
};

const SOCKET_OPTIONS = {
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: { level: 6 },
    zlibInflateOptions: { chunkSize: 16 * 1024 }
  },
  pingTimeout: 30000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  cors: {
    origin: true,
    credentials: true
  },
  transports: ["websocket", "polling"]
};

const main = () => {
  const lobbyManager = new LobbyManager();
  const lobbiesRouter = createLobbiesRouter();
  const lobbyRouter = createLobbyRouter();
  const gameRouter = createGameRouter();

  const context = { lobbyManager, shuffle };
  const app = createApp(lobbiesRouter, lobbyRouter, gameRouter, context);

  app.use(compression());

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, SOCKET_OPTIONS);

  const socketBroadcaster = setupSocketServer(io, lobbyManager);
  
  // Set up voice chat signaling
  setupVoice(io);

  app.set("socketBroadcaster", socketBroadcaster);

  httpServer.listen(PORT, logServerInfo);
};

main();
