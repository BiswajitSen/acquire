const express = require("express");
const { authorize } = require("../middleware/auth");
const { authorizeLobbyMember } = require("../middleware/lobby");

const serveLobbyPage = (req, res) => {
  res.sendFile("lobby.html", { root: "pages" });
};

const doNotJoinIfLobbyIsFull = (req, res, next) => {
  const { lobby } = req;

  if (lobby.isFull()) {
    const error = "Lobby is full!";
    res.status(401).json({ error });
    return;
  }

  next();
};

const checkDuplicateUsername = (req, res, next) => {
  const { lobby } = req;
  const { username } = req.body;
  const { players } = lobby.status();

  if (players.some(p => p.username === username)) {
    return res.status(400).json({ error: "Username already taken in this lobby" });
  }

  next();
};

const joinPlayer = (req, res) => {
  const { lobby, lobbyId } = req;
  const { username } = req.body;

  if (!username || username.trim() === "") {
    return res.status(400).json({ error: "Username is required" });
  }

  lobby.addPlayer({ username: username.trim() });

  const socketBroadcaster = req.app.get("socketBroadcaster");
  if (socketBroadcaster) {
    socketBroadcaster.broadcastLobbyUpdate(lobbyId);
    socketBroadcaster.broadcastLobbyListUpdate();
  }

  res.cookie("username", username.trim());
  res.cookie("lobbyId", lobbyId);
  res.redirect(`/lobby/${lobbyId}`);
};

const sendLobbyStatus = (req, res) => {
  const { lobby, lobbyId } = req;
  const { username } = req.cookies;

  const status = lobby.status(username);
  res.json({ ...status, lobbyId });
};

const leaveLobby = (req, res) => {
  const { lobby, lobbyId } = req;
  const { username } = req.cookies;
  const { lobbyManager } = req.app.context;
  const { hasExpired } = lobby.status();

  if (hasExpired) {
    return res.status(400).json({ error: "Cannot leave after game has started" });
  }

  lobby.removePlayer(username);

  const socketBroadcaster = req.app.get("socketBroadcaster");

  if (lobby.isEmpty()) {
    lobbyManager.deleteLobby(lobbyId);
  } else {
    if (socketBroadcaster) socketBroadcaster.broadcastLobbyUpdate(lobbyId);
  }

  if (socketBroadcaster) socketBroadcaster.broadcastLobbyListUpdate();

  res.clearCookie("username");
  res.clearCookie("lobbyId");
  res.json({ success: true });
};

const createLobbyRouter = () => {
  const router = new express.Router();

  router.param("lobbyId", (req, res, next, lobbyId) => {
    const { lobbyManager } = req.app.context;

    if (!lobbyManager.hasLobby(lobbyId)) {
      return res.redirect("/");
    }

    req.lobby = lobbyManager.getLobby(lobbyId);
    req.lobbyId = lobbyId;
    req.game = lobbyManager.getGame(lobbyId);
    next();
  });

  router.get("/:lobbyId", authorize, authorizeLobbyMember, serveLobbyPage);
  router.post("/:lobbyId/players", doNotJoinIfLobbyIsFull, checkDuplicateUsername, joinPlayer);
  router.get("/:lobbyId/status", authorize, authorizeLobbyMember, sendLobbyStatus);
  router.post("/:lobbyId/leave", authorize, authorizeLobbyMember, leaveLobby);

  return router;
};

module.exports = { createLobbyRouter };
