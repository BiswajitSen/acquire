class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 100;
    this.clients = new Map();
    
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
    this.cleanupInterval.unref();
  }

  isAllowed(clientId) {
    const now = Date.now();
    const client = this.clients.get(clientId);

    if (!client) {
      this.clients.set(clientId, {
        count: 1,
        windowStart: now
      });
      return true;
    }

    if (now - client.windowStart > this.windowMs) {
      client.count = 1;
      client.windowStart = now;
      return true;
    }

    if (client.count >= this.maxRequests) {
      return false;
    }

    client.count++;
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [clientId, client] of this.clients) {
      if (now - client.windowStart > this.windowMs * 2) {
        this.clients.delete(clientId);
      }
    }
  }

  reset(clientId) {
    this.clients.delete(clientId);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.clients.clear();
  }
}

class SocketRateLimiter {
  constructor(options = {}) {
    this.limiters = new Map();
    this.defaultOptions = {
      windowMs: options.windowMs || 1000,
      maxRequests: options.maxRequests || 10
    };
    this.eventLimits = options.eventLimits || {};
  }

  getLimiter(event) {
    if (!this.limiters.has(event)) {
      const options = this.eventLimits[event] || this.defaultOptions;
      this.limiters.set(event, new RateLimiter(options));
    }
    return this.limiters.get(event);
  }

  isAllowed(socketId, event) {
    const limiter = this.getLimiter(event);
    return limiter.isAllowed(`${socketId}:${event}`);
  }

  middleware() {
    return (socket, next) => {
      const originalOn = socket.on;
      const self = this;

      socket.on = function(event, handler) {
        const wrappedHandler = (...args) => {
          if (!self.isAllowed(socket.id, event)) {
            socket.emit("error", {
              code: "RATE_LIMITED",
              message: "Too many requests. Please slow down."
            });
            return;
          }
          handler.apply(this, args);
        };
        
        return originalOn.call(this, event, wrappedHandler);
      };

      next();
    };
  }

  destroy() {
    for (const limiter of this.limiters.values()) {
      limiter.destroy();
    }
    this.limiters.clear();
  }
}

const createHttpRateLimiter = (options = {}) => {
  const limiter = new RateLimiter({
    windowMs: options.windowMs || 60000,
    maxRequests: options.maxRequests || 100
  });

  const middleware = (req, res, next) => {
    const clientId = req.ip || req.cookies?.username || "unknown";
    
    if (!limiter.isAllowed(clientId)) {
      return res.status(429).json({
        error: "Too many requests",
        code: "RATE_LIMITED",
        retryAfter: Math.ceil(limiter.windowMs / 1000)
      });
    }
    
    next();
  };

  middleware.destroy = () => limiter.destroy();
  
  return middleware;
};

module.exports = {
  RateLimiter,
  SocketRateLimiter,
  createHttpRateLimiter
};
