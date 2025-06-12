// scripts/fixNotificationLinks.js

const connectDB = require("../config/db");
const Notification = require("../models/Notification");
const Booking = require("../models/Booking");

(async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected. Running fix...");

    const notifications = await Notification.find({
      link: "/dashboard/requests",
      type: "modification-request",
    });

    console.log(`🔎 Found ${notifications.length} outdated notifications.`);

    for (const note of notifications) {
      const booking = await Booking.findOne({
        "modificationRequest.status": "requested",
      });

      if (!booking) continue;

      note.link = `/host/listings/${booking.listingId}/bookings`;
      await note.save();
      console.log(`✅ Fixed notification ${note._id}`);
    }

    console.log("🎉 All done.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during script execution:", err);
    process.exit(1);
  }
})();
