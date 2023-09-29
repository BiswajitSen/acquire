const logRequest = (req, _res, next) => {
  console.log(">", req.method, req.url);
  next();
};

module.exports = { logRequest };
