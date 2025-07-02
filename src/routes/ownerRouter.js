const express = require("express");
const router = express.Router();
const { getOwnerDashboard } = require("../app/controllers/OwnerController");
const isAuth = require("../app/middlewares/is-auth");

router.get("/", isAuth.requireAuth, getOwnerDashboard);

module.exports = router;