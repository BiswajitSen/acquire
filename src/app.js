const express = require("express");
const cookieParser = require("cookie-parser");
const { logRequest } = require("./middleware/logger");

const createApp = (lobbiesRouter, lobbyRouter, gameRouter, context) => {
  const app = express();

  app.context = context;

  app.use(logRequest);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/", lobbiesRouter);
  app.use("/lobby", lobbyRouter);
  app.use("/game", gameRouter);
  app.use(express.static("public"));

  return app;
};

module.exports = { createApp };
