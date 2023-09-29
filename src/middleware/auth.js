const authorize = (req, res, next) => {
  if (!req.cookies.username) {
    res.redirect("/");
    return;
  }

  next();
};

module.exports = { authorize };
