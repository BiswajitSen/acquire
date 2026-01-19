const resolveLobby = (req, res, next) => {
  const { lobbyManager } = req.app.context;
  const lobbyId = req.params.lobbyId || req.cookies.lobbyId;

  if (!lobbyId || !lobbyManager.hasLobby(lobbyId)) {
    return res.redirect("/");
  }

  req.lobby = lobbyManager.getLobby(lobbyId);
  req.lobbyId = lobbyId;
  req.game = lobbyManager.getGame(lobbyId);
  next();
};

const authorizeLobbyMember = (req, res, next) => {
  const { players } = req.lobby.status();
  const { username } = req.cookies;
  const isUser = player => player.username === username;

  if (!players.find(isUser)) {
    res.redirect("/");
    return;
  }

  next();
};

module.exports = { authorizeLobbyMember, resolveLobby };
