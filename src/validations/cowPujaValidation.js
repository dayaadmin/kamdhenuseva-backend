// src/validations/cowPujaValidation.js
import { z } from "zod";

const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
const emptyToUndef = (v) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

// --- helpers ---
const trimmedNonEmpty = (label, min = 1) =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a string`,
    })
    .trim()
    .refine((s) => s.length >= min, {
      message: `${label} must be at least ${min} characters`,
    });

const phoneSchema = z
  .string({
    required_error: "Phone is required",
    invalid_type_error: "Phone must be a string",
  })
  .trim()
  .refine((s) => /^\+91\d{10}$/.test(s), {
    message: "Phone must be in E.164 format: +91XXXXXXXXXX (10 digits)",
  });

// Accept ISO string or Date → normalize to Date
const isoOrDateToDate = z
  .union([
    z
      .string({
        invalid_type_error: "Date must be a string in ISO format",
      })
      .datetime({
        message:
          "Date must be a valid ISO datetime string (e.g. 2025-09-22T10:00:00.000Z)",
      }),
    z.date({ invalid_type_error: "Date must be a valid Date object" }),
  ])
  .transform((v) => (typeof v === "string" ? new Date(v) : v));

// Optional preferredDate: if present, must be ≥ 72 hours from now
const preferredDateOptionalSchema = z
  .preprocess(emptyToUndef, isoOrDateToDate.optional())
  .refine((d) => !d || (d instanceof Date && !Number.isNaN(d.getTime())), {
    message: "preferredDate is invalid",
  })
  .refine((d) => !d || d.getTime() - Date.now() >= THREE_DAYS_MS, {
    message: "preferredDate must be at least 3 full days (≥72 hours) from now",
  });

// If you want preferredDate to be REQUIRED instead, use:
// const preferredDateRequiredSchema = isoOrDateToDate
//   .refine((d) => d.getTime() - Date.now() >= THREE_DAYS_MS, {
//     message: "preferredDate must be at least 3 full days (≥72 hours) from now",
//   });

export const createOrderSchema = z.object({
  customer: z.object({
    name: trimmedNonEmpty("Name", 2),
    email: z
      .string({
        required_error: "Email is required",
        invalid_type_error: "Email must be a string",
      })
      .trim()
      .email({ message: "Email must be a valid email address" }),
    phone: phoneSchema,
  }),
  pujaDetails: z.object({
    gotra: trimmedNonEmpty("Gotra", 2),
    sankalpam: trimmedNonEmpty("Sankalpam", 5),
    preferredDate: preferredDateOptionalSchema, // swap to required variant if needed
    namesToInclude: z.preprocess(emptyToUndef, z.string().trim().optional()),
    additionalNotes: z.preprocess(emptyToUndef, z.string().trim().optional()),
  }),
  amount: z
    .number({
      required_error: "Amount is required",
      invalid_type_error: "Amount must be a number",
    })
    .int({ message: "Amount must be an integer (₹ in whole rupees)" })
    .positive({ message: "Amount must be greater than 0" }),
  currency: z
    .enum(["INR"], {
      required_error: "Currency is required",
      invalid_type_error: "Currency must be a string",
    })
    .refine((c) => c === "INR", { message: "Currency must be INR" }),
});

export const verifyPaymentSchema = z.object({
  razorpay_payment_id: trimmedNonEmpty("razorpay_payment_id", 1),
  razorpay_order_id: trimmedNonEmpty("razorpay_order_id", 1),
  razorpay_signature: trimmedNonEmpty("razorpay_signature", 1),
});

export const confirmDateSchema = z.object({
  scheduledDate: isoOrDateToDate
    .refine((d) => d instanceof Date && !Number.isNaN(d.getTime()), {
      message: "scheduledDate is invalid",
    })
    .refine((d) => d.getTime() - Date.now() >= THREE_DAYS_MS, {
      message:
        "scheduledDate must be at least 3 full days (≥72 hours) from now",
    }),
});

export const cancelOrderSchema = z.object({
  reason: z
    .string({
      required_error: "Cancellation reason is required",
      invalid_type_error: "Cancellation reason must be a string",
    })
    .trim()
    .refine((s) => s.length >= 3, {
      message: "Cancellation reason must be at least 3 characters",
    }),
});
