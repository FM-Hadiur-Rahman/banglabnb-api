const tripSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },

    totalSeats: { type: Number, required: true }, // ✅ max capacity
    farePerSeat: { type: Number, required: true },

    passengers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        seats: { type: Number, default: 1 },
        status: {
          type: String,
          enum: ["reserved", "cancelled"],
          default: "reserved",
        },
        cancelledAt: { type: Date },
      },
    ],

    vehicleType: { type: String, enum: ["car", "bike"], required: true },
    vehicleModel: { type: String },
    licensePlate: { type: String },

    status: {
      type: String,
      enum: ["available", "booked", "cancelled"],
      default: "available",
    },

    image: { type: String },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: { type: [Number], required: true },
      address: { type: String },
    },
  },
  { timestamps: true }
);
tripSchema.index({ location: "2dsphere" });

// ✅ Virtual field (not stored in DB)
tripSchema.virtual("seatsAvailable").get(function () {
  const reservedSeats = this.passengers
    .filter((p) => p.status !== "cancelled")
    .reduce((sum, p) => sum + (p.seats || 1), 0);
  return this.totalSeats - reservedSeats;
});
