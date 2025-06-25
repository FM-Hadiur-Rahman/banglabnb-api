const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  discount: { type: Number, required: true }, // e.g., 200 means ৳200 off
  type: { type: String, enum: ["stay", "ride", "combined"], default: "stay" },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
});

module.exports = mongoose.model("PromoCode", promoCodeSchema);
