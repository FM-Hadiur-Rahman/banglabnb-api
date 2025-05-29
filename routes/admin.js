const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect"); // ✅ Correct path
const authorize = require("../middleware/authorize"); // For role check
const User = require("../models/User");
const Listing = require("../models/Listing");
const Booking = require("../models/Booking");

// Example admin-only route
router.get("/stats", protect, authorize("admin"), async (req, res) => {
  const users = await User.countDocuments();
  const listings = await Listing.countDocuments();
  const bookings = await Booking.countDocuments();

  res.json({ users, listings, bookings });
});

module.exports = router;
