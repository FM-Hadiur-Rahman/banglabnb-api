const express = require("express");
const router = express.Router();
const PromoCode = require("../models/PromoCode");

router.post("/validate", async (req, res) => {
  try {
    const { code, type = "stay" } = req.body;
    const promo = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      expiresAt: { $gt: new Date() },
      $or: [{ type }, { type: "combined" }],
    });

    if (!promo) {
      return res.status(400).json({ message: "Invalid or expired promo code" });
    }

    res.json({ discount: promo.discount });
  } catch (err) {
    console.error("Promo validation error:", err);
    res.status(500).json({ message: "Server error validating promo" });
  }
});

module.exports = router;
