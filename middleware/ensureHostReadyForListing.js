// middlewares/ensureHostReadyForListing.js
import User from "../models/User.js";

export async function ensureHostReadyForListing(req, res, next) {
  // Defensive: re-read in case upstream selection ever changes
  const u = await User.findById(req.userId)
    .select([
      "roles",
      "kyc.status",
      "identityVerified",
      "phoneVerified",
      "paymentDetails.verified",
      "isDeleted",
    ])
    .lean();

  if (!u) return res.status(401).json({ message: "Unauthorized" });
  if (u.isDeleted)
    return res.status(403).json({ message: "Account is deactivated." });
  if (!(u.roles || []).includes("host")) {
    return res
      .status(403)
      .json({ message: "You must switch to Host to create a listing." });
  }
  if (u.kyc?.status !== "approved") {
    return res
      .status(403)
      .json({ message: "KYC approval required before creating a listing." });
  }
  if (!u.identityVerified) {
    return res
      .status(403)
      .json({
        message: "Upload ID (front/back) and live selfie to verify identity.",
      });
  }
  if (!u.phoneVerified) {
    return res
      .status(403)
      .json({ message: "Verify your mobile number to continue." });
  }
  if (!u.paymentDetails?.verified) {
    return res
      .status(403)
      .json({
        message: "Add and verify your payout method to receive earnings.",
      });
  }
  next();
}
