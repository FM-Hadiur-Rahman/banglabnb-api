// routes/upload.js
const express = require("express");
const router = express.Router();
const upload = require("../middleware/cloudinaryUpload"); // or whatever file handles multer-cloudinary

router.post("/banner", upload.single("file"), (req, res) => {
  try {
    res.json({ imageUrl: req.file.path }); // ✅ Cloudinary URL
  } catch (err) {
    res.status(500).json({ message: "Upload failed" });
  }
});

module.exports = router;
