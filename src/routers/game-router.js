const express = require("express");
const { authorizeLobbyMember } = require("../middleware/lobby");
const { Game, loadGame } = require("../models/game");
const { createCorporations } = require("../models/corporation");
const { createPlayers } = require("../models/player");

const serveGameStats = (req, res) => {
  const { game } = req.app.context;
  const { username } = req.cookies;
  res.send(game.status(username));
};

const serveGamePage = (_, res) => {
  res.sendFile("game.html", { root: "pages" });
};

const placeTile = (req, res) => {
  const { game } = req.app.context;
  const { username } = req.cookies;
  const tile = req.body;

  game.placeTile(username, tile);
  res.status(200).end();
};

const endPlayerTurn = (req, res) => {
  const { game } = req.app.context;
  game.changeTurn();
  res.end();
};

const gameResult = (req, res) => {
  const { game } = req.app.context;
  res.json(game.result);
};

const buyStocks = (req, res) => {
  const { game } = req.app.context;
  const stocks = req.body;

  game.buyStocks(stocks);
  res.end();
};

const establishCorporation = (req, res) => {
  const { game } = req.app.context;
  const { name } = req.body;

  game.establishCorporation({ name });
  res.end();
};

const verifyStart = (req, res, next) => {
  const { lobby } = req.app.context;
  const { isPossibleToStartGame } = lobby.status();

  if (!isPossibleToStartGame) {
    res.redirect("/lobby");
    return;
  }

  next();
};

const startGame = (req, res) => {
  const { lobby, shuffle } = req.app.context;
  const { players } = lobby.status();
  const corporations = createCorporations();

  const game = new Game(createPlayers(players), shuffle, corporations);

  req.app.context.game = game;
  game.start();
  lobby.expire();
  res.end();
};

const verifyHost = (req, res, next) => {
  const { username } = req.cookies;
  const { lobby } = req.app.context;
  const { self, host } = lobby.status(username);

  if (self.username !== host.username) {
    const error = "Invalid request !";
    return res.status(400).json({ error });
  }

  next();
};

const configureGame = (req, res) => {
  const gameData = req.body;
  const game = loadGame(gameData);
  req.app.context.game = game;
  res.status(201).end();
};

const endMerge = (req, res) => {
  const { game } = req.app.context;
  game.endMerge();
  res.status(200).end();
};

const endMergerTurn = (req, res) => {
  const { game } = req.app.context;
  game.endMergerTurn();
  res.status(200).end();
};

const dealDefunctStocks = (req, res) => {
  const { game } = req.app.context;
  const { sell, trade } = req.body;

  game.dealDefunctStocks({ sell, trade });
  res.status(200).end();
};

const resolveConflict = (req, res) => {
  const { game } = req.app.context;
  game.mergeTwoCorporation(req.body);
  res.status(200).end();
};

const validatePlayer = (req, res, next) => {
  const { game } = req.app.context;
  const { username } = req.cookies;
  const currentPlayerName = game.currentPlayerName();
  if (username === currentPlayerName) return next();
  res.status(400).end();
};

const selectAcquirer = (req, res) => {
  const { game } = req.app.context;
  const { acquirer } = req.body;
  game.selectAcquirer(acquirer);
  res.status(200).end();
};

const confirmDefunct = (req, res) => {
  const { game } = req.app.context;
  const { defunct } = req.body;
  game.confirmDefunct(defunct);
  res.status(200).end();
};

const createGameRouter = () => {
  const router = new express.Router();

  router.post("/test", configureGame);
  router.use(authorizeLobbyMember);
  router.get("/", verifyStart, serveGamePage);
  router.post("/start", verifyHost, verifyStart, startGame);
  router.get("/status", serveGameStats);
  router.post("/tile", validatePlayer, placeTile);
  router.post("/end-turn", validatePlayer, endPlayerTurn);
  router.post("/merger/deal", validatePlayer, dealDefunctStocks);
  router.post("/merger/end-turn", validatePlayer, endMergerTurn);
  router.post("/merger/resolve-conflict", validatePlayer, resolveConflict); // {acquirer, defunct}

  router.post("/merger/resolve-acquirer", validatePlayer, selectAcquirer); // {acquirer}
  router.post("/merger/confirm-defunct", validatePlayer, confirmDefunct); // {defunct}

  router.get("/end-result", gameResult);
  router.post("/buy-stocks", validatePlayer, buyStocks);
  router.post("/establish", validatePlayer, establishCorporation);
  router.post("/end-merge", endMerge);

  return router;
};

module.exports = {
  createGameRouter,
};
