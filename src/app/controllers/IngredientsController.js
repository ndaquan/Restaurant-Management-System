// /app/controllers/ingredientsController.js
const Ingredient = require("../models/Ingredient");

/* ---------- DANH SÁCH ---------- */
exports.list = async (req, res) => {
  const search = (req.query.search || "").trim();        
  const filter = search
      ? { name: { $regex: search, $options: "i" } }       
      : {};
  const ingredients = await Ingredient.find(filter);
  res.render("editIngredient", {
    layout: "layouts/mainAdmin",
    title : "Kho nguyên liệu",
    ingredients,
    searchQuery: search,
    successMessage: req.query.successMessage,
    errorMessage  : req.query.errorMessage
  });
};

/* ---------- TẠO MỚI ---------- */
exports.renderCreate = (req, res) => {
  res.render("createIngredient", {
    layout: "layouts/mainAdmin",
    title : "Thêm nguyên liệu"
  });
};

exports.create = async (req, res) => {
  const { name, quantity, unit, note } = req.body;
  try {
    await Ingredient.create({ name, quantity, unit, note });
    res.redirect("/admin/editIngredient?successMessage=Thêm nguyên liệu thành công");
  } catch (err) {
    res.render("createIngredient", {
      layout: "layouts/mainAdmin",
      title : "Thêm nguyên liệu",
      errorMessage: "Tên đã tồn tại hoặc thiếu dữ liệu"
    });
  }
};

/* ---------- SỬA ---------- */
exports.renderEdit = async (req, res) => {
  const ing = await Ingredient.findById(req.params.id);
  if (!ing) return res.redirect("/admin/editIngredient?errorMessage=Không tìm thấy nguyên liệu");
  res.render("editIngredientForm", {
    layout: "layouts/mainAdmin",
    title : "Sửa nguyên liệu",
    ing,
    errorMessage: null
  });
};

exports.update = async (req, res) => {
  const { name, unit, note, importQty = "", exportQty = "" } = req.body;
  const importNum = Number(importQty);
  const exportNum = Number(exportQty);

  /* ----- VALIDATION ----- */
  const bothFilled = importQty && exportQty;     // cả hai ô đều có giá trị
  const bothEmpty  = !importQty && !exportQty;   // cả hai ô rỗng

  if (bothFilled) {
    return res.redirect(`${baseUrl}?errorMessage=Chỉ điền 1 ô Xuất hoặc Nhập`);
  }

  if (!bothEmpty) {          // chỉ khi nhập 1 ô thì kiểm tra âm/dương
    if (importNum < 0 || exportNum < 0) {
      return res.redirect(`${baseUrl}?errorMessage=Số lượng phải dương`);
    }
  }
  if (importNum < 0 || exportNum < 0) {
    return res.redirect(`/admin/editIngredient/edit/${req.params.id}?errorMessage=Số lượng phải dương`);
  }

  /* Tính tồn kho mới */
  const ing = await Ingredient.findById(req.params.id);
  if (!ing) return res.redirect("/admin/editIngredient?errorMessage=Không tìm thấy nguyên liệu");

  let newQty = ing.quantity;
  if (importQty) newQty += importNum;
  if (exportQty) newQty -= exportNum;

  if (newQty < 0) {
    return res.redirect(`/admin/editIngredient/edit/${req.params.id}?errorMessage=Tồn kho không đủ để xuất`);
  }

  /* Cập nhật */
  await Ingredient.findByIdAndUpdate(req.params.id, {
    name,
    unit,
    note,
    quantity: newQty
  });

  res.redirect("/admin/editIngredient?successMessage=Cập nhật thành công");
};

/* ---------- XOÁ ---------- */
exports.remove = async (req, res) => {
  await Ingredient.findByIdAndDelete(req.params.id);
  res.redirect("/admin/editIngredient?successMessage=Xoá thành công");
};
