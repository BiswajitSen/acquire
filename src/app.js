const express = require("express");
const cookieParser = require("cookie-parser");
const { logRequest } = require("./middleware/logger");

const serveHomePage = (_, res) => {
  res.sendFile("index.html", { root: "pages" });
};

const createApp = (lobbyRouter, gameRouter, context) => {
  const app = express();

  app.context = context;

  app.use(logRequest);
  app.use(express.json());
  app.use(cookieParser());
  app.get("/", serveHomePage);
  app.use("/lobby", lobbyRouter);
  app.use("/game", gameRouter);
  app.use(express.static("public"));

  return app;
};

module.exports = { createApp };
