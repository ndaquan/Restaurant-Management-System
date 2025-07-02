exports.getOwnerDashboard = async (req, res) => {
  try {
    const user = req.session.user;
    res.render("ownerDashboard", {
      layout: "layouts/mainAdmin", 
      title: "Chủ nhà hàng",
      user,
    });
  } catch (err) {
    console.error("❌ Lỗi khi load dashboard RESOWNER:", err);
    res.render("errorpage", { message: "Lỗi khi hiển thị trang chủ nhà hàng" });
  }
};