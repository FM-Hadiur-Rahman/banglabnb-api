// === controllers/tripController.js ===
const Trip = require("../models/Trip");
const cloudinary = require("../middleware/cloudinaryUpload");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
// controllers/tripController.js
exports.createTrip = async (req, res) => {
  try {
    const tripData = {
      ...req.body,
      driverId: req.user._id,
      totalSeats: Number(req.body.totalSeats),
      farePerSeat: Number(req.body.farePerSeat),
    };

    // ✅ Parse pickup location
    if (req.body.location) {
      try {
        tripData.location = JSON.parse(req.body.location);
      } catch (error) {
        console.warn("⚠️ Invalid location JSON:", req.body.location);
        return res.status(400).json({ message: "Invalid location format" });
      }
    }

    // ✅ Parse fromLocation
    if (req.body.fromLocation) {
      try {
        tripData.fromLocation = JSON.parse(req.body.fromLocation);
      } catch (error) {
        console.warn("⚠️ Invalid fromLocation JSON:", req.body.fromLocation);
        return res.status(400).json({ message: "Invalid fromLocation format" });
      }
    }

    // ✅ Parse toLocation
    if (req.body.toLocation) {
      try {
        tripData.toLocation = JSON.parse(req.body.toLocation);
      } catch (error) {
        console.warn("⚠️ Invalid toLocation JSON:", req.body.toLocation);
        return res.status(400).json({ message: "Invalid toLocation format" });
      }
    }

    // ✅ Handle image (optional)
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

// GET /api/trips?fromLat=...&fromLng=...&toLat=...&toLng=...&date=...
exports.getTrips = async (req, res) => {
  try {
    console.log("🔍 Incoming trip search params:", req.query);

    const { fromLat, fromLng, toLat, toLng, date, radius = 30000 } = req.query;

    const query = { status: "available" };

    // Validate coordinates before using
    if (fromLat && fromLng && !isNaN(fromLat) && !isNaN(fromLng)) {
      query["fromLocation.coordinates"] = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(fromLng), parseFloat(fromLat)],
          },
          $maxDistance: parseFloat(radius),
        },
      };
    }

    if (toLat && toLng && !isNaN(toLat) && !isNaN(toLng)) {
      query["toLocation.coordinates"] = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(toLng), parseFloat(toLat)],
          },
          $maxDistance: parseFloat(radius),
        },
      };
    }

    if (!fromLat && req.query.from) {
      query.from = new RegExp(req.query.from, "i");
    }

    if (!toLat && req.query.to) {
      query.to = new RegExp(req.query.to, "i");
    }

    if (date) {
      query.date = date;
    }

    console.log("🧠 Final trip search query:", JSON.stringify(query, null, 2));

    const trips = await Trip.find(query).populate("driverId");
    res.json(trips);
  } catch (err) {
    console.error("❌ Trip search failed:", err);
    res.status(500).json({ message: "Server error", error: err.message });
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
  try {
    const { seats = 1 } = req.body;
    const trip = await Trip.findById(req.params.tripId).populate("driverId");

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const alreadyReserved = trip.passengers.find(
      (p) =>
        p.user?.toString() === req.user._id.toString() &&
        p.status !== "cancelled"
    );
    if (alreadyReserved)
      return res.status(400).json({ message: "Already reserved" });

    const reservedSeats = trip.passengers
      .filter((p) => p.status !== "cancelled")
      .reduce((sum, p) => sum + (p.seats || 1), 0);

    const availableSeats = trip.totalSeats - reservedSeats;
    if (availableSeats < seats)
      return res
        .status(400)
        .json({ message: `Only ${availableSeats} seat(s) available` });

    trip.passengers.push({
      user: req.user._id,
      seats,
      status: "reserved",
      paymentStatus: "pending",
    });

    if (reservedSeats + seats >= trip.totalSeats) {
      trip.status = "booked";
    }

    await trip.save();

    // Send email to passenger
    const passenger = await User.findById(req.user._id);
    if (passenger?.email) {
      await sendEmail({
        to: passenger.email,
        subject: "Trip Reserved on BanglaBnB 🚗",
        html: `
          <p>Hi ${passenger.name},</p>
          <p>Your seat has been reserved for the trip from <b>${
            trip.from
          }</b> to <b>${trip.to}</b> on <b>${trip.date}</b> at <b>${
          trip.time
        }</b>.</p>
          <p>Seats Reserved: ${seats} | Fare per Seat: ৳${trip.farePerSeat}</p>
          <p>Total: ৳${seats * trip.farePerSeat}</p>
          <br/>
          <p>Driver: ${trip.driverId.name}</p>
          <p>Please complete the payment to confirm your reservation.</p>
          <p>Thanks for using <b>BanglaBnB Rides</b>!</p>
        `,
      });
    }

    res.json({ message: "✅ Reserved and email sent", trip });
  } catch (err) {
    console.error("❌ Reserve failed:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    // 🚫 Only owner can update
    if (trip.driverId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized to edit this trip" });
    }

    // 🚫 Prevent editing if already booked
    if (trip.passengers?.some((p) => p.status !== "cancelled")) {
      return res
        .status(400)
        .json({ message: "Cannot edit trip with active reservations." });
    }

    // 🚫 Prevent editing past trips
    const now = new Date();
    const originalStart = new Date(`${trip.date}T${trip.time}`);
    if (originalStart < now) {
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

    // 🕓 Ensure new start time is in the future
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

    // ✅ Parse pickup point
    if (req.body.location) {
      try {
        trip.location = JSON.parse(req.body.location);
      } catch {
        return res.status(400).json({ message: "Invalid location format" });
      }
    }

    // ✅ Parse fromLocation
    if (req.body.fromLocation) {
      try {
        trip.fromLocation = JSON.parse(req.body.fromLocation);
      } catch {
        return res.status(400).json({ message: "Invalid fromLocation format" });
      }
    }

    // ✅ Parse toLocation
    if (req.body.toLocation) {
      try {
        trip.toLocation = JSON.parse(req.body.toLocation);
      } catch {
        return res.status(400).json({ message: "Invalid toLocation format" });
      }
    }

    // ✅ Upload new image if provided
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
// Cancel reservation
exports.cancelReservation = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    // ✅ Check if trip starts within 24 hours
    const tripStart = new Date(`${trip.date}T${trip.time}`);
    const now = new Date();
    const diffHours = (tripStart - now) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return res.status(400).json({
        message:
          "🚫 Cancellation not allowed within 24 hours of trip departure.",
      });
    }

    // ✅ Find user’s reservation
    const index = trip.passengers.findIndex(
      (p) =>
        p.user?.toString() === req.user._id.toString() &&
        p.status !== "cancelled"
    );

    if (index === -1)
      return res.status(400).json({ message: "No active reservation found" });

    // ✅ Mark as cancelled
    trip.passengers[index].status = "cancelled";
    trip.passengers[index].cancelledAt = new Date();
    trip.passengers[index].cancelReason =
      req.body.reason || "No reason provided";

    // ✅ Recalculate seats
    const reservedSeatsAfterCancel = trip.passengers
      .filter((p) => p.status !== "cancelled")
      .reduce((sum, p) => sum + (p.seats || 1), 0);

    // ✅ If seats now available, mark trip as 'available'
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
          status: { $ne: "cancelled" }, // ✅ skip cancelled
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
          $maxDistance: 100 * 1000, // 100 km
        },
      },
    }).limit(5);

    res.json(trips);
  } catch (err) {
    console.error("❌ Trip suggestions error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// controllers/tripController.js
exports.getTripEarnings = async (req, res) => {
  try {
    const trips = await Trip.find({ driverId: req.user._id });

    const detailed = trips.map((trip) => {
      const earnings = trip.passengers
        .filter((p) => p.status === "reserved" && p.paymentStatus === "paid")
        .reduce((sum, p) => sum + p.seats * trip.farePerSeat, 0);
      return {
        tripId: trip._id,
        from: trip.from,
        to: trip.to,
        date: trip.date,
        time: trip.time,
        totalSeats: trip.totalSeats,
        earnings,
      };
    });

    const totalEarnings = detailed.reduce((sum, t) => sum + t.earnings, 0);

    res.json({ totalEarnings, trips: detailed });
  } catch (err) {
    console.error("❌ Earnings fetch failed:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.markTripCompleted = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (trip.driverId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Unauthorized" });

    const tripTime = new Date(`${trip.date}T${trip.time}`);
    if (tripTime > new Date()) {
      return res.status(400).json({ message: "Trip hasn't started yet" });
    }

    trip.isCompleted = true;
    await trip.save();

    res.json({ message: "✅ Trip marked as completed", trip });
  } catch (err) {
    console.error("❌ Mark completed failed:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// GET /api/trips/:id/passengers
exports.getTripPassengers = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate(
      "passengers.user",
      "name phone email"
    );

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (trip.driverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const activePassengers = trip.passengers.filter(
      (p) => p.status === "reserved"
    );

    res.json({ passengers: activePassengers });
  } catch (err) {
    console.error("❌ Fetch passengers failed:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// GET /api/trips/driver-stats
exports.getDriverStats = async (req, res) => {
  try {
    const trips = await Trip.find({ driverId: req.user._id });

    const totalTrips = trips.length;
    const completed = trips.filter((t) => t.isCompleted).length;
    const cancelled = trips.filter((t) => t.status === "cancelled").length;

    const totalEarnings = trips.reduce((sum, trip) => {
      const earnings = trip.passengers
        .filter((p) => p.status === "reserved" && p.paymentStatus === "paid")
        .reduce((s, p) => s + p.seats * trip.farePerSeat, 0);
      return sum + earnings;
    }, 0);

    res.json({
      totalTrips,
      completed,
      cancelled,
      totalEarnings,
    });
  } catch (err) {
    console.error("❌ Driver stats fetch failed:", err);
    res.status(500).json({ message: "Server error" });
  }
};
