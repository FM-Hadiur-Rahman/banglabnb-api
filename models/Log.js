// models/Log.js
const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  message: String,
  stack: String,
  userId: String,
  context: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Log", logSchema);
