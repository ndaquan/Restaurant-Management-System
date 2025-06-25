const mongoose = require('mongoose');
const { Schema } = mongoose;

const RestaurantInforSchema = new Schema({
  restaurantName: { type: String, required: true },
  address: { type: String, required: true },
  openingHours: { type: Date, required: true },
  closingHours: { type: Date, required: true },
  openingDay: { type: String, required: true },
  closingDay: { type: String, required: true },
  bannerUrl: { type: String, required: false },
  hotline: { type: String, required: true },
  email: { type: String, required: true },
  social: [{ type: String, required: true }],
  graphicTable: { type: String, required: true },

});

module.exports = mongoose.model('RestaurantInfor', RestaurantInforSchema);

