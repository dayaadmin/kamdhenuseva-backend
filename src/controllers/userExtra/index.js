// src/controllers/userExtra/index.js

import bcrypt from "bcryptjs";

import Session from "../../models/Session.js";
import User from "../../models/User.js";
import { setUserAuth } from "../../utils/authHelper.js";
import { sendResponse } from "../../utils/helpers.js";
import logger from "../../utils/logger.js";
import { generateAndSendOTP } from "../../utils/otp.js";
import { isOTPResendAllowed } from "../../utils/otpThrottle.js";
import { getRequestMeta } from "../../utils/requestMeta.js";

/** Safely get epoch ms from a Date/number/undefined */
const toEpochMs = (val) => {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

/** Clamp to non-negative seconds from a Date-like value */
const secondsLeftFrom = (expiresAt) => {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
};

/**
 * POST /api/v1/user/forgot-password/request
 * Body: { email }
 * Sends an OTP to the user's email for password reset.
 *
 * Uses unified emailOTP/emailOTPExpires; short-lived as configured in otp.js.
 * Neutral responses to avoid user enumeration.
 */
export const requestPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      logger.warn("Forgot password request: Email missing.");
      return sendResponse(
        res,
        200,
        true,
        null,
        "If the email exists, an OTP has been sent",
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Forgot password request: User not found for ${email}`);
      return sendResponse(
        res,
        200,
        true,
        null,
        "If the email exists, an OTP has been sent",
      );
    }

    const { allowed, secondsLeft } = isOTPResendAllowed(user.emailOTPExpires);
    if (!allowed) {
      logger.info(
        `Forgot password OTP resend blocked for ${user._id}, ${secondsLeft}s left`,
      );
      return sendResponse(
        res,
        200,
        true,
        { secondsLeft },
        `OTP already sent. Please try again in ${secondsLeft}s`,
      );
    }

    await generateAndSendOTP(user, "passwordReset");

    const s = secondsLeftFrom(user.emailOTPExpires);
    logger.info(`Password reset OTP generated & sent for user: ${user._id}`);
    return sendResponse(
      res,
      200,
      true,
      { secondsLeft: s },
      "If the email exists, an OTP has been sent",
    );
  } catch (err) {
    logger.error(`Error in requestPasswordResetOTP: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * POST /api/v1/user/forgot-password/confirm
 * Body: { email, otp, newPassword, confirmPassword }
 * Verifies OTP (emailOTP/emailOTPExpires) and sets new password.
 */
export const confirmPasswordResetWithOTP = async (req, res) => {
  try {
    const { email, otp: rawOtp, newPassword, confirmPassword } = req.body || {};
    if (!email || !rawOtp || !newPassword || !confirmPassword) {
      return sendResponse(
        res,
        400,
        false,
        null,
        "Email, OTP and both passwords are required",
      );
    }
    if (newPassword !== confirmPassword) {
      return sendResponse(res, 400, false, null, "Passwords do not match");
    }
    if (newPassword.length < 6) {
      return sendResponse(
        res,
        400,
        false,
        null,
        "Password must be at least 6 characters",
      );
    }

    const user = await User.findOne({ email }).select(
      "+emailOTP +emailOTPExpires",
    );
    if (!user || !user.emailOTP || !user.emailOTPExpires) {
      logger.warn(`Password reset confirm: missing OTP fields for ${email}`);
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    const now = Date.now();
    if (toEpochMs(user.emailOTPExpires) < now) {
      logger.warn(`Password reset confirm: expired OTP for ${email}`);
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    const otp = String(rawOtp).trim();
    if (otp !== String(user.emailOTP).trim()) {
      logger.warn(`Password reset confirm: OTP mismatch for ${email}`);
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear OTP
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;

    await user.save();

    // Optional: login after reset
    setUserAuth(res, { _id: user._id, email: user.email });

    logger.info(`Password reset via OTP successful for user: ${user._id}`);
    return sendResponse(res, 200, true, null, "Password reset successful");
  } catch (err) {
    logger.error(`Error in confirmPasswordResetWithOTP: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * POST /api/v1/user/enable-two-factor
 * Private (auth required)
 * Body: { otp? }
 * - If otp missing: send an OTP and ask client to resubmit with otp (throttled)
 * - If otp present: verify and enable 2FA
 */
export const enableTwoFactorAuth = async (req, res) => {
  try {
    const rawOtp = req.body?.otp;
    const user = await User.findById(req.user.id).select(
      "+emailOTP +emailOTPExpires",
    );
    if (!user) {
      logger.warn(`Enable 2FA: User not found ${req.user.id}`);
      return sendResponse(res, 404, false, null, "User not found");
    }

    if (!rawOtp) {
      const { allowed, secondsLeft } = isOTPResendAllowed(user.emailOTPExpires);
      if (!allowed) {
        logger.info(
          `Enable 2FA OTP resend blocked for ${user._id}, ${secondsLeft}s left`,
        );
        return sendResponse(
          res,
          200,
          true,
          { secondsLeft },
          `OTP already sent. Please try again in ${secondsLeft}s`,
        );
      }

      await generateAndSendOTP(user, "twoFactor");

      const s = secondsLeftFrom(user.emailOTPExpires);
      logger.info(`Enable 2FA: OTP sent to user ${user._id}`);
      return sendResponse(
        res,
        200,
        true,
        { secondsLeft: s },
        "OTP sent. Please confirm with the code.",
      );
    }

    // Verify path
    if (!user.emailOTP || !user.emailOTPExpires) {
      logger.warn(`Enable 2FA: OTP missing for user ${user._id}`);
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }
    if (new Date(user.emailOTPExpires).getTime() < Date.now()) {
      logger.warn(`Enable 2FA: OTP expired for user ${user._id}`);
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    const otp = String(rawOtp).trim();
    if (otp !== String(user.emailOTP).trim()) {
      logger.warn(`Enable 2FA: OTP mismatch for user ${user._id}`);
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    user.twoFactorEnabled = true;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    await user.save();

    logger.info(`Two-factor enabled for user: ${user._id}`);
    return sendResponse(
      res,
      200,
      true,
      null,
      "Two-factor authentication enabled",
    );
  } catch (err) {
    logger.error(`Error in enableTwoFactorAuth: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * POST /api/v1/user/disable-two-factor
 * Private (auth required)
 * Body: { otp? }
 * - If otp missing: send one and ask to confirm (throttled)
 * - If otp present: verify and disable 2FA
 */
export const disableTwoFactorAuth = async (req, res) => {
  try {
    const rawOtp = req.body?.otp;
    const user = await User.findById(req.user.id).select(
      "+emailOTP +emailOTPExpires",
    );
    if (!user) {
      logger.warn(`Disable 2FA: User not found ${req.user.id}`);
      return sendResponse(res, 404, false, null, "User not found");
    }

    if (!rawOtp) {
      const { allowed, secondsLeft } = isOTPResendAllowed(user.emailOTPExpires);
      if (!allowed) {
        logger.info(
          `Disable 2FA OTP resend blocked for ${user._id}, ${secondsLeft}s left`,
        );
        return sendResponse(
          res,
          200,
          true,
          { secondsLeft },
          `OTP already sent. Please try again in ${secondsLeft}s`,
        );
      }

      await generateAndSendOTP(user, "twoFactor");

      const s = secondsLeftFrom(user.emailOTPExpires);
      logger.info(`Disable 2FA: OTP sent to user ${user._id}`);
      return sendResponse(
        res,
        200,
        true,
        { secondsLeft: s },
        "OTP sent. Please confirm with the code.",
      );
    }

    if (!user.emailOTP || !user.emailOTPExpires) {
      logger.warn(`Disable 2FA: OTP missing for user ${user._id}`);
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }
    if (new Date(user.emailOTPExpires).getTime() < Date.now()) {
      logger.warn(`Disable 2FA: OTP expired for user ${user._id}`);
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    const otp = String(rawOtp).trim();
    if (otp !== String(user.emailOTP).trim()) {
      logger.warn(`Disable 2FA: OTP mismatch for user ${user._id}`);
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    user.twoFactorEnabled = false;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    await user.save();

    logger.info(`Two-factor disabled for user: ${user._id}`);
    return sendResponse(
      res,
      200,
      true,
      null,
      "Two-factor authentication disabled",
    );
  } catch (err) {
    logger.error(`Error in disableTwoFactorAuth: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * POST /api/v1/resend-two-factor
 * Body: { email }
 * Re-sends a login 2FA OTP if throttling allows.
 */
export const resendTwoFactorDuringLogin = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return sendResponse(res, 400, false, null, "Email is required");

    const user = await User.findOne({ email }).select(
      "+emailOTP +emailOTPExpires",
    );
    if (!user || !user.twoFactorEnabled) {
      return sendResponse(res, 400, false, null, "Invalid request");
    }

    const { allowed, secondsLeft: sl } = isOTPResendAllowed(
      user.emailOTPExpires,
    );
    if (!allowed) {
      return sendResponse(
        res,
        429,
        false,
        { secondsLeft: sl },
        `Please wait ${sl}s before requesting a new OTP`,
      );
    }

    await generateAndSendOTP(user, "twoFactor");
    const secondsLeft = secondsLeftFrom(user.emailOTPExpires);
    return sendResponse(res, 200, true, { secondsLeft }, "OTP resent");
  } catch (err) {
    logger.error(`Error in resendTwoFactorDuringLogin: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * POST /api/v1/verify-email-otp
 * Body: { email, otp }
 * Verifies email ownership during registration/login-not-verified flows.
 */
export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp: rawOtp } = req.body || {};
    if (!email || !rawOtp) {
      return sendResponse(res, 400, false, null, "Email and OTP are required");
    }

    const user = await User.findOne({ email }).select(
      "+emailOTP +emailOTPExpires",
    );
    if (!user || !user.emailOTP || !user.emailOTPExpires) {
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    if (new Date(user.emailOTPExpires).getTime() < Date.now()) {
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }
    if (String(user.emailOTP).trim() !== String(rawOtp).trim()) {
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    user.isVerified = true;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    await user.save();

    return sendResponse(res, 200, true, null, "Email verified");
  } catch (err) {
    logger.error(`Error in verifyEmailOtp: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * POST /api/v1/verify-two-factor
 * Body: { email, otp }
 * Confirms login 2FA OTP, sets cookie, and records a session.
 */
export const verifyTwoFactorDuringLogin = async (req, res) => {
  try {
    const { email, otp: rawOtp } = req.body || {};
    if (!email || !rawOtp) {
      return sendResponse(res, 400, false, null, "Email and OTP are required");
    }

    const user = await User.findOne({ email }).select(
      "+emailOTP +emailOTPExpires",
    );
    if (!user || !user.twoFactorEnabled) {
      return sendResponse(res, 400, false, null, "2FA not enabled");
    }

    if (
      !user.emailOTP ||
      !user.emailOTPExpires ||
      new Date(user.emailOTPExpires).getTime() < Date.now()
    ) {
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }
    if (String(user.emailOTP).trim() !== String(rawOtp).trim()) {
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    // Clear OTP and persist
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    await user.save();

    // Set cookie
    const token = setUserAuth(res, user);

    // Session write is non-fatal to avoid masking successful auth
    try {
      await Session.create({
        user: user._id,
        userModel: "User",
        token,
        ...getRequestMeta(req),
      });
    } catch (e) {
      logger.error(
        `Non-fatal: failed to persist session for ${user._id}: ${e.message}`,
      );
    }

    // Respond with explicit user payload (no lodash)
    const payload = {
      _id: user._id,
      userId: user.userId,
      name: user.name ?? null,
      email: user.email,
      dateOfBirth: user.dateOfBirth,
    };

    return sendResponse(res, 200, true, payload, "Login successful");
  } catch (err) {
    logger.error(`Error in verifyTwoFactorDuringLogin: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};
