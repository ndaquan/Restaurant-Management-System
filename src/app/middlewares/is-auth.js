module.exports = {
  requireAuth: (req, res, next) => {
    if (!req.session.user) {
      return res.redirect("/auth/login");
    }
    res.locals.user = req.session.user || null;
    next();
  },

  setUser: (req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  },

  checkRoleOwner: (req, res, next) => {
    if (!req.session.user || req.session.user.role!== "RESOWNER") {
      return res.redirect('/');
    }
    next();
  }
};
