// === controllers/tripController.js ===
const Trip = require("../models/Trip");

// controllers/tripController.js
exports.createTrip = async (req, res) => {
  try {
    console.log("✅ File received:", req.file);
    console.log("✅ Body received:", req.body);
    console.log("👤 User ID:", req.user._id);

    const tripData = {
      ...req.body,
      driverId: req.user._id,
      // Ensure correct types
      seatsAvailable: Number(req.body.seatsAvailable),
      farePerSeat: Number(req.body.farePerSeat),
      date: new Date(req.body.date),
    };

    if (req.file && req.file.path) {
      tripData.image = req.file.path;
    }

    const trip = await Trip.create(tripData); // this is where crash likely happens
    res.status(201).json(trip);
  } catch (err) {
    console.error("❌ Trip creation failed:", err.message);
    console.error("📦 Stack:", err.stack); // ⬅️ you’ll now see the real reason in logs
    res.status(500).json({ message: err.message });
  }
};

exports.getTrips = async (req, res) => {
  try {
    const trips = await Trip.find({ status: "available" });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
// Get all trips for the logged-in driver
exports.getMyTrips = async (req, res) => {
  try {
    const trips = await Trip.find({ driverId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(trips);
  } catch (err) {
    console.error("❌ Error fetching driver's trips:", err);
    res.status(500).json({ message: "Server error" });
  }
};
