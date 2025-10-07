// src/controllers/authController.js

import bcrypt from "bcryptjs";
import _ from "lodash";
import { z } from "zod";

import Session from "../../models/Session.js";
import User from "../../models/User.js";
import { verifyUserToken } from "../../services/tokenServices.js";
import { setUserAuth, clearUserAuth } from "../../utils/authHelper.js";
import { sendResponse, formatError } from "../../utils/helpers.js";
import logger from "../../utils/logger.js";
import { generateAndSendOTP } from "../../utils/otp.js";
import { isOTPResendAllowed } from "../../utils/otpThrottle.js";
import { getRequestMeta } from "../../utils/requestMeta.js";

// ----- Step 1 - Initiate Registration (Email Only) -----
export const registerUserInit = async (req, res) => {
  try {
    const emailSchema = z.object({
      email: z.string().email({ message: "Invalid email format" }),
    });
    const { email } = emailSchema.parse(req.body);

    let user = await User.findOne({ email });
    if (user) {
      // Fully verified user? Reject registration
      if (user.isVerified && user.name) {
        logger.warn(
          `Registration init failed: ${email} already exists and is verified.`,
        );
        return sendResponse(res, 400, false, null, "User already exists");
      }

      // Throttle OTP resends
      const { allowed, secondsLeft } = isOTPResendAllowed(user.emailOTPExpires);
      if (!allowed) {
        return sendResponse(
          res,
          429,
          false,
          { secondsLeft },
          `Please wait ${secondsLeft}s before requesting a new OTP`,
        );
      }
    } else {
      // Create new unverified user
      user = await User.create({ email });
    }

    await generateAndSendOTP(user, "emailVerification");

    // Provide secondsLeft so the client can start countdown immediately
    const secondsLeft = user.emailOTPExpires
      ? Math.max(
          0,
          Math.ceil(
            (new Date(user.emailOTPExpires).getTime() - Date.now()) / 1000,
          ),
        )
      : null;

    logger.info(`Registration init: OTP sent to ${user.email}`);
    return sendResponse(
      res,
      200,
      true,
      { email: user.email, secondsLeft },
      "OTP sent for email verification",
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.error("Validation error during registration init");
      return res
        .status(400)
        .json({ success: false, errors: formatError(err.errors) });
    }
    logger.error(`Error in registerUserInit: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

// ----- Login with auto resend OTP if email not verified -----
export const loginUser = async (req, res) => {
  try {
    const credentials = _.pick(req.body, ["email", "password"]);
    const userLoginSchema = z.object({
      email: z.string().email({ message: "Invalid email format" }),
      password: z.string().min(1, { message: "Password is required" }),
    });

    const parsedCreds = userLoginSchema.parse(credentials);

    const user = await User.findOne({ email: parsedCreds.email });
    if (!user) {
      logger.warn(`Login failed: User ${parsedCreds.email} not found.`);
      return sendResponse(res, 401, false, null, "Invalid credentials");
    }

    // Email verification check
    if (!user.isVerified) {
      const { allowed, secondsLeft } = isOTPResendAllowed(user.emailOTPExpires);
      if (!allowed) {
        return sendResponse(
          res,
          429,
          false,
          { secondsLeft },
          `Please wait ${secondsLeft}s before requesting a new OTP`,
        );
      }

      await generateAndSendOTP(user, "emailVerification");
      const s1 = user.emailOTPExpires
        ? Math.max(
            0,
            Math.ceil(
              (new Date(user.emailOTPExpires).getTime() - Date.now()) / 1000,
            ),
          )
        : null;

      logger.info(
        `Login attempt: Email not verified. OTP resent to ${user._id}`,
      );
      return sendResponse(
        res,
        200,
        true,
        { verificationRequired: true, secondsLeft: s1 },
        "Email not verified. OTP resent.",
      );
    }

    // Password check
    const isMatch = await bcrypt.compare(parsedCreds.password, user.password);
    if (!isMatch) {
      logger.warn(`Login failed: Incorrect password for ${parsedCreds.email}`);
      return sendResponse(res, 401, false, null, "Invalid credentials");
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      const { allowed, secondsLeft } = isOTPResendAllowed(user.emailOTPExpires);
      if (!allowed) {
        return sendResponse(
          res,
          429,
          false,
          { secondsLeft },
          `Please wait ${secondsLeft}s before requesting a new OTP`,
        );
      }

      await generateAndSendOTP(user, "twoFactor");
      const s2 = user.emailOTPExpires
        ? Math.max(
            0,
            Math.ceil(
              (new Date(user.emailOTPExpires).getTime() - Date.now()) / 1000,
            ),
          )
        : null;

      logger.info(`2FA OTP sent for user: ${user._id}`);
      return sendResponse(
        res,
        200,
        true,
        { twoFactorRequired: true, secondsLeft: s2 },
        "OTP sent for 2FA verification.",
      );
    }

    // All good: create session
    const token = setUserAuth(res, user);
    await Session.create({
      user: user._id,
      userModel: "User",
      token,
      ...getRequestMeta(req),
    });

    logger.info(`User logged in: ${user._id}`);
    return sendResponse(
      res,
      200,
      true,
      _.pick(user, ["_id", "userId", "name", "email", "dateOfBirth"]),
      "Login successful",
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.error("Validation error during login.");
      return res
        .status(400)
        .json({ success: false, errors: formatError(err.errors) });
    }
    logger.error(`Error in loginUser: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

// ----- Token Validation -----
export const validateUserToken = async (req, res) => {
  try {
    let token;
    if (req.cookies?.["user-token"]) {
      token = req.cookies["user-token"];
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      logger.warn("No token provided for validation.");
      return sendResponse(res, 401, false, null, "No token provided");
    }

    const decoded = verifyUserToken(token);
    if (!decoded) {
      logger.warn("Invalid token provided.");
      return sendResponse(res, 401, false, null, "Invalid token");
    }

    // NEW: return the user object so the client can hydrate its auth state
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      logger.warn("Token valid but user not found.");
      return sendResponse(res, 404, false, null, "User not found");
    }

    logger.info("User token validated successfully");
    return sendResponse(
      res,
      200,
      true,
      {
        _id: user._id,
        email: user.email,
        name: user.name || null,
        isVerified: !!user.isVerified,
        twoFactorEnabled: !!user.twoFactorEnabled,
        dateOfBirth: user.dateOfBirth,
        userId: user.userId,
      },
      "Token is valid",
    );
  } catch (err) {
    logger.error(`Error in validateUserToken: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};

// ----- Logout -----
export const logoutUser = async (req, res) => {
  try {
    clearUserAuth(res);
    logger.info(`User logged out: ${req.user?.id || "unknown user"}`);
    return sendResponse(res, 200, true, null, "Logged out successfully");
  } catch (err) {
    logger.error(`Error in logoutUser: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};
