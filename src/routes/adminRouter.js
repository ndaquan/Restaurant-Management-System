const express = require("express");
const router = express.Router();
const dashboardCtrl = require("../app/controllers/DashboardController");
const isAuth = require("../app/middlewares/is-auth");

router.get("/", isAuth.requireAuth, dashboardCtrl.getDashboard);

module.exports = router;
