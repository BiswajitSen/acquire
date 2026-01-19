const express = require("express");
const { authorizeLobbyMember } = require("../middleware/lobby");
const { Game, loadGame } = require("../models/game");
const { createCorporations } = require("../models/corporation");
const { createPlayers } = require("../models/player");

const serveGameStats = (req, res) => {
  const { game } = req;
  const { username } = req.cookies;
  res.send(game.status(username));
};

const serveGamePage = (_, res) => {
  res.sendFile("game.html", { root: "pages" });
};

const placeTile = (req, res) => {
  const { game, lobbyId } = req;
  const { username } = req.cookies;
  const tile = req.body;

  game.placeTile(username, tile);
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.status(200).end();
};

const endPlayerTurn = (req, res) => {
  const { game, lobbyId } = req;
  game.changeTurn();
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.end();
};

const gameResult = (req, res) => {
  const { game, lobbyId } = req;
  const { lobbyManager } = req.app.context;

  lobbyManager.markGameFinished(lobbyId);
  res.json(game.result);
};

const buyStocks = (req, res) => {
  const { game, lobbyId } = req;
  const stocks = req.body;

  game.buyStocks(stocks);
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.end();
};

const establishCorporation = (req, res) => {
  const { game, lobbyId } = req;
  const { name } = req.body;

  game.establishCorporation({ name });
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.end();
};

const verifyStart = (req, res, next) => {
  const { lobby, lobbyId } = req;
  const { isPossibleToStartGame } = lobby.status();

  if (!isPossibleToStartGame) {
    if (req.method === "GET") {
      return res.redirect(`/lobby/${lobbyId}`);
    }
    return res.status(400).json({ error: "Not enough players to start the game" });
  }

  next();
};

const startGame = (req, res) => {
  const { lobby, lobbyId } = req;
  const { shuffle, lobbyManager } = req.app.context;
  const { players } = lobby.status();
  const corporations = createCorporations();

  const game = new Game(createPlayers(players), shuffle, corporations);

  try {
    lobbyManager.setGame(lobbyId, game);
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }

  req.game = game;
  game.start();
  lobby.expire();
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) {
    socketBroadcaster.broadcastLobbyUpdate(lobbyId);
    socketBroadcaster.broadcastGameUpdate(lobbyId);
  }
  
  res.end();
};

const verifyHost = (req, res, next) => {
  const { username } = req.cookies;
  const { lobby } = req;
  const { self, host } = lobby.status(username);

  if (!self || !host) {
    const error = "Invalid request!";
    return res.status(400).json({ error });
  }

  if (self.username !== host.username) {
    const error = "Only the host can start the game!";
    return res.status(403).json({ error });
  }

  next();
};

const configureGame = (req, res) => {
  const gameData = req.body;
  const game = loadGame(gameData);
  const { lobbyId } = req;
  const { lobbyManager } = req.app.context;
  lobbyManager.setGame(lobbyId, game);
  res.status(201).end();
};

const endMerge = (req, res) => {
  const { game, lobbyId } = req;
  game.endMerge();
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.status(200).end();
};

const endMergerTurn = (req, res) => {
  const { game, lobbyId } = req;
  game.endMergerTurn();
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.status(200).end();
};

const dealDefunctStocks = (req, res) => {
  const { game, lobbyId } = req;
  const { sell, trade } = req.body;

  game.dealDefunctStocks({ sell, trade });
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.status(200).end();
};

const resolveConflict = (req, res) => {
  const { game, lobbyId } = req;
  game.mergeTwoCorporation(req.body);
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.status(200).end();
};

const validatePlayer = (req, res, next) => {
  const { game } = req;
  const { username } = req.cookies;
  const currentPlayerName = game.currentPlayerName();
  if (username === currentPlayerName) return next();
  res.status(400).end();
};

const selectAcquirer = (req, res) => {
  const { game, lobbyId } = req;
  const { acquirer } = req.body;
  game.selectAcquirer(acquirer);
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.status(200).end();
};

const confirmDefunct = (req, res) => {
  const { game, lobbyId } = req;
  const { defunct } = req.body;
  game.confirmDefunct(defunct);
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.status(200).end();
};

const trackGameActivity = (req, res, next) => {
  const { lobbyId } = req;
  const { lobbyManager } = req.app.context;

  lobbyManager.updateGameActivity(lobbyId);
  next();
};

const createGameRouter = () => {
  const router = new express.Router();

  router.param("lobbyId", (req, res, next, lobbyId) => {
    const { lobbyManager } = req.app.context;

    if (!lobbyManager.hasLobby(lobbyId)) {
      return res.status(404).json({ error: "Lobby not found" });
    }

    req.lobby = lobbyManager.getLobby(lobbyId);
    req.lobbyId = lobbyId;
    req.game = lobbyManager.getGame(lobbyId);
    next();
  });

  router.post("/:lobbyId/test", configureGame);
  router.use("/:lobbyId", authorizeLobbyMember);
  router.use("/:lobbyId", trackGameActivity);
  router.get("/:lobbyId", verifyStart, serveGamePage);
  router.post("/:lobbyId/start", verifyHost, verifyStart, startGame);
  router.get("/:lobbyId/status", serveGameStats);
  router.post("/:lobbyId/tile", validatePlayer, placeTile);
  router.post("/:lobbyId/end-turn", validatePlayer, endPlayerTurn);
  router.post("/:lobbyId/merger/deal", validatePlayer, dealDefunctStocks);
  router.post("/:lobbyId/merger/end-turn", validatePlayer, endMergerTurn);
  router.post("/:lobbyId/merger/resolve-conflict", validatePlayer, resolveConflict);
  router.post("/:lobbyId/merger/resolve-acquirer", validatePlayer, selectAcquirer);
  router.post("/:lobbyId/merger/confirm-defunct", validatePlayer, confirmDefunct);
  router.get("/:lobbyId/end-result", gameResult);
  router.post("/:lobbyId/buy-stocks", validatePlayer, buyStocks);
  router.post("/:lobbyId/establish", validatePlayer, establishCorporation);
  router.post("/:lobbyId/end-merge", endMerge);

  return router;
};

module.exports = {
  createGameRouter,
};
