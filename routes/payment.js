require("dotenv").config();
const express = require("express");
const axios = require("axios");
const router = express.Router();
const Booking = require("../models/Booking");
const qs = require("querystring");

router.post("/initiate", async (req, res) => {
  const { amount, bookingId, customer } = req.body;

  const tran_id = `BNB_${bookingId}_${Date.now()}`;

  await Booking.findByIdAndUpdate(bookingId, {
    transactionId: tran_id,
    paymentStatus: "unpaid",
  });

  const data = {
    store_id: process.env.SSLCOMMERZ_STORE_ID || "bangl683f39645be2d",
    store_passwd: process.env.SSLCOMMERZ_STORE_PASS,
    total_amount: amount,
    currency: "BDT",
    tran_id,
    success_url: "https://banglabnb-api.onrender.com/api/payment/success", // ✅ point to backend
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
      console.error("❌ Missing GatewayPageURL. Full response:");
      console.error(response.data);
      return res.status(400).json({ error: "Payment gateway URL missing" });
    }

    res.json({ url: response.data.GatewayPageURL });
  } catch (err) {
    console.error(
      "❌ SSLCOMMERZ AXIOS ERROR:",
      err?.response?.data || err.message
    );
    res.status(500).json({ error: "Payment initiation failed" });
  }
});

// ✅ SSLCOMMERZ will POST here after payment success
router.post("/success", async (req, res) => {
  const { tran_id, val_id, amount } = req.body;

  try {
    const booking = await Booking.findOne({ transactionId: tran_id });
    if (!booking) return res.status(404).send("Booking not found");

    booking.paymentStatus = "paid";
    booking.valId = val_id;
    booking.paidAmount = amount;
    booking.paidAt = new Date();
    booking.status = "confirmed";
    await booking.save();

    // ✅ Redirect to frontend React route
    res.redirect("https://banglabnb.com/payment-success?status=paid");
  } catch (err) {
    console.error("❌ Payment success error:", err);
    res.status(500).send("Server error");
  }
});

router.post("/fail", (req, res) => {
  res.redirect("https://banglabnb.com/payment-fail");
});

router.post("/cancel", (req, res) => {
  res.redirect("https://banglabnb.com/payment-cancel");
});

// ✅ IPN: server-to-server validation from SSLCOMMERZ
router.post("/ipn", async (req, res) => {
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
