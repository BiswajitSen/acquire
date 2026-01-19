const { ValidationError } = require("./validation");

class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message
    };
  }
}

const ERROR_TYPES = {
  NOT_FOUND: (resource) => new AppError(404, "NOT_FOUND", `${resource} not found`),
  UNAUTHORIZED: (message = "Unauthorized") => new AppError(401, "UNAUTHORIZED", message),
  FORBIDDEN: (message = "Forbidden") => new AppError(403, "FORBIDDEN", message),
  BAD_REQUEST: (message) => new AppError(400, "BAD_REQUEST", message),
  CONFLICT: (message) => new AppError(409, "CONFLICT", message),
  INTERNAL_ERROR: (message = "Internal server error") => new AppError(500, "INTERNAL_ERROR", message)
};

const errorHandler = (err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: err.message,
      code: err.code,
      errors: err.errors || [err.toJSON()]
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
  }

  console.error("Unhandled error:", err);
  
  return res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR"
  });
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const socketErrorHandler = (socket, error) => {
  const errorResponse = {
    code: error.code || "UNKNOWN_ERROR",
    message: error.message || "An error occurred"
  };

  if (error instanceof ValidationError && error.errors) {
    errorResponse.errors = error.errors;
  }

  socket.emit("error", errorResponse);
};

module.exports = {
  AppError,
  ERROR_TYPES,
  errorHandler,
  asyncHandler,
  socketErrorHandler
};
