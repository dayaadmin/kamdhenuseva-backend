// src/models/Donation.js

import mongoose from "mongoose";

const DonationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cow",
      required: false, // now optional
    },
    type: {
      type: String,
      enum: ["cow", "ashram"],
      default: "cow",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["Pending", "Successful", "Failed"],
      default: "Pending",
    },
    paymentId: {
      type: String, // Razorpay payment ID
    },
    orderId: {
      type: String,
      required: true, // Razorpay order ID
    },
    emailSent: {
      type: Boolean,
      default: false, // Email sent confirmation
    },
  },
  {
    timestamps: true, // includes createdAt and updatedAt
  },
);

// Indexes can help in sorting or filtering by user/cow quickly
DonationSchema.index({ userId: 1, createdAt: -1 });
DonationSchema.index({ cowId: 1 });

export default mongoose.model("Donation", DonationSchema);
