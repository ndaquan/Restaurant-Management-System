const User = require("../models/User");
const RestaurantInfor = require("../models/RestaurantInfor");

const bankMap = {
  "970430": "TPBank",
  "970436": "Vietcombank",
  "970407": "Techcombank",
  "970415": "VietinBank",
  "970405": "Agribank",
  "970443": "VPBank",
  "970432": "Sacombank",
};

exports.getResOwnerDashboard = async (req, res) => {
  try {
    const { search = "", subscription = "", status = "" } = req.query;
    const filter = { role: "RESOWNER" };

    if (subscription) filter["subscription.type"] = subscription;
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { email: regex },
        { phoneNumber: regex },
        { firstName: regex },
      ];
    }

    const resowners = await User.find(filter)
      .populate("restaurant")
      .sort({ createdAt: -1 })
      .lean();

    res.render("ownerDashboard", {
      layout: "layouts/mainAdmin",
      resowners: resowners.map((o) => ({
        ...o,
        restaurantName: o.restaurant?.restaurantName || "N/A",
        bankInfo: o.restaurant?.bankInfo || {},
      })),
      bankMap,
      pagination: "" // nếu muốn có phân trang, thêm logic tại đây
    });
  } catch (err) {
    console.error("[ERROR] Loading RESOWNER dashboard:", err);
    res.status(500).send("Internal Server Error");
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== "RESOWNER") return res.status(404).send("Not found");

    owner.status = owner.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await owner.save();
    res.redirect("/owner/users");
  } catch (err) {
    console.error("[ERROR] Toggling status:", err);
    res.status(500).send("Internal Server Error");
  }
};
