const express = require("express");
const authRouter = require("./authRouter");
const siteRouter = require("./siteRouter");
const bookingRouter = require("./bookingTableRouter");
const restaurantRouter = require("./restaurantsRouter");
const { getFooterData } = require("../app/controllers/RestaurantsController");
const userRoutes = require("./usersRoutes");
const isAuth = require("../app/middlewares/is-auth");
const BookingTable = require("../app/models/BookingTable");
const Table = require("../app/models/Table");
const User = require("../app/models/User");
const staffRouter = require("./staffRouter");
const router = express.Router();
const menuRoutes = require("./menuRoutes");
const payment = require("./paymentRoutes");
const ingredientsRouter = require("./ingredientsRouter");
const adminRouter = require("./adminRouter");
const checkSubscription = require("../app/middlewares/checkSubscription")

const orderRoutes = require('./orderRoutes');

  

const tableRouter = require('./tablesRouter')
const { getAllTable } = require('../app/controllers/TablesController');
const editMenuRoutes = require('./editMenuRoutes');
const takeCareRouter = require('./takecareRouter');
const newsRoutes = require('./newsRoutes');
const editNewsRoutes = require('./editNewsRoutes');

  function routes(app) {
  app.use('/news',isAuth.setUser, getFooterData, newsRoutes);
  app.use('/admin/adminNews', isAuth.setUser, editNewsRoutes);
  app.use('/menu',isAuth.setUser, getFooterData, menuRoutes);
  app.use('/admin/editMenu', isAuth.setUser, editMenuRoutes);

  app.use("/restaurantInfor", isAuth.setUser,getFooterData, restaurantRouter);
  app.use("/auth", authRouter);
  app.use("/", isAuth.setUser, getFooterData, siteRouter);
  app.use('/order', orderRoutes);
  app.use('/admin', isAuth.setUser, checkSubscription, adminRouter);

  app.use("/bookingTable", bookingRouter);
  app.use("/payment", payment);
  app.use("/users", userRoutes);
  app.use("/admin/staffs", staffRouter);
  app.use('/admin/takeCare', takeCareRouter);
  app.use('/admin/tables', tableRouter);
  app.use("/admin/editIngredient", isAuth.requireAuth, ingredientsRouter);

  app.post("/bookingTable", async (req, res) => {
    try {
      const { userId, tableId, orderDate, timeUse, request } = req.body;

      // Kiểm tra user có tồn tại không
      const user = await User.findById(userId);
      if (!user) {
        return res.status(400).json({ message: "Người dùng không tồn tại." });
      }

      // Kiểm tra bàn có tồn tại không
      const table = await Table.findById(tableId);
      if (!table) {
        return res.status(400).json({ message: "Bàn không tồn tại." });
      }

      // Kiểm tra bàn có bị trùng thời gian đặt không
      const existingBooking = await BookingTable.findOne({
        table: tableId,
        orderDate: new Date(orderDate),
        $expr: {
          $lte: [
            { $abs: { $subtract: ["$timeUse", timeUse] } },
            3 * 60 * 60 * 1000, // 3 giờ
          ],
        },
      });

      if (existingBooking) {
        return res
          .status(400)
          .json({ message: "Bàn đã được đặt trong khoảng thời gian này." });
      }

      // Tạo mới bookingTable
      const newBooking = new BookingTable({
        quantity: table.seatNumber,
        orderDate: new Date(orderDate),
        timeUse,
        customer: userId,
        table: tableId,
        request,
      });

      await newBooking.save();

      res
        .status(201)
        .json({ message: "Đặt bàn thành công!", booking: newBooking });
    } catch (error) {
      console.error("Lỗi khi đặt bàn:", error);
      res.status(500).json({ message: "Lỗi máy chủ, vui lòng thử lại sau." });
    }
  });
}

module.exports = routes;
