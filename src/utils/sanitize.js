const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  
  return str
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
};

const sanitizeObject = (obj, maxDepth = 5, currentDepth = 0) => {
  if (currentDepth > maxDepth) return null;
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }
  
  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth, currentDepth + 1));
  }
  
  if (typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value, maxDepth, currentDepth + 1);
    }
    return sanitized;
  }
  
  return obj;
};

const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

const sanitizeSocketData = (data) => {
  return sanitizeObject(data);
};

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeMiddleware,
  sanitizeSocketData
};
