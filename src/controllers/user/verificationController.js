// src/controllers/verificationController.js

import _ from "lodash";

import Session from "../../models/Session.js";
import User from "../../models/User.js";
import { setUserAuth } from "../../utils/authHelper.js";
import { sendResponse } from "../../utils/helpers.js";
import logger from "../../utils/logger.js";
import { getRequestMeta } from "../../utils/requestMeta.js";

export const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      logger.warn("Verify Email OTP: Missing email or OTP");
      return sendResponse(res, 400, false, null, "Email and OTP are required");
    }

    const user = await User.findOne({ email });

    if (!user) {
      logger.warn(`Verify Email OTP: No user found for ${email}`);
      return sendResponse(res, 404, false, null, "User not found");
    }

    const isOTPExpired =
      !user.emailOTPExpires || user.emailOTPExpires < Date.now();
    const isOTPMatch = user.emailOTP === otp;

    if (!isOTPMatch || isOTPExpired) {
      logger.warn(
        `Verify Email OTP failed for ${email}: ${
          isOTPExpired ? "Expired" : "Incorrect"
        } OTP`,
      );
      return sendResponse(res, 400, false, null, "OTP is invalid or expired");
    }

    // OTP is valid, now determine intent
    let message = "2FA verification successful";

    if (!user.isVerified) {
      // ✅ Email verification during registration
      user.isVerified = true;
      message = "Email verified successfully";
      logger.info(`Email verified for user: ${user._id}`);

      // NOTE: We are NOT auto-logging in on registration here.
      // If you want to auto-login after email verification, also set cookie+session below.
    } else if (user.twoFactorEnabled) {
      // ✅ 2FA login verification → create session & set cookie
      const token = setUserAuth(res, user);
      await Session.create({
        user: user._id,
        userModel: "User",
        token,
        ...getRequestMeta(req),
      });
      logger.info(`2FA verified and session created for user: ${user._id}`);
    }

    // Clear OTP after successful verification (regardless of type)
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    await user.save();

    return sendResponse(
      res,
      200,
      true,
      {
        _id: user._id,
        email: user.email,
        name: user.name || null,
        isVerified: user.isVerified,
        twoFactorEnabled: !!user.twoFactorEnabled,
      },
      message,
    );
  } catch (err) {
    logger.error(`Error in verifyEmailOTP: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};
