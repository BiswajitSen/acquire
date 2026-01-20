const express = require("express");
const { authorizeLobbyMember } = require("../middleware/lobby");
const { Game, loadGame } = require("../models/game");
const { createCorporations } = require("../models/corporation");
const { createPlayers } = require("../models/player");
const { asyncHandler, ERROR_TYPES } = require("../utils/error-handler");
const { validators } = require("../utils/validation");

const serveGameStats = (req, res) => {
  const { game } = req;
  const { username } = req.cookies;
  res.send(game.status(username));
};

const serveGamePage = (_, res) => {
  res.sendFile("game.html", { root: "pages" });
};

const placeTile = asyncHandler((req, res) => {
  const { game, lobbyId } = req;
  const { username } = req.cookies;
  
  const position = validators.position(req.body);
  
  try {
    game.placeTile(username, position);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.status(200).end();
});

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

const VALID_CORPORATIONS = ["phoenix", "quantum", "hydra", "fusion", "america", "sackson", "zeta"];

const establishCorporation = asyncHandler((req, res) => {
  const { game, lobbyId } = req;
  
  const name = validators.corporation(req.body?.name, VALID_CORPORATIONS);

  game.establishCorporation({ name });
  
  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) socketBroadcaster.broadcastGameUpdate(lobbyId);
  
  res.end();
});

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

/**
 * Load a saved game state
 * POST /game/:lobbyId/load
 * Body: Complete game state JSON
 */
const loadGameState = (req, res) => {
  const gameData = req.body;
  const { lobbyId, lobby } = req;
  const { lobbyManager } = req.app.context;
  
  try {
    const game = loadGame(gameData);
    lobbyManager.setGame(lobbyId, game);
    
    // Mark lobby as expired since game is now active
    if (lobby && !lobby.status().hasExpired) {
      lobby.expire();
    }
    
    const socketBroadcaster = req.app.get("socketBroadcaster");
    if (socketBroadcaster) {
      socketBroadcaster.broadcastLobbyUpdate(lobbyId);
      socketBroadcaster.broadcastGameUpdate(lobbyId);
    }
    
    res.status(201).json({ success: true, message: "Game state loaded" });
  } catch (error) {
    console.error("[GameLoader] Failed to load game:", error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Export current game state
 * GET /game/:lobbyId/export
 * Returns: Complete game state JSON that can be saved and reloaded
 */
const exportGameState = (req, res) => {
  const { game, lobbyId } = req;
  
  if (!game) {
    return res.status(404).json({ error: "No active game found" });
  }
  
  try {
    const gameState = game.toJSON();
    gameState.exportedAt = new Date().toISOString();
    gameState.lobbyId = lobbyId;
    
    res.json(gameState);
  } catch (error) {
    console.error("[GameLoader] Failed to export game:", error);
    res.status(500).json({ error: "Failed to export game state" });
  }
};

// Legacy endpoint for backward compatibility
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

  // Game state management routes (no auth required for loading)
  router.post("/:lobbyId/test", configureGame);
  router.post("/:lobbyId/load", loadGameState);
  
  router.use("/:lobbyId", authorizeLobbyMember);
  router.use("/:lobbyId", trackGameActivity);
  
  // Export game state (requires auth)
  router.get("/:lobbyId/export", exportGameState);
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
