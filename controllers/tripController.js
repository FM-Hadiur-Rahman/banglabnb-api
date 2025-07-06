// === controllers/tripController.js ===
const Trip = require("../models/Trip");
const cloudinary = require("../middleware/cloudinary");
const sendEmail = require("../utils/sendEmail");
const User = require("../models/User");

exports.createTrip = async (req, res) => {
  try {
    const tripData = {
      ...req.body,
      driverId: req.user._id,
      totalSeats: Number(req.body.totalSeats),
      farePerSeat: Number(req.body.farePerSeat),
    };

    if (req.body.location) {
      try {
        tripData.location = JSON.parse(req.body.location);
      } catch (error) {
        console.warn("⚠️ Invalid location JSON:", req.body.location);
        return res.status(400).json({ message: "Invalid location format" });
      }
    }

    if (req.file && req.file.path) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: "trip_vehicles",
      });
      tripData.image = uploaded.secure_url;
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
    const trips = await Trip.find({ status: { $nin: ["cancelled"] } }).populate(
      "driverId"
    );
    res.json(trips);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

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

exports.updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    // 🚫 Check if trip belongs to user
    if (trip.driverId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized to edit this trip" });
    }
    if (trip.passengers?.some((p) => p.status !== "cancelled")) {
      return res
        .status(400)
        .json({ message: "Cannot edit trip with active reservations." });
    }

    // 🚫 Block editing if trip already started
    const now = new Date();
    const tripStart = new Date(`${trip.date}T${trip.time}`);
    if (tripStart < now) {
      return res
        .status(400)
        .json({ message: "Trip already departed. Editing not allowed." });
    }

    const {
      from,
      to,
      date,
      time,
      totalSeats,
      farePerSeat,
      vehicleType,
      vehicleModel,
      licensePlate,
    } = req.body;

    const newStart = new Date(`${date}T${time}`);
    if (newStart < now) {
      return res
        .status(400)
        .json({ message: "New trip time must be in the future" });
    }

    trip.from = from;
    trip.to = to;
    trip.date = date;
    trip.time = time;
    trip.totalSeats = Number(totalSeats);
    trip.farePerSeat = Number(farePerSeat);
    trip.vehicleType = vehicleType;
    trip.vehicleModel = vehicleModel;
    trip.licensePlate = licensePlate;

    if (req.body.location) {
      try {
        trip.location = JSON.parse(req.body.location);
      } catch {
        return res.status(400).json({ message: "Invalid location format" });
      }
    }

    if (req.file && req.file.path) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: "trip_vehicles",
      });
      trip.image = uploaded.secure_url;
    }

    await trip.save();
    res.json({ message: "✅ Trip updated", trip });
  } catch (err) {
    console.error("❌ Trip update failed:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.cancelTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    // 🚫 Only driver can cancel
    if (trip.driverId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized to cancel this trip" });
    }

    // 🚫 Cannot cancel past or already cancelled trip
    const tripStart = new Date(`${trip.date}T${trip.time}`);
    if (tripStart < new Date()) {
      return res
        .status(400)
        .json({ message: "Trip already started or expired" });
    }

    if (trip.status === "cancelled") {
      return res.status(400).json({ message: "Trip already cancelled" });
    }

    // ✅ Optional: Save cancellation reason
    trip.status = "cancelled";
    trip.cancelledAt = new Date();
    if (req.body.reason) trip.cancelReason = req.body.reason;

    await trip.save();
    for (const p of trip.passengers) {
      const passengerUser = await User.findById(p.user);
      if (passengerUser?.email) {
        await sendEmail({
          to: passengerUser.email,
          subject: "Trip Cancelled",
          html: `<p>Hello ${passengerUser.name},</p>
        <p>We regret to inform you that your ride from <b>${trip.from}</b> to <b>${trip.to}</b> on <b>${trip.date}</b> has been cancelled by the driver.</p>
        <p>Please find another trip using BanglaBnB. We're sorry for the inconvenience.</p>`,
        });
      }
    }

    res.json({ message: "🚫 Trip cancelled successfully", trip });
  } catch (err) {
    console.error("❌ Cancel trip error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.cancelReservation = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const tripStart = new Date(`${trip.date}T${trip.time}`);
    const now = new Date();
    const diffHours = (tripStart - now) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return res.status(400).json({
        message:
          "🚫 Cancellation not allowed within 24 hours of trip departure.",
      });
    }

    const index = trip.passengers.findIndex(
      (p) =>
        p.user?.toString() === req.user._id.toString() &&
        p.status !== "cancelled"
    );

    if (index === -1)
      return res.status(400).json({ message: "No active reservation found" });

    trip.passengers[index].status = "cancelled";
    trip.passengers[index].cancelledAt = new Date();

    const reservedSeatsAfterCancel = trip.passengers
      .filter((p) => p.status !== "cancelled")
      .reduce((sum, p) => sum + (p.seats || 1), 0);

    if (
      trip.status === "booked" &&
      reservedSeatsAfterCancel < trip.totalSeats
    ) {
      trip.status = "available";
    }

    await trip.save();

    res.json({ message: "✅ Reservation cancelled", trip });
  } catch (err) {
    console.error("❌ Cancel failed:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.MyRides = async (req, res) => {
  console.log("UserId: ", req.user.id);
  try {
    const trips = await Trip.find({
      passengers: {
        $elemMatch: {
          user: req.user._id,
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

exports.getSuggestedTrips = async (req, res) => {
  const { to, lat, lng } = req.query;

  if (!to || !lat || !lng) {
    return res.status(400).json({ message: "Missing parameters" });
  }

  try {
    const trips = await Trip.find({
      to: new RegExp(to, "i"),
      status: "available",
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: 100 * 1000,
        },
      },
    })
      .sort({ date: 1, time: 1 })
      .limit(5);

    res.json(trips);
  } catch (err) {
    console.error("❌ Trip suggestions error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
