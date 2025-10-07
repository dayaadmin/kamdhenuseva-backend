// src/routes/userRoutes.js

import { Router } from "express";

import {
  registerUserInit,
  completeUserRegistration,
  loginUser,
  validateUserToken,
  logoutUser,
  getUserProfile,
  updateUserProfile, // non-sensitive fields only
  deleteUserAccount,
  verifyEmailOTP,
  renameUser, // NEW: password-gated rename
  changeUserPassword, // NEW: old -> new password
} from "../controllers/user/index.js";
import { userProtect } from "../middlewares/authMiddleware.js";
import { loginLimiter } from "../middlewares/rateLimiter.js";

/**
 * Initializes user-related API routes.
 *
 * @param {string|number} version - API version string (e.g., "1")
 * @returns {import('express').Router} Configured Express router
 */
export default function userRoutes(version) {
  const router = Router();

  /**
   * @route POST /user/register/init
   * @versioned
   * @description Initiate user registration. Accepts email and sends OTP.
   * @access Public
   */
  router.post(`/api/v${version}/user/register/init`, registerUserInit);

  /**
   * @route POST /user/register/complete
   * @versioned
   * @description Complete user registration with name, password, etc.
   * @access Public
   */
  router.post(
    `/api/v${version}/user/register/complete`,
    completeUserRegistration,
  );

  /**
   * @route POST /user/verify-email-otp
   * @versioned
   * @description Verify OTP sent to email for registration or login.
   * @access Public
   */
  router.post(`/api/v${version}/user/verify-email-otp`, verifyEmailOTP);

  /**
   * @route POST /user/login
   * @versioned
   * @description Log in with email and password. OTP sent if 2FA enabled.
   * @access Public (rate-limited)
   */
  router.post(`/api/v${version}/user/login`, loginLimiter, loginUser);

  /**
   * @route GET /user/validate-token
   * @versioned
   * @description Check validity of user token (used for session persistence).
   * @access Public (uses cookie or Authorization header)
   */
  router.get(`/api/v${version}/user/validate-token`, validateUserToken);

  /**
   * @route POST /user/logout
   * @versioned
   * @description Clear authentication cookie and log out the user.
   * @access Public (relies on cookie)
   */
  router.post(`/api/v${version}/user/logout`, logoutUser);

  /**
   * @route GET /user/profile
   * @versioned
   * @description Retrieve user profile. Requires authentication and verified email.
   * @access Private
   */
  router.get(`/api/v${version}/user/profile`, userProtect, getUserProfile);

  /**
   * @route PUT /user/update-profile
   * @versioned
   * @description Update non-sensitive user profile fields (e.g., email, dateOfBirth).
   *              Name and password changes are handled by dedicated routes below.
   * @access Private
   */
  router.put(
    `/api/v${version}/user/update-profile`,
    userProtect,
    updateUserProfile,
  );

  /**
   * @route POST /user/rename
   * @versioned
   * @description Rename user (requires current password in body).
   * @access Private
   */
  router.post(`/api/v${version}/user/rename`, userProtect, renameUser);

  /**
   * @route POST /user/change-password
   * @versioned
   * @description Change password (requires oldPassword and newPassword in body).
   * @access Private
   */
  router.post(
    `/api/v${version}/user/change-password`,
    userProtect,
    changeUserPassword,
  );

  /**
   * @route DELETE /user/delete-account
   * @versioned
   * @description Permanently delete user account. Requires authentication and verified email.
   * @access Private
   */
  router.delete(
    `/api/v${version}/user/delete-account`,
    userProtect,
    deleteUserAccount,
  );

  return router;
}
