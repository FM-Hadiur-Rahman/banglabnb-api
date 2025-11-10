const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const connectDB = require("../config/db");

dotenv.config();

(async () => {
  try {
    await connectDB();
    const result = await User.updateMany(
      {},
      { $unset: { "paymentDetails.verified": "" } }
    );
    console.log("✅ Cleanup done:", result);
    process.exit(0);
  } catch (err) {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  }
})();
