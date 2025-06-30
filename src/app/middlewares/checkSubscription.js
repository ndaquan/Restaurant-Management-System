module.exports = (req, res, next) => {
  const user = req.session.user;

  if (!user) return res.redirect("/auth/login");

  // Nếu là trial và đã hết hạn
  if (
    user.subscription?.type === "TRIAL" &&
    new Date() > new Date(user.subscription.trialEnd)
  ) {
    req.session.user.subscription.type = "EXPIRED";
    // Huỷ session luôn nếu muốn đăng nhập lại mới cho rõ ràng
    req.session.destroy(() => {
      return res.redirect("/auth/login?expired=1");
    });
  }

  // Nếu đã hết hạn
  if (user.subscription?.type === "EXPIRED") {
    req.session.destroy(() => {
      return res.redirect("/auth/login?expired=1");
    });
  }

  // Cho truy cập nếu còn hạn
  next();
};