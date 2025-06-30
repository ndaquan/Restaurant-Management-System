require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const Staff = require("../models/StaffInfor");
const { sendMail } = require("../../config/email");
const { genarateResetToken } = require("../../util");

const cloudinary = require("../../config/cloudinary/index.js");
const multer = require("multer");
const fs = require("fs");
const stream = require("stream");
const passport = require("passport");

const storage = multer.memoryStorage();

exports.upload = multer({ storage: storage });
exports.postSignUp = async (req, res, next) => {
  try {
    const { email, password, phone, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render("register", {
        title: "register",
        error: "Mật khẩu không khớp!",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("register", {
        title: "register",
        error: "Email đã được đăng kí",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 12);

    const trial =
      req.body.trial === "true"
        ? {
            subscription: {
              type: "TRIAL",
              trialEnd: new Date(Date.now() - 60 * 1000),
            },
          }
        : {};

    const user = new User({
      email,
      password: hashedPassword,
      phoneNumber: phone,
      role: "RESOWNER",
      status: "INACTIVE",
      resetToken: hashedToken,
      resetTokenExpiration: Date.now() + 3600000,
      ...trial,
    });

    console.log("🚀 SUBSCRIPTION DEBUG:");
console.log("req.query.trial:", req.query.trial);
console.log("user.subscription:", user.subscription);
console.log("user.subscription.trialEnd:", user.subscription?.trialEnd);

    // await sendMail(email, resetToken, true);
    await user.save();

    res.render("login", {
      layout: "layouts/auth",
      title: "Forgot password",
      title: "Login",
      message: "Hãy kiểm tra email của bạn để xác thực tài khoản",
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

// [POST] => /sign-in
exports.postSignIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.render("login", {
        layout: "layouts/auth",
        title: "Forgot password",
        title: "Login",
        error: "Tài khoản không tồn tại",
      });
    }

    if (user.provider === "google") {
      return res.render("login", {
        layout: "layouts/auth",
        title: "Forgot password",
        title: "Login",
        error:
          "Tài khoản này đã đăng ký bằng Google. Vui lòng đăng nhập bằng Google.",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.render("login", {
        layout: "layouts/auth",
        title: "Forgot password",
        title: "Login",
        error: "Tài khoản của bạn chưa kích hoạt",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("login", {
        layout: "layouts/auth",
        title: "Forgot password",
        title: "Login",
        error: "Mật khẩu sai",
      });
    }

    if (user.subscription?.type === "TRIAL") {
      const now = new Date();
      if (now > new Date(user.subscription.trialEnd)) {
        user.subscription.type = "EXPIRED";
        await user.save();

        return res.render("login", {
          layout: "layouts/auth",
          title: "Login",
          error: "Dùng thử đã hết hạn. Vui lòng chọn gói dịch vụ để tiếp tục.",
        });
      }
    }

    req.session.user = { ...user.toObject() };
    delete req.session.user.password;

    req.session.save(() => {
    if (user.role === "ADMIN") {
      return res.redirect("/owner");   
    }
    if (user.role === "RESOWNER" || user.role === "RESMANAGER") {
      return res.redirect("/admin");   
    }
    if (user.role === "KITCHENSTAFF" || user.role === "WAITER") {
      return res.redirect("/order")
    }
    return res.redirect("/menu");      
  });
  } catch (err) {
    console.error(err);
    res.render("login", {
      layout: "layouts/auth",
      title: "Forgot password",
      title: "Login",
      error: "Có sự cố, vui lòng đăng nhập sau",
    });
  }
};

// [GET] => getResetPassword
exports.getResetPassword = async (req, res, next) => {
  res.render("reset-password", {
    title: "Reset",
    layout: "layouts/auth",
    title: "Forgot password",
  });
};

// [POST] => postNewPassword
exports.postResetNewPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.render("reset-password", {
        layout: "layouts/auth",
        title: "Forgot password",
        title: "Reset",
        error: "Tài khoản không tồn tại",
      });
    }

    const resetToken = await genarateResetToken();
    const hashedToken = await bcrypt.hash(resetToken, 12);

    user.resetToken = hashedToken;
    user.resetTokenExpiration = Date.now() + 3600000;
    await user.save();

    await sendMail(req.body.email, resetToken, false);

    res.render("login", {
      layout: "layouts/auth",
      title: "Forgot password",
      title: "Login",
      message: "Kiểm tra tài khoản email của bạn để thay đổi mật khẩu",
    });
  } catch (err) {
    res.render("reset-password", { message: "Có sự cố, vui lòng thử lại sau" });
  }
};

// [GET] => getNewPassword
exports.getNewPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;

    const users = await User.find({
      resetTokenExpiration: { $gt: Date.now() },
    });

    const user = users.find((u) =>
      bcrypt.compareSync(resetToken, u.resetToken)
    );

    if (!user) {
      return res.render("login", {
        layout: "layouts/auth",
        title: "Forgot password",
        message: "Xác thực tài khoản không thành công, token không hợp lệ",
      });
    }

    res.render("new-password", {
      layout: "layouts/auth",
      title: "Forgot password",
      title: "New Password",
      userId: user._id.toString(),
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

// [POST] => postNewPassword
exports.postNewPassword = async (req, res, next) => {
  try {
    const { userId, password } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/auth/login");
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;
    await user.save();
    res.render("login", {
      message: "Thay đổi mật khẩu thành công!",
      layout: "layouts/auth",
      title: "Forgot password",
    });
  } catch (err) {
    res.redirect("/auth/login");
  }
};
// [get] => getVerify
exports.getVerify = async (req, res, next) => {
  try {
    const { resetToken } = req.params;

    const users = await User.find({
      resetTokenExpiration: { $gt: Date.now() },
    });

    const user = users.find((u) =>
      bcrypt.compareSync(resetToken, u.resetToken)
    );

    if (!user) {
      return res.render("login", {
        layout: "layouts/auth",
        title: "Forgot password",
        title: "Login",
        message: "Xác thực tài khoản không thành công, token không hợp lệ",
      });
    }

    user.status = "ACTIVE";
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;
    await user.save();

    res.render("login", {
      layout: "layouts/auth",
      title: "Forgot password",
      title: "Login",
      message: "Xác thực tài khoản thành công!",
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    console.log("hihi");
    let avatarUrl = null;

    if (req.file) {
      // Upload the new avatar to Cloudinary
      const result = await cloudinary.uploader.upload_stream(
        {
          folder: "avatars",
          public_id: `avatar_${Date.now()}`,
          overwrite: true,
        },
        (error, result) => {
          if (error) {
            console.error("Lỗi khi tải ảnh lên Cloudinary:", error);
            return res
              .status(500)
              .json({ message: "Lỗi khi tải ảnh lên Cloudinary" });
          }

          avatarUrl = result.secure_url;
          console.log(avatarUrl);

          const userId = req.params.id;
          const updatedData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            phoneNumber: req.body.phoneNumber,
            address: req.body.address,
            gender: req.body.gender,
          };

          if (avatarUrl) {
            updatedData.avatar = avatarUrl;
            req.session.user.avatar = avatarUrl;
          }

          // Update user info in the databa se
          User.findByIdAndUpdate(userId, updatedData, { new: true })
            .then((updatedUser) => {
              if (!updatedUser) {
                return res.status(404).json({ message: "User not found" });
              }

              // Update the session with the latest user info
              req.session.user = updatedUser;

              // Render the updated profile page
              return res.render("updateProfile", {
                successMessage: "Cập nhật thông tin cá nhân thành công",
                user: updatedUser,
                userId: userId,
              });
            })
            .catch((error) => {
              console.error("Lỗi khi cập nhật hồ sơ:", error);
              return res
                .status(500)
                .json({ message: "Lỗi khi cập nhật hồ sơ" });
            });
        }
      );

      // Upload the avatar stream to Cloudinary
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);
      bufferStream.pipe(result);
    } else {
      const userId = req.params.id;
      const updatedData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
        address: req.body.address,
        gender: req.body.gender,
      };

      // If no avatar was uploaded, update only the other user data
      User.findByIdAndUpdate(userId, updatedData, { new: true })
        .then((updatedUser) => {
          if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
          }

          // Update the session with the latest user info (without avatar)
          req.session.user = updatedUser;

          return res.render("updateProfile", {
            successMessage: "Cập nhật thông tin cá nhân thành công",
            user: updatedUser,
            userId: userId,
          });
        })
        .catch((error) => {
          console.error("Lỗi khi cập nhật hồ sơ:", error);
          return res.status(500).json({ message: "Lỗi khi cập nhật hồ sơ" });
        });
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật hồ sơ:", error);
    return res.status(500).json({ message: "Lỗi khi cập nhật hồ sơ" });
  }
};

exports.findAll = async (req, res) => {
  try {
    const users = await User.find({});
    res.render("informationUser", { users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser)
      return res.status(404).json({ message: "User not found" });
    res.status(200).json(deletedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.findById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    let staffInfor = null;

    if (!user) {
      return res.render("errorpage");
    }

    if (user.role != "CUSTOMER") {
      staffInfor = await Staff.findOne({ staff: userId });
    }
    console.log(staffInfor);

    const error = req.query.error || "";
    res.render("informationUser", { users: user, staff: staffInfor, error });
  } catch (error) {
    console.error(error);
    res.status(500).send("Lỗi server");
  }
};

exports.renderChangePasswordPage = (req, res) => {
  const userId = req.params.id;

  if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.render("errorpage");
  }

  res.render("changePassword", { userId });
};

exports.renderUpdateProfilePage = async (req, res) => {
  const userId = req.params.id;

  if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.render("errorpage");
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.render("errorpage");
  }

  res.render("updateProfile", { userId, user });
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const userId = req.params.id;

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.render("errorpage");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.render("changePassword", {
        message: "Người dùng không tồn tại!",
        userId,
      });
    }

    const isOldPasswordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordMatch) {
      return res.render("changePassword", {
        message: "Mật khẩu cũ không đúng!",
        userId,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.render("changePassword", {
        message: "Mật khẩu mới không khớp!",
        userId,
      });
    }

    if (newPassword.length < 8) {
      return res.render("changePassword", {
        message: "Mật khẩu mới phải có ít nhất 8 ký tự!",
        userId,
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    return res.render("changePassword", {
      successMessage: "Mật khẩu đã được cập nhật thành công!",
      userId,
    });
  } catch (error) {
    console.error("Lỗi khi đổi mật khẩu:", error);
    return res.render("changePassword", {
      message: "Lỗi server, vui lòng thử lại!",
      userId,
    });
  }
};
// [POST] => postLogout
exports.postLogout = async (req, res, next) => {
  req.session.destroy((err) => {
    res.redirect("/");
  });
};

// [GET] => /auth/google
exports.googleLogin = (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })(req, res, next);
};

// [GET] => /auth/google/callback
exports.googleLoginCallback = (req, res, next) => {
  passport.authenticate(
    "google",
    { failureRedirect: "/auth/login" },
    (err, user) => {
      if (err) return next(err);
      if (!user) return res.redirect("/auth/login");
      req.logIn(user, (err) => {
        if (err) return next(err);
        req.session.user = { ...user };
        delete req.session.user.password;
        req.session.save(() => {
          res.redirect("/");
        });
      });
    }
  )(req, res, next);
};
