// const express = require("express");
// const router = express.Router();
// const listingCtrl = require("../controllers/listingController");
// const protect = require("../middleware/protect");
// const authorize = require("../middleware/authorize");

// const multer = require("multer");
// const { storage } = require("../config/cloudinary");
// const upload = multer({ storage });

// // Public Routes
// router.get("/featured", listingCtrl.getFeaturedListings);

// router.get("/", listingCtrl.getAllListings);
// router.get("/:id", listingCtrl.getListingById);
// router.get("/host/:hostId", listingCtrl.getListingsByHost);

// // ✅ Protected CRUD routes

// router.post(
//   "/",
//   protect,
//   upload.array("images", 10),
//   listingCtrl.createListing
// );

// router.put("/:id", protect, listingCtrl.updateListing);
// router.delete("/:id", protect, listingCtrl.deleteListing);
// router.post(
//   "/:id/block-dates",
//   protect,
//   authorize("host"),
//   listingCtrl.blockDates
// );
// router.delete(
//   "/:id/block-dates",
//   protect,
//   authorize("host"),
//   listingCtrl.unblockDates
// );

// // ✅ Upload image to Cloudinary
// router.post("/upload", upload.single("image"), (req, res) => {
//   res.json({ imageUrl: req.file.path });
// });

// module.exports = router;

const express = require("express");
const router = express.Router();

const listingCtrl = require("../controllers/listingController");
const protect = require("../middleware/protect"); // make sure this loads a FRESH user
const authorize = require("../middleware/authorize");
const {
  ensureHostReadyForListing,
} = require("../middleware/ensureHostReadyForListing");

const multer = require("multer");
const { storage } = require("../config/cloudinary");
const upload = multer({ storage, limits: { files: 10 } });

// ---- Public
router.get("/featured", listingCtrl.getFeaturedListings);

// IMPORTANT: put more specific route BEFORE "/:id"
router.get("/host/:hostId", listingCtrl.getListingsByHost);
router.get("/", listingCtrl.getAllListings);
router.get("/:id", listingCtrl.getListingById);

// ---- Protected CRUD
router.post(
  "/",
  protect, // attaches fresh req.user
  ensureHostReadyForListing, // checks roles/kyc/identity/phone/payout, returns precise 403s
  upload.array("images", 10), // only run if allowed
  listingCtrl.createListing
);

router.put("/:id", protect, authorize("host"), listingCtrl.updateListing);
router.delete("/:id", protect, authorize("host"), listingCtrl.deleteListing);

router.post(
  "/:id/block-dates",
  protect,
  authorize("host"),
  listingCtrl.blockDates
);
router.delete(
  "/:id/block-dates",
  protect,
  authorize("host"),
  listingCtrl.unblockDates
);

// You probably want this protected too (or remove in production)
router.post("/upload", protect, upload.single("image"), (req, res) => {
  res.json({ imageUrl: req.file.path });
});

module.exports = router;
