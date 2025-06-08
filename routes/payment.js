require("dotenv").config();
const express = require("express");
const axios = require("axios");
const router = express.Router();
const Booking = require("../models/Booking");
const User = require("../models/User");
const Listing = require("../models/Listing");
const sendEmail = require("../utils/sendEmail");
const IPNLog = require("../models/IPNLog");
const qs = require("querystring");
const generateInvoice = require("../utils/generateInvoice");
const Notification = require("../models/Notification");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const Payout = require("../models/Payout");

router.post("/initiate", async (req, res) => {
  const { amount, bookingId, customer } = req.body;

  const tran_id = `BNB_${bookingId}_${Date.now()}`;

  await Booking.findByIdAndUpdate(bookingId, {
    transactionId: tran_id,
    paymentStatus: "unpaid",
  });

  const data = {
    store_id: process.env.SSLCOMMERZ_STORE_ID,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASS,
    total_amount: amount,
    currency: "BDT",
    tran_id,
    success_url: "https://banglabnb-api.onrender.com/api/payment/success",
    fail_url: "https://banglabnb.com/payment-fail",
    cancel_url: "https://banglabnb.com/payment-cancel",
    ipn_url: "https://banglabnb-api.onrender.com/api/payment/ipn",
    cus_name: customer.name,
    cus_email: customer.email,
    cus_add1: customer.address || "Dhaka",
    cus_city: "Dhaka",
    cus_postcode: "1200",
    cus_country: "Bangladesh",
    cus_phone: customer.phone || "01763558585",
    shipping_method: "NO",
    product_name: "BanglaBnB Booking",
    product_category: "Reservation",
    product_profile: "general",
  };

  try {
    const response = await axios.post(
      process.env.SSLCOMMERZ_API_URL,
      qs.stringify(data),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!response.data.GatewayPageURL) {
      return res.status(400).json({ error: "Payment gateway URL missing" });
    }

    res.json({ url: response.data.GatewayPageURL });
  } catch (err) {
    console.error("SSLCOMMERZ initiation error:", err.message);
    res.status(500).json({ error: "Payment initiation failed" });
  }
});

router.post("/success", async (req, res) => {
  const { tran_id, val_id, amount } = req.body;

  try {
    const booking = await Booking.findOne({ transactionId: tran_id })
      .populate("guestId")
      .populate("listingId");
    if (!booking) return res.status(404).send("Booking not found");

    booking.paymentStatus = "paid";
    booking.valId = val_id;
    booking.paidAmount = amount;
    booking.paidAt = new Date();
    booking.status = "confirmed";
    await booking.save();

    const guest = booking.guestId;
    const listing = booking.listingId;

    const invoicePath = await generateInvoice(booking, listing, guest);

    try {
      await sendEmail({
        to: guest.email,
        subject: "Your Invoice",
        attachments: [
          { filename: `invoice-${booking._id}.pdf`, path: invoicePath },
        ],
      });
    } catch (e) {
      console.warn("Guest email failed:", e.message);
    }

    if (listing.hostId?.email) {
      try {
        await sendEmail({
          to: listing.hostId.email,
          subject: "New Paid Booking",
          attachments: [
            { filename: `invoice-${booking._id}.pdf`, path: invoicePath },
          ],
        });
      } catch (e) {
        console.warn("Host email failed:", e.message);
      }
    }

    try {
      await Notification.create({
        userId: guest._id,
        message: `Payment received for booking at ${listing.title}`,
        type: "payment",
      });
    } catch (e) {
      console.warn("Notification failed:", e.message);
    }

    fs.unlink(invoicePath, (err) => {
      if (err) console.warn("Could not delete invoice:", err.message);
    });

    try {
      const token = jwt.sign({ id: guest._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
      if (process.env.API_URL) {
        await axios.post(
          `${process.env.API_URL}/api/chats`,
          {
            bookingId: booking._id,
            listingId: listing._id,
            hostId: listing.ownerId,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        console.warn("API_URL not set, skipping chat creation.");
      }
    } catch (e) {
      console.warn("Chat creation failed:", e.message);
    }

    try {
      const gross = booking.paidAmount;
      const tax = (gross * 5) / 100;
      const fee = (gross * 10) / 100;
      const hostPayout = gross - tax - fee;

      await Payout.create({
        bookingId: booking._id,
        hostId: listing.hostId?._id || listing.ownerId,
        amount: hostPayout,
        method: "manual",
        status: "pending",
        notes: `Auto-created after payment of ৳${gross}`,
      });
    } catch (e) {
      console.warn("Payout creation failed:", e.message);
    }

    res.redirect("https://banglabnb.com/payment-success?status=paid");
  } catch (err) {
    console.error("Payment success error:", err.message);
    res.status(500).send("Server error");
  }
});

router.post("/fail", (req, res) => {
  res.redirect("https://banglabnb.com/payment-fail");
});

router.post("/cancel", (req, res) => {
  res.redirect("https://banglabnb.com/payment-cancel");
});

router.post("/ipn", async (req, res) => {
  await IPNLog.create({ payload: req.body });
  const { tran_id, status } = req.body;

  if (status === "VALID") {
    await Booking.findOneAndUpdate(
      { transactionId: tran_id },
      {
        paymentStatus: "paid",
        status: "confirmed",
      }
    );
  }

  res.status(200).send("IPN received");
});

module.exports = router;
