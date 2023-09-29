const express = require("express");
const { authorize } = require("../middleware/auth");
const { authorizeLobbyMember } = require("../middleware/lobby");

const serveLobbyPage = (_, res) => {
  res.sendFile("lobby.html", { root: "pages" });
};

const doNotJoinIfLobbyIsFull = (req, res, next) => {
  const { lobby } = req.app.context;

  if (lobby.isFull()) {
    const error = "Lobby is full !";
    res.status(401).json({ error });
    return;
  }

  next();
};

const joinPlayer = (req, res) => {
  const { lobby } = req.app.context;
  const { username } = req.body;

  lobby.addPlayer({ username });

  res.cookie("username", username).redirect("/lobby");
};

const sendLobbyStatus = (req, res) => {
  const { lobby } = req.app.context;
  const { username } = req.cookies;

  res.json(lobby.status(username));
};

const createLobbyRouter = () => {
  const router = new express.Router();

  router.get("/", authorize, authorizeLobbyMember, serveLobbyPage);
  router.post("/players", doNotJoinIfLobbyIsFull, joinPlayer);
  router.get("/status", authorize, authorizeLobbyMember, sendLobbyStatus);

  return router;
};

module.exports = { createLobbyRouter };
