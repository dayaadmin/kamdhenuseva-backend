// src/routes/userExtraRoutes.js
import { Router } from "express";

import {
  requestPasswordResetOTP,
  confirmPasswordResetWithOTP,
  enableTwoFactorAuth,
  disableTwoFactorAuth,
  verifyEmailOtp,
  verifyTwoFactorDuringLogin,
  resendTwoFactorDuringLogin,
} from "../controllers/userExtra/index.js";
import { userProtect } from "../middlewares/authMiddleware.js";
// Reuse your login limiter for OTP endpoints, or swap for a dedicated otpLimiter if you have one
import { loginLimiter as otpLimiter } from "../middlewares/rateLimiter.js";

/**
 * Initializes additional user-related routes (forgot password via OTP, 2FA toggle with OTP).
 *
 * @param {string|number} version - API version number
 * @returns {import("express").Router} Configured Express router
 */
export default function userExtraRoutes(version) {
  const router = Router();

  router.post(`/api/v${version}/verify-email-otp`, verifyEmailOtp);

  // Forgot password: Email -> OTP -> New password
  router.post(
    `/api/v${version}/user/forgot-password/request`,
    otpLimiter,
    requestPasswordResetOTP,
  );

  router.post(
    `/api/v${version}/user/forgot-password/confirm`,
    otpLimiter,
    confirmPasswordResetWithOTP,
  );

  // 2FA (two-step in same endpoint: send OTP when missing, verify when provided)
  router.post(
    `/api/v${version}/user/enable-two-factor`,
    userProtect,
    enableTwoFactorAuth,
  );

  router.post(
    `/api/v${version}/user/disable-two-factor`,
    userProtect,
    disableTwoFactorAuth,
  );

  router.post(`/api/v${version}/verify-two-factor`, verifyTwoFactorDuringLogin);
  router.post(`/api/v${version}/resend-two-factor`, resendTwoFactorDuringLogin);

  return router;
}
