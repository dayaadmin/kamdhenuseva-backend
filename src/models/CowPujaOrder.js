import mongoose from "mongoose";

const TimelineEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // created | payment_captured | date_confirmed | completed | failed | cancelled
    note: { type: String },
    by: { type: String }, // system | user:<id> | admin:<id>
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const CowPujaOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },

    orderId: { type: String, index: true, unique: true },
    paymentId: { type: String, index: true },

    status: {
      type: String,
      enum: [
        "AwaitingPayment",
        "SuccessfulPayment",
        "DateConfirmed",
        "Completed",
        "Failed",
        "Cancelled",
      ],
      default: "AwaitingPayment",
      index: true,
    },

    amount: { type: Number, required: true, default: 2100 },
    currency: { type: String, required: true, default: "INR" },

    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true, index: true },
      phone: { type: String, required: true }, // +91XXXXXXXXXX
    },

    pujaDetails: {
      gotra: { type: String, required: true },
      sankalpam: { type: String, required: true },
      preferredDate: { type: Date }, // optional
      namesToInclude: { type: String },
      additionalNotes: { type: String },
    },

    scheduledDate: { type: Date }, // set by admin on confirmation

    timeline: { type: [TimelineEventSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("CowPujaOrder", CowPujaOrderSchema);
