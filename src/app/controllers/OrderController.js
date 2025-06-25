const Table = require("../models/Table");
const Menu = require("../models/Menu");
const Order = require("../models/OrderFood");
exports.viewAllTables = async (req, resp) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0); // Đặt thời gian về 00:00:00

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999); // Đặt thời gian về 23:59:59

  const tables = await Table.aggregate([
    {
      $lookup: {
        from: "orders", // Tên collection của Order trong MongoDB
        localField: "_id",
        foreignField: "table",
        as: "orders",
      },
    },
    {
      $addFields: {
        isInUse: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$orders",
                  as: "order",
                  cond: {
                    $and: [
                      {
                        $gte: [
                          { $arrayElemAt: ["$$order.dishes.orderDate", 0] },
                          todayStart,
                        ],
                      },
                      {
                        $lte: [
                          { $arrayElemAt: ["$$order.dishes.orderDate", 0] },
                          todayEnd,
                        ],
                      },
                      { $eq: ["$$order.statusPayment", "Pending"] },
                    ],
                  },
                },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        orders: 0, // Ẩn danh sách orders, chỉ lấy thông tin bàn và trạng thái sử dụng
      },
    },
  ]);
  resp.render("order/tables", { tables, layout: "layouts/mainAdmin" });
};
exports.viewATable = async (req, resp) => {
  const tableId = req.params.tableId;
  const table = await Table.findOne({ idTable: tableId });
  if (!table) {
    return resp.status(404).send("Table not found");
  }
  const menus = await Menu.find().populate("category");
  resp.render("order/view1Table", { table, menus, layout: "layouts/mainAdmin" });
};
exports.addDishes2Table = async (req, resp) => {
  const { tableId, dishes } = req.body;
  const countMap = dishes.reduce((acc, dishId) => {
    acc[dishId] = (acc[dishId] || 0) + 1;
    return acc;
  }, {});

  const uniqueDishId = Object.keys(countMap);
  const counts = Object.values(countMap);
  const addDishes = await Menu.find({ _id: { $in: uniqueDishId } });
  const sortedDishes = uniqueDishId.map((id) =>
    addDishes.find((dish) => dish._id.toString() === id)
  );
  const table = await Table.findOne({ _id: tableId });
  if (!table) {
    return resp.status(404).send("Table not found with id: " + tableId);
  }
  if (!addDishes.length) {
    return resp.status(404).json({ message: "No dishes found" });
  }
  const dishes2Add = [];
  for (let i = 0; i < sortedDishes.length; i++) {
    dishes2Add.push({
      menuItem: sortedDishes[i],
      quantity: counts[i],
      statusOrder: "Pending",
      typeOrder: "Offline",
    });
  }
  try {
    const order = await Order.findOne({
      table: tableId,
      statusPayment: "Pending",
    })
      .populate("dishes.menuItem")
      .populate("table")
      .populate("bookingTable");
    if (!order) {
      const newOrder = new Order({
        table: table,
        dishes: dishes2Add,
        statusPayment: "Pending",
        paymentMethod: "Cash",
      });
      await newOrder.save();
    } else {
      for (let i = 0; i < dishes2Add.length; i++) {
        let mark = false;
        for (let j = 0; j < order.dishes.length; j++) {
          if (
            dishes2Add[i].menuItem._id.toString() ===
            order.dishes[j].menuItem._id.toString()
          ) {
            order.dishes[j].quantity += dishes2Add[i].quantity;
            mark = true;
          }
        }
        if (!mark) {
          order.dishes.push(dishes2Add[i]);
        }
      }
      await order.save();
    }
  } catch (error) {
    const newOrder = new Order({
      table: table,
      dishes: dishes2Add,
      statusPayment: "Pending",
      paymentMethod: "Cash",
    });
    await newOrder.save();
  }
  resp.json({ message: "Thêm món ăn thành công." });
};
exports.getOrderOfTableID = async (req, resp) => {
  const tableId = req.params.tableId;
  const orders = await Order.find({ table: tableId, statusPayment: "Pending" })
    .populate("dishes.menuItem")
    .populate("table")
    .populate("bookingTable");
  if (orders.length > 1) {
    return resp
      .status(500)
      .json({ error: "Lỗi hệ thống, tìm thấy nhiều hơn 1 order cho bàn này." });
  }
  if (orders.length === 0) {
    return resp.json(null);
  }
  return resp.json(orders[0]);
};
exports.chefViewDishes = async (req, resp) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await Order.aggregate([
      {
        $addFields: {
          firstDishOrderDate: { $arrayElemAt: ["$dishes.orderDate", 0] }, // Extract dishes[0].orderDate
        },
      },
      {
        $match: {
          firstDishOrderDate: { $gte: startOfDay, $lte: endOfDay }, // Filter orders for today
        },
      },
      { $unwind: "$dishes" }, // Unwind dishes
      { $sort: { "dishes.orderDate": 1 } }, // Sort by orderDate (oldest to latest)
    ]);
    resp.render("order/chef", { layout: "layouts/mainAdmin" });
  } catch (error) {
    console.error("Error fetching orders:", error);
  }
};
exports.chefGetDishesOfDay = async (req, resp) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await Order.aggregate([
      {
        $addFields: {
          firstDishOrderDate: { $arrayElemAt: ["$dishes.orderDate", 0] }, // Extract dishes[0].orderDate
        },
      },
      {
        $match: {
          firstDishOrderDate: { $gte: startOfDay, $lte: endOfDay }, // Filter orders for today
        },
      },
      {
        $lookup: {
          from: "tables", // Join with Table collection
          localField: "table",
          foreignField: "_id",
          as: "tableData",
        },
      },
      { $unwind: "$tableData" }, // Convert table array to an object
      { $unwind: "$dishes" }, // Unwind dishes array
      {
        $lookup: {
          from: "menus", // Join with Menu collection
          localField: "dishes.menuItem",
          foreignField: "_id",
          as: "dishes.menuData",
        },
      },
      { $unwind: "$dishes.menuData" }, // Convert menuData array to an object
      { $sort: { "dishes.orderDate": 1 } }, // Sort by orderDate (oldest to latest)
    ]);

    resp.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
  }
};
exports.chefChangeDishStatus = async (req, resp) => {
  const { orderId, dishId, status } = req.body;
  const order = await Order.findById(orderId);
  if (!order) {
    return resp.status(500).json({ error: "Order not found" });
  }
  const dish = order.dishes.find((dish) => dish._id.toString() === dishId);
  if (!dish) {
    return resp.status(500).json({ error: "Dish not found" });
  }
  dish.statusOrder = status;
  await order.save();
  return resp.json({ message: "Change dish status successfully" });
};
exports.deleteDish = async (req, res) => {
    try {
        const { orderId, dishId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

        order.dishes = order.dishes.filter(d => d._id.toString() !== dishId);
        await order.save();

        res.status(200).json({ message: "Đã xoá món thành công" });
    } catch (err) {
        console.error("Error deleting dish:", err);
        res.status(500).json({ error: "Đã xảy ra lỗi khi xoá món" });
    }
};