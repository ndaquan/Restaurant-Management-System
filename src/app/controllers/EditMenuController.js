const Menu = require('../models/Menu');
const CategoryFood = require('../models/CategoryFood');

const stream = require("stream");
const cloudinary = require('../../config/cloudinary/index')

exports.getList = async (req, res) => {
  try {
    const menus = await Menu.find().populate('category');
    res.render('editMenu', { menus, layout: 'layouts/mainAdmin' });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.renderDetailDish = async (req, res) => {
  try {
    const dish = await Menu.findById(req.params.id).populate('category');
    if (!dish) {
      return res.status(404).send("Món ăn không tồn tại");
    }
    res.render("detailDish", { dish, layout: "layouts/mainAdmin" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};


exports.deleteDish = async (req, res) => {
  try {
    const dishId = req.params.id;
    const deletedDish = await Menu.findByIdAndDelete(dishId);
    if (!deletedDish) {
      return res.status(404).json({ error: 'Dish not found' });
    }
    res.status(200).json({ message: 'Dish deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.renderCreateForm = async (req, res) => {
  try {
    const categories = await CategoryFood.find();
    res.render('createDish', { categories, layout: 'layouts/mainAdmin' });
  } catch (err) {
    res.status(500).send(err.message);
  }
};


exports.createDish = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Không có ảnh nào được tải lên." });
      }

       // Tạo stream upload ảnh lên Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "dishes", // Lưu ảnh vào folder 'dishes'
        public_id: `dish_${Date.now()}`,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          console.error("Lỗi khi tải ảnh món ăn lên Cloudinary:", error);
          return res.status(500).json({ message: "Lỗi khi tải ảnh lên Cloudinary" });
        }
        
        // Lấy URL ảnh trả về từ Cloudinary
        const dishImageUrl = result.secure_url;
        console.log("Ảnh món ăn:", dishImageUrl);

        // Tạo món ăn mới với URL ảnh từ Cloudinary
        const newDish = new Menu({
          foodName: req.body.foodName,
          description: req.body.description,
          price: req.body.price,
          imageUrl: dishImageUrl,
          statusFood: "AVAILABLE",
          // Nếu cần, set category mặc định hoặc lấy từ form:
          category: req.body.category
        });

        newDish.save()
          .then(dish => {
            res.json({ success: true, message: "Tải ảnh món ăn thành công!", dish });
          })
          .catch(err => {
            console.error("Lỗi khi lưu món ăn:", err);
            res.status(500).json({ message: "Lỗi khi lưu món ăn." });
          });
      }
    );

    // Chuyển buffer từ multer thành stream và pipe lên Cloudinary
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);
    bufferStream.pipe(uploadStream);

  } catch (error) {
    console.error("Lỗi khi tải ảnh món ăn:", error);
    res.status(500).json({ message: "Lỗi khi tải ảnh món ăn." });
  }
};

exports.renderEditForm = async (req, res) => {
  try {
    const dish = await Menu.findById(req.params.id);
    const categories = await CategoryFood.find();
    if (!dish) return res.status(404).send('Dish not found');
    res.render('editDish', { dish, categories, layout: 'layouts/mainAdmin' });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.updateDish = async (req, res) => {
  try {
    const dishId = req.params.id;
    // Chuẩn bị dữ liệu cập nhật từ form
    let updateData = {
      foodName: req.body.foodName,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      // Nếu admin không chọn file mới, có thể giữ lại imageUrl cũ từ form (nếu có)
      imageUrl: req.body.imageUrl 
    };

    // Nếu có file mới được tải lên, sử dụng stream để upload lên Cloudinary
    if (req.file) {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "dishes", // Lưu ảnh vào folder 'dishes'
          public_id: `dish_${Date.now()}`,
          overwrite: true,
        },
        async (error, result) => {
          if (error) {
            console.error("Lỗi khi tải ảnh món ăn lên Cloudinary:", error);
            return res.status(500).json({ message: "Lỗi khi tải ảnh lên Cloudinary" });
          }
          // Lấy URL mới từ Cloudinary
          updateData.imageUrl = result.secure_url;
          // Cập nhật món ăn với dữ liệu mới
          const updatedDish = await Menu.findByIdAndUpdate(dishId, updateData, { new: true });
          if (!updatedDish) {
            return res.status(404).json({ success: false, message: "Món ăn không tồn tại!" });
          }
          return res.status(200).json({ success: true, message: "Cập nhật món ăn thành công!", dish: updatedDish });
        }
      );

      // Chuyển buffer từ multer (memoryStorage) thành stream và pipe lên Cloudinary
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);
      bufferStream.pipe(uploadStream);
    } else {
      // Nếu không có file mới, cập nhật trực tiếp với updateData (bao gồm imageUrl cũ từ form)
      const updatedDish = await Menu.findByIdAndUpdate(dishId, updateData, { new: true });
      if (!updatedDish) {
        return res.status(404).json({ success: false, message: "Món ăn không tồn tại!" });
      }
      return res.status(200).json({ success: true, message: "Cập nhật món ăn thành công!", dish: updatedDish });
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật món ăn:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.searchDish = async (req, res) => {
  try {
    const { q } = req.query;
    const dishes = await Menu.find({
      foodName: { $regex: q, $options: 'i' }  // tìm kiếm không phân biệt hoa thường
    }).populate('category');
      res.status(200).json(dishes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};