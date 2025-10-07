// src/controllers/cow-puja/clientController.js
import crypto from "crypto";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import { z } from "zod";

import CowPujaOrder from "../../models/CowPujaOrder.js";
import { emailPujaPaymentReceived } from "../../services/cowPujaEmailsService.js";
import { sendResponse } from "../../utils/helpers.js";
import {
  createOrderSchema,
  verifyPaymentSchema,
} from "../../validations/cowPujaValidation.js";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/v1/cow-puja/orders
export const createCowPujaOrder = async (req, res) => {
  try {
    const parse = createOrderSchema.safeParse(req.body);
    if (!parse.success) {
      return sendResponse(
        res,
        422,
        false,
        null,
        parse.error.errors?.[0]?.message || "Invalid payload",
      );
    }

    const userId = req.user?.id;
    if (!userId) return sendResponse(res, 401, false, null, "Unauthorized");

    // Force name/email to token (immutable)
    const name = req.user?.name || parse.data.customer.name;
    const email = req.user?.email || parse.data.customer.email;

    // Create Razorpay order
    const rpOrder = await razorpay.orders.create({
      amount: parse.data.amount * 100,
      currency: parse.data.currency,
      payment_capture: 1,
    });

    // Persist our order (AwaitingPayment until payment captured)
    const doc = await CowPujaOrder.create({
      userId,
      orderId: rpOrder.id,
      amount: parse.data.amount,
      currency: parse.data.currency,
      customer: {
        name,
        email,
        phone: parse.data.customer.phone, // already +91XXXXXXXXXX from client
      },
      pujaDetails: {
        ...parse.data.pujaDetails,
        preferredDate: parse.data.pujaDetails.preferredDate
          ? new Date(parse.data.pujaDetails.preferredDate)
          : undefined,
      },
      status: "AwaitingPayment",
      timeline: [{ type: "created", by: `user:${userId}` }],
    });

    // Optionally email “order created” (not necessary)
    return sendResponse(
      res,
      200,
      true,
      {
        orderId: rpOrder.id,
        keyId: process.env.RAZORPAY_KEY_ID,
        amount: doc.amount,
        currency: doc.currency,
      },
      "Cow Puja order created successfully.",
    );
  } catch (err) {
    console.error("❌ createCowPujaOrder error:", err);
    return sendResponse(res, 500, false, null, "Server error.");
  }
};

// POST /api/v1/cow-puja/verify
// (optional quick verification; source of truth = webhook)
export const verifyCowPujaPayment = async (req, res) => {
  try {
    const parsed = verifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendResponse(
        res,
        422,
        false,
        null,
        parsed.error.errors?.[0]?.message || "Invalid payload",
      );
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      parsed.data;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return sendResponse(res, 400, false, null, "Signature mismatch");
    }

    // Don’t flip DB state here; webhook will.
    return sendResponse(res, 200, true, { success: true }, "Verified");
  } catch (err) {
    console.error("❌ verifyCowPujaPayment error:", err);
    return sendResponse(res, 500, false, null, "Server error.");
  }
};

// POST /api/v1/cow-puja/webhook  (raw body)
// express.raw({ type: "*/*" }) required on this route
export const cowPujaWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_COW_PUJA_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    if (!signature)
      return res
        .status(400)
        .json({ success: false, message: "Missing signature" });
    if (!Buffer.isBuffer(req.body)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid raw body" });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");
    if (signature !== expected) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    const event = JSON.parse(req.body.toString());
    if (event?.event === "payment.captured") {
      const payment = event?.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;

      if (orderId && paymentId) {
        const order = await CowPujaOrder.findOne({ orderId });
        if (order && order.status !== "SuccessfulPayment") {
          order.paymentId = paymentId;
          order.status = "SuccessfulPayment";
          order.timeline.push({ type: "payment_captured", by: "system" });
          await order.save();

          // Email user: payment received
          try {
            await emailPujaPaymentReceived(order.customer.email, order);
          } catch (e) {
            console.error("Email payment received failed:", e);
          }
        }
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ cowPujaWebhook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/v1/cow-puja/mark-failed
export const markCowPujaOrderFailed = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendResponse(res, 401, false, null, "Unauthorized");

    const pending = await CowPujaOrder.findOneAndUpdate(
      { userId, status: "AwaitingPayment" },
      {
        status: "Failed",
        $push: { timeline: { type: "failed", by: `user:${userId}` } },
      },
      { new: true },
    );

    if (!pending)
      return sendResponse(res, 404, false, null, "No pending order found");
    return sendResponse(res, 200, true, pending, "Marked as failed");
  } catch (err) {
    console.error("❌ markCowPujaOrderFailed error:", err);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

// GET /api/v1/cow-puja/my/orders
export const listMyCowPujaOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendResponse(res, 401, false, null, "Unauthorized");

    const { page = 1, limit = 20, status } = req.query;
    const q = { userId };
    if (status) q.status = status;

    const docs = await CowPujaOrder.find(q)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return sendResponse(res, 200, true, docs, "OK");
  } catch (err) {
    console.error("❌ listMyCowPujaOrders error:", err);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

// GET /api/v1/cow-puja/my/orders/:id
export const getMyCowPujaOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendResponse(res, 401, false, null, "Unauthorized");
    const id = req.params.id;

    const doc = await CowPujaOrder.findOne({ _id: id, userId });
    if (!doc) return sendResponse(res, 404, false, null, "Not found");

    return sendResponse(res, 200, true, doc, "OK");
  } catch (err) {
    console.error("❌ getMyCowPujaOrder error:", err);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

// POST /api/v1/cow-puja/orders/:orderId/abort
export const abortCowPujaOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendResponse(res, 401, false, null, "Unauthorized");

    const { orderId } = req.params;

    const updated = await CowPujaOrder.findOneAndUpdate(
      { userId, orderId, status: "AwaitingPayment" },
      {
        status: "Aborted",
        $push: { timeline: { type: "aborted", by: `user:${userId}` } },
      },
      { new: true },
    );

    if (!updated) {
      return sendResponse(
        res,
        404,
        false,
        null,
        "No awaiting-payment order found or already finalized",
      );
    }
    return sendResponse(res, 200, true, updated, "Order aborted");
  } catch (err) {
    console.error("abortCowPujaOrder error:", err);
    return sendResponse(res, 500, false, null, "Server error");
  }
};
