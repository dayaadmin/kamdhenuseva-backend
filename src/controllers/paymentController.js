// src/controllers/paymentController.js

import crypto from "crypto";
import dotenv from "dotenv";
import Razorpay from "razorpay";

import Cow from "../models/Cow.js";
import Donation from "../models/Donation.js";
import User from "../models/User.js";
import { sendDonationConfirmationEmail } from "../services/emailService.js";
import { sendResponse } from "../utils/helpers.js";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * POST /api/v{version}/payments/donate
 * Creates a one-time donation order using Razorpay.
 */
export const createOneTimeDonation = async (req, res) => {
  try {
    const { amount, cowId, type = "cow" } = req.body;
    const userId = req.user.id;

    if (!amount) {
      return sendResponse(res, 400, false, null, "Amount is required.");
    }

    if (type === "cow" && !cowId) {
      return sendResponse(
        res,
        400,
        false,
        null,
        "cowId is required for cow donation.",
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendResponse(res, 404, false, null, "User not found.");
    }

    // Create a Razorpay order
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: "INR",
      payment_capture: 1,
    });

    // Prepare donation data
    const donationData = {
      userId,
      amount,
      orderId: order.id,
      type,
      status: "Pending",
    };

    if (type === "cow") {
      donationData.cowId = cowId;
    }

    const donation = await Donation.create(donationData);

    // Link donation to user
    await User.findByIdAndUpdate(userId, {
      $push: { donations: donation._id },
    });

    // Get cow name if applicable
    const cowName =
      type === "cow"
        ? (await Cow.findById(cowId))?.name || "our cows"
        : "our ashram";

    // ✅ Send confirmation email (even if pending)
    try {
      await sendDonationConfirmationEmail(user.email, amount, cowName);
    } catch (emailError) {
      console.error("❌ Failed to send donation email:", emailError);
    }

    return sendResponse(
      res,
      200,
      true,
      { orderId: order.id },
      "Donation order created successfully.",
    );
  } catch (error) {
    console.error("❌ Error creating donation order:", error);
    return sendResponse(res, 500, false, null, "Server error.");
  }
};

/**
 * POST /api/v{version}/payments/webhook
 * Handles Razorpay webhook events for one-time payments.
 */
export const paymentWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const receivedSignature = req.headers["x-razorpay-signature"];

    if (!receivedSignature) {
      console.error("Missing Razorpay Signature Header");
      return res
        .status(400)
        .json({ success: false, message: "Missing signature header" });
    }

    if (!Buffer.isBuffer(req.body)) {
      console.error("req.body is not a Buffer");
      return res
        .status(400)
        .json({ success: false, message: "Invalid raw body format" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (receivedSignature !== expectedSignature) {
      console.error("Invalid Razorpay signature");
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    const parsedBody = JSON.parse(req.body.toString());
    const { event, payload } = parsedBody;

    if (!payload?.payment?.entity) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload format" });
    }

    const payment = payload.payment.entity;
    const orderId = payment.order_id;
    const paymentId = payment.id;

    if (!orderId || !paymentId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing payment details" });
    }

    if (event === "payment.captured") {
      const updatedDonation = await Donation.findOneAndUpdate(
        { orderId },
        { status: "Successful", paymentId },
        { new: true },
      );

      if (updatedDonation) {
        console.log(`✅ Donation marked successful: ${orderId}`);
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error processing Razorpay webhook:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /api/v1/payments/mark-failed
 * Marks a pending donation as Failed when the user cancels Razorpay checkout.
 */
export const markDonationAsFailed = async (req, res) => {
  try {
    const { cowId, type = "cow" } = req.body;
    const userId = req.user.id;

    if (!userId) {
      return sendResponse(res, 400, false, null, "Missing userId");
    }

    if (type === "cow" && !cowId) {
      return sendResponse(
        res,
        400,
        false,
        null,
        "Missing cowId for cow donation",
      );
    }

    const query = {
      userId,
      type,
      status: "Pending",
    };

    if (type === "cow") {
      query.cowId = cowId;
    }

    const updated = await Donation.findOneAndUpdate(
      query,
      { status: "Failed" },
      { new: true },
    );

    if (!updated) {
      return sendResponse(res, 404, false, null, "No pending donation found");
    }

    return sendResponse(res, 200, true, updated, "Marked donation as failed");
  } catch (error) {
    console.error("Error marking donation as failed:", error);
    return sendResponse(res, 500, false, null, "Server error");
  }
};
