const User = require("../models/User")
const Table = require("../models/Table");
const Menu = require("../models/Menu");
const Ingredient = require("../models/Ingredient");
const Order = require("../models/OrderFood");

exports.getDashboard = async (req, res) => {
  try {
    // Lấy số lượng nhân viên (user có role RESMANAGER, WAITER, hoặc KITCHENSTAFF)
    const totalEmployees = await User.countDocuments({
      role: { $in: ["RESMANAGER", "WAITER", "KITCHENSTAFF"] }
    });
    console.log("Total employees:", totalEmployees);
    
    // Lấy số lượng bàn
    const totalTables = await Table.countDocuments();
    console.log("Total tables:", totalTables);
    
    // Lấy số lượng món ăn
    const totalDishes = await Menu.countDocuments();
    console.log("Total dishes:", totalDishes);
    
    // Lấy số lượng nguyên liệu
    const totalIngredients = await Ingredient.countDocuments();
    console.log("Total ingredients:", totalIngredients);

    // Pipeline cho Order (doanh thu từ đặt đồ ăn)
    const orderRevenue = await Order.aggregate([
      { $match: { statusPayment: "Paid" } },
      {
        $unwind: "$dishes" // Mở rộng mảng dishes
      },
      {
        $project: {
          orderDate: "$dishes.orderDate",
          totalPrice: 1,
          hasOrderDate: { $cond: { if: { $eq: [{ $type: "$dishes.orderDate" }, "date"] }, then: true, else: false } }, // Kiểm tra kiểu date
          hasTotalPrice: { $ifNull: ["$totalPrice", 0] } // Mặc định 0 nếu null
        }
      },
      {
        $match: {
          hasOrderDate: true
        }
      },
      {
        $group: {
          _id: { $month: { $ifNull: ["$orderDate", new Date()] } },
          total: { $sum: { $cond: { if: { $gt: ["$hasTotalPrice", 0] }, then: "$hasTotalPrice", else: 0 } } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $match: { total: { $gt: 0 } } } // Lọc kết quả cuối cùng chỉ lấy tổng > 0
    ]);
    console.log("Raw order data with status Paid (first 10):", await Order.find({ statusPayment: "Paid" }).limit(10));
    console.log("Processed order data after unwind and project:", await Order.aggregate([
      { $match: { statusPayment: "Paid" } },
      { $unwind: "$dishes" },
      { $project: { orderDate: "$dishes.orderDate", totalPrice: 1 } }
    ]).limit(10));
    console.log("Order data after project:", await Order.aggregate([
      { $match: { statusPayment: "Paid" } },
      { $unwind: "$dishes" },
      { $project: { orderDate: "$dishes.orderDate", totalPrice: 1, hasOrderDate: { $cond: { if: { $eq: [{ $type: "$dishes.orderDate" }, "date"] }, then: true, else: false } }, hasTotalPrice: { $ifNull: ["$totalPrice", 0] } } }
    ]).limit(10));
    console.log("Order data after match:", await Order.aggregate([
      { $match: { statusPayment: "Paid" } },
      { $unwind: "$dishes" },
      { $project: { orderDate: "$dishes.orderDate", totalPrice: 1, hasOrderDate: { $cond: { if: { $eq: [{ $type: "$dishes.orderDate" }, "date"] }, then: true, else: false } }, hasTotalPrice: { $ifNull: ["$totalPrice", 0] } } },
      { $match: { hasOrderDate: true } }
    ]).limit(10));
    console.log("Order revenue data after aggregation:", orderRevenue);

    // Truyền dữ liệu đến view
    res.render("admin", {
      layout: "layouts/mainAdmin",
      title: "Admin Dashboard",
      totalEmployees,
      totalTables,
      totalDishes,
      totalIngredients,
      orderRevenue: JSON.stringify(orderRevenue)
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).send("Server Error");
  }
};