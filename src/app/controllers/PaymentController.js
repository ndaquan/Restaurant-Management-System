const TEST_MODE = true;

  require("dotenv").config();
  const axios = require("axios");
  const crypto = require("crypto");
  const BookingTable = require("../models/BookingTable");
  const OrderFood = require("../models/OrderFood");
  const moment = require("moment");
  const RestaurantInfor = require("../models/RestaurantInfor");
  const SubscriptionLog = require("../models/SubscriptionLog");

  exports.checkPaid = async (req, res) => {
    try {
      const description = req.params.description?.trim();
      const amount = parseInt(req.query.amount);

      console.log("Checking payment - Description:", description, "Amount:", amount);

      if (!description || isNaN(amount)) {
        console.log("Invalid input: Missing description or amount");
        return res.status(400).json({
          success: false,
          message: "Thiếu thông tin mô tả hoặc giá trị thanh toán",
        });
      }

      const response = await fetch("https://script.google.com/macros/s/AKfycbxl0dXum3tft_meYCEfi5Bl0e-bXiVlmjJQIkUmLAdG64kSNEFdU2kfTjdxSqKiEQWu/exec");
      if (!response.ok) {
        console.error("Failed to fetch payment data from Google Script, Status:", response.status);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const { data: transactions } = await response.json();

      console.log("Fetched transactions from Google Script:", transactions);
      if (!Array.isArray(transactions) || transactions.length === 0) {
        console.log("No transactions found in response");
        return res.status(404).json({
          success: false,
          message: "Không có dữ liệu giao dịch",
        });
      }

      const cleanedDescription = description.replace(/-/g, "").toLowerCase();

      const matchedTransaction = transactions.find(
        (tx) =>
          tx["Mô tả"]?.replace(/\s/g, "").toLowerCase().includes(cleanedDescription) &&
          Number(tx["Giá trị"]) === amount
      );

      if (!matchedTransaction) {
        console.log(`❌ No matching transaction for ${cleanedDescription} & ${amount}`);
        return res.status(200).json({ success: true, isPaid: false });
      }

      // Tách guestId và plan từ mô tả đã khớp
      const rawDesc = matchedTransaction["Mô tả"].replace(/\s/g, "").toLowerCase();
      const match = rawDesc.match(/([a-f0-9]{16})(monthly|yearly)/);

      if (match) {
        const guestId = match[1];
        const planType = match[2];

        await SubscriptionLog.findOneAndUpdate(
          { guestId, plan: planType, paid: false },
          { paid: true }
        );

        console.log("✅ Thanh toán gói thành công!", { guestId, planType });
        return res.status(200).json({
          success: true,
          isPaid: true,
          redirectUrl: `/auth/register?plan=${planType}&guestId=${guestId}`
        });
      }

      // Nếu không đúng định dạng thì bỏ qua
      return res.status(200).json({
        success: false,
        isPaid: false,
        message: "Mô tả không hợp lệ"
      });
      
    } catch (error) {
      console.error("Lỗi khi kiểm tra thanh toán:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống, vui lòng thử lại sau",
      });
    }
  };

  exports.paymentSuccessPage = (req, res) => {
    const { type, id } = req.query;
    return res.render("payment-success", {
      type,
      id,
    });
  };


  exports.reOpenPayment = async (req, res) => {
    try {
      const { bookingId } = req.params;
      const userId = req.session.user._id;

      const booking = await BookingTable.findById(bookingId)
        .populate("table")
        .populate("customer")
        .exec();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn đặt bàn",
        });
      }

      if (userId.toString() !== booking.customer._id.toString()) {
        return res.redirect("/");
      }

      const moment = require("moment");
      require("moment/locale/vi");

      const now = moment.utc(); // 🕒 lấy thời điểm hiện tại
      const expiresAt = moment.utc(booking.expiresAt); // ⏱ cộng 30 phút từ thời điểm mở lại

      const restaurant = await RestaurantInfor.findOne({ owner: userId });

      if (!restaurant || !restaurant.bankInfo) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin ngân hàng của nhà hàng" });
      }

      const { accountName, accountNo, bankCode } = restaurant.bankInfo;
      const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact.png?amount=${booking.table.depositPrice}&addInfo=${booking._id}`;

      const formattedBooking = {
        ...booking.toObject(),
        orderDay: expiresAt
          .format("dddd")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        orderDate: expiresAt.format("DD/MM/YYYY"),
        orderTime: expiresAt.format("HH:mm"),
        expiresAt: expiresAt.toISOString(),
      };

      return res.render("payment", {
        bookingTable: formattedBooking,
        amount: booking.table.depositPrice.toLocaleString("vi-VN"),
        bankId: bankCode,
        accountNo,
        accountName,
        type: "booking",
        expiryTimeISO: expiresAt.toISOString(),
        qrUrl
      });
    } catch (error) {
      console.error("Lỗi khi mở lại thanh toán:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống, vui lòng thử lại sau",
      });
    }
  };

  exports.paymentOrder = async (req, res) => {
    try {
      const bankNames = {
        "970436": "Vietcombank",
        "970407": "Techcombank",
        "970418": "BIDV",
        "970422": "MBBank",
        "970415": "VietinBank",
        "970405": "Agribank",
        "970423": "TPBank",
        "970443": "VPBank",
        "970432": "Sacombank",
      };
      const userId = req.session.user._id;
      const restaurant = await RestaurantInfor.findOne({ owner: userId });

      if (!restaurant || !restaurant.bankInfo) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin ngân hàng của nhà hàng" });
      }

      const orderId = req.params.orderId;
      const order = await OrderFood.findById(orderId)
        .populate("dishes.menuItem")
        .populate("table")
        .populate("bookingTable");

      const formattedDishes = order.dishes.map(dish => ({
        ...dish.toObject(),
        formattedPrice: Number(dish.menuItem.price).toLocaleString("vi-VN")
      }));

      if (!order) return res.status(404).json({ error: "Order not found." });
      if (order.statusPayment === "Paid")
        return res
          .status(400)
          .json({ error: "This order has already been paid." });

      const totalAmount = order.dishes.reduce(
        (total, dish) => total + dish.menuItem.price * dish.quantity,
        0
      );

      const { accountName, accountNo, bankCode } = restaurant.bankInfo;
      const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact.png?amount=${totalAmount}&addInfo=${order._id}`;

      const createdAt = moment.utc(order.createdAt);
      const formattedOrder = {
        ...order.toObject(),
        orderDay: createdAt
          .format("dddd")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        orderDate: createdAt.format("DD/MM/YYYY"),
        orderTime: createdAt.format("HH:mm"),
      };
      const expiresAt = moment.utc().add(30, "minutes");

      return res.render("payment", {
        bookingTable: {
          ...formattedOrder,
          expiresAt: expiresAt.toISOString(), 
          dishes: formattedDishes
        },
        amount: totalAmount.toLocaleString("vi-VN"),
        bankId: bankNames[bankCode],
        accountNo,
        accountName,
        type: "order",
        qrUrl,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  exports.paymentSubscription = async (req, res) => {
    try {
      const { plan } = req.params;

      if (req.session.user) delete req.session.user;
      res.locals.user = null;

      let amount = 0;
      if (plan === "monthly") amount = TEST_MODE ? 2000 : 2000000;
      else if (plan === "yearly") amount = TEST_MODE ? 2000 : 20000000;
      else return res.status(400).send("Gói không hợp lệ");

      if (!req.session.guestId) {
        req.session.guestId = crypto.randomBytes(8).toString("hex");
      }
      const guestId = req.session.guestId;

      const description = `${guestId}-${plan}`;
      const qrUrl = `https://img.vietqr.io/image/970415-108884575134-compact.png?amount=${amount}&addInfo=${description}`;

      const existingLog = await SubscriptionLog.findOne({ guestId, plan });
      if (!existingLog) {
        await SubscriptionLog.create({
          guestId,
          plan,
          amount,
          paid: false,
          user: null
        });
      }

      return res.render("payment", {
        qrUrl,
        amount: amount.toLocaleString("vi-VN"),
        bankId: process.env.B_ID,
        accountNo: process.env.E_NO,
        accountName: process.env.ACC_NAME,
        type: plan,
        bookingTable: {
          orderDay: "Gói dịch vụ",
          orderDate: moment().format("DD/MM/YYYY"),
          orderTime: moment().format("HH:mm"),
          expiresAt: moment().add(30, "minutes").toISOString(),
        },
        user: { _id: guestId }
      });

    } catch (err) {
      console.error("Lỗi khi hiển thị trang thanh toán gói:", err);
      return res.status(500).send("Lỗi máy chủ");
    }
  };
