// === Imports ===
const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect"); // ✅ Correct path
const authorize = require("../middleware/authorize"); // For role check
const User = require("../models/User");
const Listing = require("../models/Listing");
const Booking = require("../models/Booking");
const sendEmail = require("../utils/sendEmail"); // make sure you have this
const Payout = require("../models/Payout"); // 👈 import the model

// Example admin-only route
const Review = require("../models/Review");
router.get(
  "/flagged/reviews",
  protect,
  authorize("admin"),
  async (req, res) => {
    const flagged = await Review.find({ flagged: true })
      .populate("userId")
      .populate("listingId");
    res.json(flagged);
  }
);

// Flagged users

// === User Management ===
router.get("/users", protect, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    console.error("❌ Failed to fetch users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
// Get all listings (Admin only)
router.put("/users/:id/role", protect, authorize("admin"), async (req, res) => {
  const { role } = req.body;
  if (!["user", "host", "admin"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  );
  res.json({ message: `User role updated to ${role}`, user });
});

router.get("/user-breakdown", protect, authorize("admin"), async (req, res) => {
  const total = await User.countDocuments();
  const guests = await User.countDocuments({ role: "guest" });
  const hosts = await User.countDocuments({ role: "host" });

  res.json({ total, guests, hosts });
});

// Get users with pending KYC

// === Listing Management ===
router.get("/listings", protect, authorize("admin"), async (req, res) => {
  try {
    const listings = await Listing.find().populate("hostId", "name email");
    res.json(listings);
  } catch (err) {
    console.error("❌ Failed to fetch listings:", err);
    res.status(500).json({ message: "Failed to fetch listings" });
  }
});
// Get all bookings (Admin only)

// === Booking Management ===
router.get("/bookings", protect, authorize("admin"), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("guestId", "name email")
      .populate("listingId", "title location");
    res.json(bookings);
  } catch (err) {
    console.error("❌ Failed to fetch bookings:", err);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
});
// Add to admin routes (/routes/admin.js)

// === KYC Management ===
router.get("/kyc", protect, authorize("admin"), async (req, res) => {
  const pending = await User.find({ kycStatus: "pending" });
  const approved = await User.find({ kycStatus: "approved" });
  const rejected = await User.find({ kycStatus: "rejected" });

  res.json({ pending, approved, rejected });
});

router.put(
  "/kyc/:id/:status",
  protect,
  authorize("admin"),
  async (req, res) => {
    const { id, status } = req.params;
    const { reason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.kyc = {
      status,
      reason: status === "rejected" ? reason : "",
      timestamp: new Date(),
    };

    user.identityVerified = status === "approved";

    await user.save();

    // ✉️ Auto email notification
    try {
      await sendEmail({
        to: user.email,
        subject: `Your BanglaBnB KYC has been ${status}`,
        html: `
          <h2 style="color: ${
            status === "approved" ? "#10b981" : "#ef4444"
          };">KYC ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Your identity verification request on <strong>BanglaBnB</strong> has been <strong>${status}</strong>.</p>
          ${
            status === "rejected"
              ? `<p><strong>Reason:</strong> ${reason}</p>`
              : ""
          }
          <p>Thank you for your cooperation.</p>
        `,
      });
    } catch (e) {
      console.warn("Email send failed:", e.message);
    }

    res.json({ message: `KYC ${status}` });
  }
);

// Flagged listings
router.get(
  "/flagged/listings",
  protect,
  authorize("admin"),
  async (req, res) => {
    const flagged = await Listing.find({ flagged: true }).populate("hostId");
    res.json(flagged);
  }
);

// Flagged reviews
router.get("/kyc/pending", protect, authorize("admin"), async (req, res) => {
  const users = await User.find({ "kyc.status": "pending" });
  res.json(users);
});

// Update KYC status
router.patch("/kyc/:userId", protect, authorize("admin"), async (req, res) => {
  const { userId } = req.params;
  const { status, reason } = req.body;

  const updates = {
    "kyc.status": status,
    ...(status === "rejected" && { "kyc.rejectionReason": reason }),
  };

  await User.findByIdAndUpdate(userId, updates);
  res.json({ message: `User KYC marked as ${status}` });
});
// GET: fetch all flagged reviews, listings, and users

// === Flagged Content ===
router.get("/flagged/users", protect, authorize("admin"), async (req, res) => {
  const flagged = await User.find({ flagged: true });
  res.json(flagged);
});
router.get("/flagged", protect, authorize("admin"), async (req, res) => {
  const users = await User.find({ flagged: true }).select("name email role");
  const listings = await Listing.find({ flagged: true }).populate(
    "hostId",
    "name email"
  );
  const reviews = await Review.find({ flagged: true })
    .populate("userId", "name email")
    .populate("listingId", "title");

  res.json({ users, listings, reviews });
});
// PUT: unflag an item
router.put(
  "/unflag/:type/:id",
  protect,
  authorize("admin"),
  async (req, res) => {
    const { type, id } = req.params;
    let item;

    if (type === "user")
      item = await User.findByIdAndUpdate(id, { flagged: false });
    else if (type === "listing")
      item = await Listing.findByIdAndUpdate(id, { flagged: false });
    else if (type === "review")
      item = await Review.findByIdAndUpdate(id, { flagged: false });
    else return res.status(400).json({ message: "Invalid type" });

    res.json({ message: "✅ Unflagged", item });
  }
);
// Revenue analytics route

// === Role Management ===

// === Revenue Analytics ===
router.get("/revenue", protect, authorize("admin"), async (req, res) => {
  try {
    const bookings = await Booking.find({ paymentStatus: "paid" }).populate({
      path: "listingId",
      populate: {
        path: "hostId",
        select: "name",
      },
    });

    const PLATFORM_FEE_PERCENT = 10;
    const TAX_PERCENT = 5;

    let totalRevenue = 0;
    let totalTax = 0;
    let totalPlatformFee = 0;
    let totalHostPayout = 0;

    const monthly = {};
    const listingMap = {};
    const hostMap = {};

    bookings.forEach((b) => {
      const amount = b.paidAmount || 0;
      const tax = (amount * TAX_PERCENT) / 100;
      const fee = (amount * PLATFORM_FEE_PERCENT) / 100;
      const hostIncome = amount - tax - fee;

      totalRevenue += amount;
      totalTax += tax;
      totalPlatformFee += fee;
      totalHostPayout += hostIncome;

      const month = new Date(b.createdAt).toISOString().slice(0, 7);
      monthly[month] = (monthly[month] || 0) + amount;

      // Listings
      const listing = b.listingId;
      if (listing?._id) {
        listingMap[listing._id] = listingMap[listing._id] || {
          title: listing.title,
          total: 0,
        };
        listingMap[listing._id].total += amount;
      }

      // Hosts
      const host = listing?.hostId;
      if (host?._id) {
        hostMap[host._id] = hostMap[host._id] || {
          name: host.name,
          total: 0,
        };
        hostMap[host._id].total += hostIncome;
      }
    });

    const topListings = Object.entries(listingMap)
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const topHosts = Object.entries(hostMap)
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    res.json({
      totalRevenue,
      totalTax,
      totalPlatformFee,
      totalHostPayout,
      monthly,
      topListings,
      topHosts,
    });
  } catch (err) {
    console.error("❌ Revenue analytics error:", err);
    res.status(500).json({ message: "Failed to fetch revenue data" });
  }
});

// GET: Fetch all pending payouts
router.get(
  "/payouts/pending",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const payouts = await Payout.find({ status: "pending" })
        .populate("bookingId", "paidAmount createdAt")
        .populate("hostId", "name email phone");

      res.json(payouts);
    } catch (err) {
      console.error("❌ Failed to fetch pending payouts:", err);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  }
);
router.put(
  "/payouts/:id/mark-paid",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const payout = await Payout.findByIdAndUpdate(
        req.params.id,
        { status: "paid", date: new Date() },
        { new: true }
      );
      res.json({ message: "✅ Payout marked as paid", payout });
    } catch (err) {
      console.error("❌ Failed to update payout:", err);
      res.status(500).json({ message: "Failed to update payout" });
    }
  }
);

module.exports = router;

// === Payout Management ===

// === Miscellaneous Stats ===
router.get("/stats", protect, authorize("admin"), async (req, res) => {
  const users = await User.countDocuments();
  const listings = await Listing.countDocuments();
  const bookings = await Booking.countDocuments();

  res.json({ users, listings, bookings });
});
// Get all users (Admin only)
router.get("/stats", protect, authorize("admin"), async (req, res) => {
  const totalUsers = await User.countDocuments();
  const guests = await User.countDocuments({ role: "user" });
  const hosts = await User.countDocuments({ role: "host" });
  const totalListings = await Listing.countDocuments();
  const totalBookings = await Booking.countDocuments({ paymentStatus: "paid" });

  const revenue = await Booking.aggregate([
    { $match: { paymentStatus: "paid" } },
    { $group: { _id: null, total: { $sum: "$paidAmount" } } },
  ]);

  res.json({
    users: totalUsers,
    guests,
    hosts,
    listings: totalListings,
    bookings: totalBookings,
    revenue: revenue[0]?.total || 0,
  });
});

// === Other ===
