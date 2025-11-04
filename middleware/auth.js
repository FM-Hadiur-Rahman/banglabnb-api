// middlewares/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Attach a *fresh* user snapshot to req.user on every request
export async function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    // Select everything you plan to check in guards/UI
    const user = await User.findById(id)
      .select([
        "name",
        "email",
        "phone",
        "roles",
        "primaryRole",
        "kyc.status",
        "identityVerified",
        "phoneVerified",
        "paymentDetails.verified",
        "isDeleted",
      ])
      .lean();

    if (!user || user.isDeleted) {
      return res.status(401).json({ message: "Invalid user" });
    }
    req.user = user; // fresh snapshot
    req.userId = id;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Keep your existing helpers
export const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthenticated" });
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user?.roles?.includes("admin")) {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};
