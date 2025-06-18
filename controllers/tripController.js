// === controllers/tripController.js ===
const Trip = require("../models/Trip");
const mongoose = require("mongoose");

// controllers/tripController.js
exports.createTrip = async (req, res) => {
  try {
    const tripData = {
      ...req.body,
      driverId: req.user._id,
      seatsAvailable: Number(req.body.seatsAvailable),
      farePerSeat: Number(req.body.farePerSeat),
    };
    // ✅ Parse location from JSON string
    if (req.body.location) {
      try {
        tripData.location = JSON.parse(req.body.location); // Must be GeoJSON: { type: "Point", coordinates: [lng, lat], address: "..." }
      } catch (error) {
        console.warn("⚠️ Invalid location JSON:", req.body.location);
        return res.status(400).json({ message: "Invalid location format" });
      }
    }

    if (req.file && req.file.path) {
      tripData.image = req.file.path;
    }

    const trip = await Trip.create(tripData);
    res.status(201).json(trip);
  } catch (err) {
    console.error("❌ Trip creation failed:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getTrips = async (req, res) => {
  try {
    const trips = await Trip.find({ status: "available" }).populate("driverId");
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
// controllers/tripController.js

exports.getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("driverId", "name phone avatar")
      .populate("passengers.user", "name");

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    res.json(trip);
  } catch (err) {
    console.error("❌ Error fetching trip by ID:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// controllers/tripController.js
exports.reserveSeat = async (req, res) => {
  console.log("🛑 tripId received:", req.params.tripId);

  try {
    const { seats = 1 } = req.body;
    const trip = await Trip.findById(req.params.tripId);

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const existing = trip.passengers.find(
      (p) => p.user && p.user.toString() === req.user._id.toString()
    );
    if (existing) return res.status(400).json({ message: "Already reserved" });

    if (trip.seatsAvailable < seats)
      return res.status(400).json({ message: "Not enough seats available" });

    trip.passengers.push({ user: req.user._id, seats });
    trip.seatsAvailable -= seats;
    await trip.save();

    res.json({ message: "Reserved", trip });
  } catch (err) {
    console.error("❌ Reserve failed:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Cancel reservation
exports.cancelReservation = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const index = trip.passengers.findIndex(
      (p) =>
        p.user && // 👈 prevent TypeError
        p.user.toString() === req.user._id.toString() &&
        p.status !== "cancelled"
    );

    if (index === -1)
      return res.status(400).json({ message: "No active reservation found" });

    const cancelledSeats = trip.passengers[index].seats;
    trip.passengers[index].status = "cancelled";
    trip.passengers[index].cancelledAt = new Date();
    trip.seatsAvailable += cancelledSeats;

    await trip.save();

    res.json({ message: "Cancelled", trip });
  } catch (err) {
    console.error("❌ Cancel failed:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.MyRides = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const trips = await Trip.find({
      passengers: {
        $elemMatch: {
          user: userId,
          status: { $ne: "cancelled" },
        },
      },
    })
      .populate("driverId", "name phone avatar")
      .sort({ date: -1 });

    res.json(trips);
  } catch (err) {
    console.error("❌ Error fetching my rides:", err);
    res.status(500).json({ message: "Server error" });
  }
};
