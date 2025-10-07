// src/models/User.js

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
    },
    dateOfBirth: { type: Date },
    lastActive: { type: Date },
    isVerified: { type: Boolean, default: false },

    // ✅ Unified OTP fields
    emailOTP: { type: String, select: false },
    emailOTPExpires: { type: Date, select: false },

    forgotPasswordToken: String,
    forgotPasswordExpires: Date,

    twoFactorEnabled: { type: Boolean, default: false },

    donations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Donation" }],
    subscriptions: [
      {
        subscriptionId: { type: String, required: true },
        cowId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Cow",
          required: true,
        },
        status: {
          type: String,
          enum: ["Active", "Cancelled"],
          default: "Active",
        },
      },
    ],

    // Unique 7-digit user ID
    userId: { type: Number, unique: true, sparse: true },
  },
  {
    timestamps: true,
    collection: "users",
  },
);

// Pre-save hook to generate a unique 7-digit userId
userSchema.pre("save", async function (next) {
  if (!this.userId) {
    const generateUniqueUserId = async () => {
      const randomId = Math.floor(1000000 + Math.random() * 9000000);
      const existingUser = await this.constructor.findOne({ userId: randomId });
      return existingUser ? generateUniqueUserId() : randomId;
    };
    this.userId = await generateUniqueUserId();
  }
  next();
});

export default mongoose.model("User", userSchema);
