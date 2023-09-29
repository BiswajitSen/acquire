const authorizeLobbyMember = (req, res, next) => {
  const { players } = req.app.context.lobby.status();
  const { username } = req.cookies;
  const isUser = player => player.username === username;

  if (!players.find(isUser)) {
    res.redirect("/");
    return;
  }

  next();
};

module.exports = { authorizeLobbyMember };
