// src/controllers/profileController.js

import bcrypt from "bcryptjs";
import _ from "lodash";

import User from "../../models/User.js";
import { setUserAuth } from "../../utils/authHelper.js";
import { sendResponse } from "../../utils/helpers.js";
import logger from "../../utils/logger.js";

/**
 * Retrieve the user's profile.
 * Route: GET /api/users/profile
 * - Returns user information only if the email has been verified.
 */
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      logger.warn(`Profile retrieval failed. User not found: ${req.user.id}`);
      return sendResponse(res, 404, false, null, "User not found");
    }
    if (!user.isVerified) {
      return sendResponse(
        res,
        403,
        false,
        null,
        "Your email is not verified. Please verify your email to access your profile.",
      );
    }
    logger.info(`User profile retrieved: ${req.user.id}`);
    return sendResponse(res, 200, true, user, "User profile retrieved");
  } catch (err) {
    logger.error(`Error in getUserProfile: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * Update the user's profile (non-sensitive fields only).
 * Route: PUT /api/users/profile
 * - Allows updating of non-sensitive user data if email verified.
 * - Name and password changes are handled by dedicated routes (see below).
 */
export const updateUserProfile = async (req, res) => {
  try {
    const existingUser = await User.findById(req.user.id);
    if (!existingUser) {
      logger.warn(`Update failed. User not found: ${req.user.id}`);
      return sendResponse(res, 404, false, null, "User not found");
    }
    if (!existingUser.isVerified) {
      return sendResponse(
        res,
        403,
        false,
        null,
        "Your email is not verified. Please verify your email to update your profile.",
      );
    }

    // Only allow non-sensitive fields here to avoid bypassing re-auth flows.
    const allowedFields = ["email", "dateOfBirth"];
    const updateData = _.pick(req.body, allowedFields);

    // If client tried to pass disallowed fields, ignore them (and optionally log)
    if ("name" in req.body || "password" in req.body) {
      logger.warn(
        `Blocked sensitive field update via generic profile route for user ${req.user.id}`,
      );
    }

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      select: "-password",
    });
    if (!user) {
      logger.warn(`Update failed. User not found after update: ${req.user.id}`);
      return sendResponse(res, 404, false, null, "User not found");
    }
    logger.info(`User profile updated (non-sensitive): ${req.user.id}`);
    return sendResponse(
      res,
      200,
      true,
      _.pick(user, ["_id", "name", "email", "dateOfBirth"]),
      "User profile updated successfully",
    );
  } catch (err) {
    logger.error(`Error in updateUserProfile: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * Rename user (requires password verification).
 * Route: POST /api/users/rename
 * Body: { currentPassword: string, newName: string }
 */
export const renameUser = async (req, res) => {
  try {
    const { currentPassword, newName } = req.body || {};
    if (!currentPassword || !newName) {
      return sendResponse(
        res,
        400,
        false,
        null,
        "currentPassword and newName are required.",
      );
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      logger.warn(`Rename failed. User not found: ${req.user.id}`);
      return sendResponse(res, 404, false, null, "User not found");
    }
    if (!user.isVerified) {
      return sendResponse(
        res,
        403,
        false,
        null,
        "Your email is not verified. Please verify your email to rename your profile.",
      );
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.password);
    if (!passwordOk) {
      logger.warn(`Rename failed. Invalid password: ${req.user.id}`);
      return sendResponse(res, 401, false, null, "Invalid current password");
    }

    // Basic name validation
    const trimmed = String(newName).trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      return sendResponse(res, 400, false, null, "Invalid name length.");
    }

    user.name = trimmed;
    await user.save();

    logger.info(`User renamed successfully: ${req.user.id}`);
    return sendResponse(
      res,
      200,
      true,
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
      },
      "Name updated successfully",
    );
  } catch (err) {
    logger.error(`Error in renameUser: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * Change password (old -> new).
 * Route: POST /api/users/change-password
 * Body: { oldPassword: string, newPassword: string }
 */
export const changeUserPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return sendResponse(
        res,
        400,
        false,
        null,
        "oldPassword and newPassword are required.",
      );
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      logger.warn(`Password change failed. User not found: ${req.user.id}`);
      return sendResponse(res, 404, false, null, "User not found");
    }
    if (!user.isVerified) {
      return sendResponse(
        res,
        403,
        false,
        null,
        "Your email is not verified. Please verify your email to change password.",
      );
    }

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) {
      logger.warn(
        `Password change failed. Invalid old password: ${req.user.id}`,
      );
      return sendResponse(res, 401, false, null, "Invalid old password");
    }

    if (newPassword.length < 6) {
      return sendResponse(
        res,
        400,
        false,
        null,
        "New password must be at least 6 characters.",
      );
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) {
      return sendResponse(
        res,
        400,
        false,
        null,
        "New password must be different from the old password.",
      );
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Optional: if you add user.tokenVersion, increment it here to invalidate other sessions.
    // user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    // Rotate JWT in cookie so the user continues authenticated with fresh token
    setUserAuth(res, { _id: user._id, email: user.email });

    logger.info(`Password changed successfully for user: ${req.user.id}`);
    return sendResponse(res, 200, true, null, "Password updated successfully");
  } catch (err) {
    logger.error(`Error in changeUserPassword: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

/**
 * Delete the user's account.
 * Route: DELETE /api/users/account
 * - Deletes the account only if the user's email is verified.
 */
export const deleteUserAccount = async (req, res) => {
  try {
    const existingUser = await User.findById(req.user.id);
    if (!existingUser) {
      logger.warn(`Deletion failed. User not found: ${req.user.id}`);
      return sendResponse(res, 404, false, null, "User not found");
    }
    if (!existingUser.isVerified) {
      return sendResponse(
        res,
        403,
        false,
        null,
        "Your email is not verified. Please verify your email to delete your account.",
      );
    }

    await User.findByIdAndDelete(req.user.id);
    logger.info(`User account deleted: ${req.user.id}`);
    return sendResponse(
      res,
      200,
      true,
      null,
      "User account deleted successfully",
    );
  } catch (err) {
    logger.error(`Error in deleteUserAccount: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};
