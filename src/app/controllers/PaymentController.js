  require("dotenv").config();
  const axios = require("axios");
  const crypto = require("crypto");
  const BookingTable = require("../models/BookingTable");
  const OrderFood = require("../models/OrderFood");
  const moment = require("moment");

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

      const responseJson = await response.json();
      const transactions = responseJson.data;

      console.log("Fetched transactions from Google Script:", transactions);
      if (!Array.isArray(transactions) || transactions.length === 0) {
        console.log("No transactions found in response");
        return res.status(404).json({
          success: false,
          message: "Không có dữ liệu giao dịch",
        });
      }

      const isPaid = transactions.some(
        (item) =>
          item["Mô tả"]?.includes(description) &&
          parseInt(item["Giá trị"]) === amount
      );

      console.log("Payment status check result - Is Paid:", isPaid, "Transactions checked:", transactions);

      if (!isPaid) {
        console.log(
          `No matching transaction found for description: ${description} and amount: ${amount}`
        );
      }

      const booking = await BookingTable.findById(description);
      let order = null;  // khai báo ngoài để dùng được sau

      if (booking) {
        console.log("Found booking:", booking);
        booking.isPaid = isPaid;
        await booking.save();
        console.log("Booking updated - isPaid:", isPaid);
      } else {
        order = await OrderFood.findById(description).populate("dishes.menuItem");
        if (order) {
          console.log("Found order:", order);
          order.statusPayment = isPaid ? "Paid" : "Pending";
          // Cập nhật totalPrice nếu chưa có
          if (isPaid && !order.totalPrice) {
            const totalAmount = order.dishes.reduce(
              (total, dish) => total + (dish.menuItem?.price || 0) * dish.quantity,
              0
            );
            order.totalPrice = totalAmount;
            console.log("Calculated and updated totalPrice:", totalAmount);
          }
          await order.save();
          console.log("Order updated - statusPayment:", order.statusPayment, "Order ID:", order._id, "totalPrice:", order.totalPrice);
        } else {
          console.log("No booking or order found for description:", description);
        }
      }

      if (isPaid) {
        console.log("Payment successful, redirecting to:", `/payment-success?type=${booking ? "booking" : "order"}&id=${description}`);
        return res.status(200).json({
          success: true,
          isPaid: true,
          redirectUrl: `/payment-success?type=${booking ? "booking" : "order"}&id=${description}`
        });
      } else {
        console.log("Payment not found, returning false");
        return res.status(200).json({ success: true, isPaid: false });
      }
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
      console.log("Đơn đặt bàn:", booking);

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
        amount: booking.table.depositPrice,
        bankId: process.env.B_ID,
        accountNo: process.env.E_NO,
        accountName: process.env.ACC_NAME,
        type: "booking",
        expiryTimeISO: expiresAt.toISOString()
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
      const orderId = req.params.orderId;
      const order = await OrderFood.findById(orderId)
        .populate("dishes.menuItem")
        .populate("table")
        .populate("bookingTable");

      if (!order) return res.status(404).json({ error: "Order not found." });
      if (order.statusPayment === "Paid")
        return res
          .status(400)
          .json({ error: "This order has already been paid." });

      const totalAmount = order.dishes.reduce(
        (total, dish) => total + dish.menuItem.price * dish.quantity,
        0
      );

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
          expiresAt: expiresAt.toISOString(), // thêm expiresAt để không bị lỗi EJS
        },
        amount: totalAmount,
        bankId: process.env.B_ID,
        accountNo: process.env.E_NO,
        accountName: process.env.ACC_NAME,
        type: "order",
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };
