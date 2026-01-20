const express = require("express");
const cookieParser = require("cookie-parser");
const { logRequest } = require("./middleware/logger");
const { errorHandler } = require("./utils/error-handler");
const { createHttpRateLimiter } = require("./utils/rate-limiter");
const { sanitizeMiddleware } = require("./utils/sanitize");

const createApp = (lobbiesRouter, lobbyRouter, gameRouter, context) => {
  const app = express();

  app.context = context;

  app.use(logRequest);
  app.use(express.json({ limit: "1mb" })); // Increased for game state loading
  app.use(cookieParser());
  app.use(sanitizeMiddleware);
  
  app.use("/game", createHttpRateLimiter({ windowMs: 1000, maxRequests: 20 }));
  
  app.use("/", lobbiesRouter);
  app.use("/lobby", lobbyRouter);
  app.use("/game", gameRouter);
  app.use(express.static("public"));
  
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
