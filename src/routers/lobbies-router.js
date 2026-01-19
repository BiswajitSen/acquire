const express = require("express");
const { LOBBY_SIZE } = require("../constants");

const serveHomePage = (_, res) => {
  res.sendFile("index.html", { root: "pages" });
};

const listLobbies = (req, res) => {
  const { lobbyManager } = req.app.context;
  const lobbies = lobbyManager.getAllLobbies();
  res.json({ lobbies });
};

const hostLobby = (req, res) => {
  const { lobbyManager } = req.app.context;
  const { username } = req.body;

  if (!username || username.trim() === "") {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const lobbyId = lobbyManager.createLobby(LOBBY_SIZE, username.trim());
    
    const socketBroadcaster = req.app.get("socketBroadcaster");
    if (socketBroadcaster) socketBroadcaster.broadcastLobbyListUpdate();
    
    res.cookie("username", username.trim());
    res.cookie("lobbyId", lobbyId);
    res.status(201).json({ lobbyId });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
};

const getServerStats = (req, res) => {
  const { lobbyManager } = req.app.context;
  res.json(lobbyManager.getStats());
};

const createLobbiesRouter = () => {
  const router = new express.Router();

  router.get("/", serveHomePage);
  router.get("/list", listLobbies);
  router.get("/stats", getServerStats);
  router.post("/host", hostLobby);

  return router;
};

module.exports = { createLobbiesRouter };
