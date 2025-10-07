// src/models/Cow.js

import mongoose from "mongoose";

const CowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    photos: { type: [String], default: [] },
    description: { type: String },
    calf: { type: Boolean, default: false },
    gender: {
      type: String,
      required: function () {
        return !this.calf;
      }, // Gender is not required if the cow is a calf
    },
    adoptionStatus: { type: Boolean, default: false },
    totalDonated: { type: Number, default: 0 }, // Total amount donated to this cow
    donators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    specialCare: { type: Boolean, default: false },
    cowId: { type: Number, unique: true, sparse: true }, // Unique 7-digit cowId
  },
  { timestamps: true },
);

// Pre-save hook to generate a unique 7-digit cowId if not already set.
CowSchema.pre("save", async function (next) {
  if (!this.cowId) {
    const generateUniqueCowId = async () => {
      const randomId = Math.floor(1000000 + Math.random() * 9000000);
      const existingCow = await this.constructor.findOne({ cowId: randomId });
      return existingCow ? generateUniqueCowId() : randomId;
    };
    this.cowId = await generateUniqueCowId();
  }
  next();
});

export default mongoose.model("Cow", CowSchema);
