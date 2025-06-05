const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: /^\+?\d{10,15}$/, // accepts +880..., +49..., etc.
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  idDocumentUrl: String,
  livePhotoUrl: String,
  identityVerified: { type: Boolean, default: false },
  signupStep: { type: Number, default: 1 },

  role: {
    type: String,
    enum: ["user", "host", "admin"],
    default: "user",
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,

  avatar: { type: String, default: "" },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing" }],
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
