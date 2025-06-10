const express = require("express");
const router = express.Router();
const upload = require("../middleware/cloudinaryUpload");

const protect = require("../middleware/protect");
const { switchRole } = require("../controllers/authController");
const { getUserIdFromToken } = require("../controllers/authController");

const checkSignupStep = require("../middleware/checkSignupStep");

const {
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  registerStep1,
  verifyIdentityHandler,
} = require("../controllers/authController");

router.post("/signup/step1", registerStep1); // ✅ preferred

// Step 2: Upload ID + Live Photo for verification
router.post(
  "/signup/step2",
  upload.fields([
    { name: "idDocument", maxCount: 1 },
    { name: "idBack", maxCount: 1 }, // ✅ You must add this
    { name: "livePhoto", maxCount: 1 },
  ]),
  checkSignupStep,
  verifyIdentityHandler
);

router.post("/login", loginUser);
router.get("/verify-email", verifyEmail);
// routes/authRoutes.js
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.patch("/switch-role", protect, switchRole);

router.get("/verify-token", getUserIdFromToken);

module.exports = router;
