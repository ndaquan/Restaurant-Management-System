const express = require("express");
const router = express.Router();
const dashboardCtrl = require("../app/controllers/DashboardController");

router.get("/", dashboardCtrl.getDashboard);

module.exports = router;
