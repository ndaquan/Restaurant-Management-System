const mongoose = require("mongoose");
const { Schema } = mongoose;

const TableSchema = new Schema({
    idTable: { type: String, required: true, unique: true },
    seatNumber: { type: Number, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: false },
    depositPrice: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }, 
    updatedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED'], required: true },
    type: {type: String, enum: ['NORMAL', 'VIP'] , required: true},
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantInfor', required: true },
});

TableSchema.index({ idTable: 1, restaurant: 1 }, { unique: true });

module.exports = mongoose.model("Table", TableSchema);
