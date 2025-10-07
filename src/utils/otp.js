// src/utils/otp.js

import logger from "./logger.js";
import { sendMailResend } from "./sendMailResend.js";

// Expiry times for each OTP type (in ms)
const OTP_EXPIRY_MS = {
  twoFactor: 20 * 1000, // 20 seconds
  emailVerification: 24 * 60 * 60 * 1000, // 24 hours
  passwordReset: 20 * 1000, // 20 seconds
};

const LABELS = {
  twoFactor: "Two-Factor Authentication",
  emailVerification: "Email Verification",
  passwordReset: "Password Reset",
};

/**
 * Sends a dynamic OTP email using the Resend service
 * @param {string} to - Recipient's email
 * @param {string} otp - One-time password
 * @param {string} typeLabel - human-readable label
 * @param {number} expiryMinutes - Expiry time in minutes
 */
const sendOTPEmail = async (to, otp, typeLabel, expiryMinutes) => {
  const subject = `${typeLabel} OTP - Dayadevraha`;

  await sendMailResend({
    to,
    subject,
    templateName: "otp", // uses otp.hbs
    templateData: {
      otp,
      otpType: typeLabel,
      expiryMinutes,
    },
  });
};

/**
 * Generates and sends an OTP for 2FA, Email Verification, or Password Reset.
 *
 * @param {Object} user - Mongoose user/admin document
 * @param {"twoFactor"|"emailVerification"|"passwordReset"} [type="twoFactor"]
 * @returns {Promise<void>}
 */
export const generateAndSendOTP = async (user, type = "twoFactor") => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const expiryMs = OTP_EXPIRY_MS[type];
  const expiryMinutes = expiryMs / (60 * 1000);
  const expiryAt = new Date(Date.now() + expiryMs);
  const label = LABELS[type];

  // ✅ Unified OTP assignment (stored as Date for clarity)
  user.emailOTP = otp;
  user.emailOTPExpires = expiryAt;

  await user.save();

  await sendOTPEmail(user.email, otp, label, expiryMinutes);
  logger.info(
    `${label} OTP sent to ${user.constructor.modelName}: ${user._id}`,
  );
};

/**
 * Gets OTP expiry time in milliseconds
 * @param {"twoFactor"|"emailVerification"|"passwordReset"} [type="twoFactor"]
 * @returns {number}
 */
export const getOTPExpiryMs = (type = "twoFactor") => OTP_EXPIRY_MS[type];
