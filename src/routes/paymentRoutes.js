const express = require("express");
const paymentRouter = express.Router();
const isAuth = require("../app/middlewares/is-auth");
const paymentController = require("../app/controllers/PaymentController");

paymentRouter.get(
  "/:description/checkPaid",
  isAuth.requireAuth,
  paymentController.checkPaid
);
paymentRouter.get(
  "/:bookingId",
  isAuth.requireAuth,
  paymentController.reOpenPayment
);
paymentRouter.get(
  "/:orderId/order",
  isAuth.requireAuth,
  paymentController.paymentOrder
);

module.exports = paymentRouter;
