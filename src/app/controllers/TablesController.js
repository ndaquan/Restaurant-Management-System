const Table = require("../models/Table");
const cloudinary = require("../../config/cloudinary/index");
const multer = require("multer");

const storage = multer.memoryStorage();
exports.upload = multer({ storage: storage });

exports.getTables = async (req, res) => {
    try {
        const searchQuery = req.query.search ? req.query.search.trim() : "";
        const typeFilter = req.query.type ? req.query.type.trim() : "";
        
        let queryCondition = { restaurant: req.user.restaurant };
        if (searchQuery) {
            queryCondition.$or = [
                { idTable: { $regex: new RegExp(searchQuery, "i") } },
                { description: { $regex: new RegExp(searchQuery, "i") } }
            ];

        }
        if (typeFilter) {
            queryCondition.type = typeFilter;
        }
        
        const tables = await Table.find(queryCondition);
        return res.render("viewTables", {
            layout: "layouts/mainAdmin",
            title: "Danh sách bàn",
            tables,
            searchQuery,
            selectedType: typeFilter,
        });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách bàn:", error);
        return res.render("errorpage", { message: "Lỗi hệ thống, vui lòng thử lại" });
    }
};

exports.getTableDetail = async (req, res) => {
    const { tableId } = req.params;
    try {
        const table = await Table.findById({ _id: tableId, restaurant: req.user.restaurant });
        if (!table) {
            return res.render("errorpage", { message: "Bàn không tồn tại" });
        }
        return res.render("viewDetailTable", {
            layout: "layouts/mainAdmin",
            title: "Chi tiết bàn",
            table,
        });
    } catch (error) {
        console.error("Lỗi khi lấy thông tin bàn:", error);
        return res.render("errorpage", { message: "Lỗi hệ thống, vui lòng thử lại" });
    }
};

exports.updateTable = async (req, res) => {
    const { tableId } = req.params;
    const { seatNumber, description, depositPrice, status, type } = req.body;

    if (!seatNumber || !depositPrice || !status || !type) {
        return res.render('editTable', {
            layout: 'layouts/mainAdmin',
            title: 'Chỉnh sửa bàn',
            table: { _id: tableId, seatNumber, description, depositPrice, status, type },
            errorMessage: 'Vui lòng điền đầy đủ thông tin bắt buộc',
            successMessage: null
        });
    }

    try {
        const table = await Table.findById({ _id: tableId, restaurant: req.user.restaurant });
        if (!table) {
            return res.render('errorpage', { message: 'Bàn không tồn tại' });
        }

        let newImageUrl = table.imageUrl; 
       
        if (req.file) {
            try {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { folder: 'tables' },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(req.file.buffer);
                });
                
                if (table.imageUrl) {
                    const publicId = table.imageUrl.split('/').pop().split('.')[0];
                    await cloudinary.uploader.destroy(`tables/${publicId}`);
                }

                newImageUrl = result.secure_url; 
            } catch (uploadError) {
                console.error('Lỗi khi tải ảnh lên Cloudinary:', uploadError);
                return res.render('errorpage', { message: 'Lỗi khi tải ảnh lên Cloudinary' });
            }
        }

        table.seatNumber = parseInt(seatNumber, 10); 
        table.description = description || ''; 
        table.imageUrl = newImageUrl;
        table.depositPrice = parseFloat(depositPrice); 
        table.status = status.toUpperCase(); 
        table.type = type.toUpperCase(); 
        table.updatedAt = Date.now();

        await table.save();

        return res.redirect('/admin/tables/');
    } catch (error) {
        console.error('Lỗi khi cập nhật bàn:', error);
        return res.render('errorpage', { message: 'Lỗi hệ thống, vui lòng thử lại' });
    }
};

exports.createTables = async (req, res) => {
    try {
        const { idTable, seatNumber, description, depositPrice, status, type } = req.body;
        let imageUrl = null;

        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: "tables" },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(req.file.buffer);
            });

            imageUrl = result.secure_url;
        }

        const formattedStatus = status.toUpperCase();
        const formattedType = type.toUpperCase();
        
        if (!['AVAILABLE', 'RESERVED', 'OCCUPIED'].includes(formattedStatus)) {
            return res.render("addTable", { 
                layout: "layouts/mainAdmin",
                title: "Thêm Bàn Mới",
                errorMessage: "Trạng thái bàn không hợp lệ!",
                idTable, seatNumber, description, depositPrice, status, type
            });
        }

        if (!['NORMAL', 'VIP'].includes(formattedType)) {
            return res.render("addTable", { 
                layout: "layouts/mainAdmin",
                title: "Thêm Bàn Mới",
                errorMessage: "Loại bàn không hợp lệ!",
                idTable, seatNumber, description, depositPrice, status, type
            });
        }

        const newTable = new Table({
            idTable,
            seatNumber,
            description,
            imageUrl,
            depositPrice,
            status: formattedStatus,
            type: formattedType,
            restaurant: req.user.restaurant
        });

        await newTable.save();
        return res.render("addTable", { 
            layout: "layouts/mainAdmin",
            title: "Thêm Bàn Mới",
            successMessage: "Thêm bàn thành công!",
            idTable: "", seatNumber: "", description: "", depositPrice: "", status: "AVAILABLE", type: "NORMAL"
        });
    } catch (error) {
        console.error("Lỗi khi tạo bàn:", error);
        return res.render("addTable", { 
            layout: "layouts/mainAdmin",
            title: "Thêm Bàn Mới",
            errorMessage: "Có lỗi xảy ra khi thêm bàn.",
            idTable: req.body?.idTable || "",
            seatNumber: req.body?.seatNumber || "",
            description: req.body?.description || "",
            depositPrice: req.body?.depositPrice || "",
            status: req.body?.status || "AVAILABLE",
            type: req.body?.type || "NORMAL"
        });
    }
};


exports.deleteTable = async (req, res) => {
    const { tableId } = req.params;
    try {
        await Table.findByIdAndDelete({ _id: tableId, restaurant: req.user.restaurant });
        return res.redirect("/admin/tables");
    } catch (error) {
        console.error("Lỗi khi xóa bàn:", error);
        return res.render("errorpage", { message: "Lỗi hệ thống, vui lòng thử lại" });
    }
};

exports.getEditTableForm = async (req, res) => {
    try {
        const table = await Table.findById({ _id: req.params.tableId, restaurant: req.user.restaurant });
        if (!table) {
            return res.render("errorpage", { message: "Bàn không tồn tại" });
        }
        return res.render("editTable", { 
            layout: "layouts/mainAdmin",
            title: "Chỉnh sửa bàn",
            table,
            errorMessage: null,  
            successMessage: null 
        });
    } catch (error) {
        console.error("Lỗi khi lấy thông tin bàn:", error);
        return res.render("errorpage", { message: "Lỗi hệ thống, vui lòng thử lại" });
    }
  };
  
exports.addTables = (req, res) => {
    res.render("addTable", { 
        layout: "layouts/mainAdmin",
        title: "Thêm Bàn Mới",
        idTable: "",
        seatNumber: "",
        description: "",
        depositPrice: "",
        status: "AVAILABLE",
        type: "NORMAL",
        errorMessage: null,
        successMessage: null
    });
  };
  

