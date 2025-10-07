// src/controllers/userController.js

import bcrypt from "bcryptjs";
import _ from "lodash";
import { z } from "zod";

import Session from "../../models/Session.js";
import User from "../../models/User.js";
import { setUserAuth, clearUserAuth } from "../../utils/authHelper.js";
import { sendResponse, formatError } from "../../utils/helpers.js";
import logger from "../../utils/logger.js";
import { getRequestMeta } from "../../utils/requestMeta.js";

// ----- Existing Endpoint: Complete Registration (Unchanged except response fields) -----
export const completeUserRegistration = async (req, res) => {
  try {
    const completeSchema = z
      .object({
        email: z.string().email({ message: "Invalid email format" }),
        name: z.string().min(1, { message: "Name is required" }),
        password: z
          .string()
          .min(6, { message: "Password must be at least 6 characters long" }),
        confirmPassword: z.string().min(6, {
          message: "Confirm password must be at least 6 characters long",
        }),
        dateOfBirth: z.string().optional(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });

    const parsedData = completeSchema.parse(req.body);

    const user = await User.findOne({ email: parsedData.email });
    if (!user) {
      logger.warn(
        `Complete registration failed: User not found (${parsedData.email})`,
      );
      return sendResponse(res, 404, false, null, "User not found");
    }
    if (!user.isVerified) {
      logger.warn(
        `Complete registration failed: Email not verified (${parsedData.email})`,
      );
      return sendResponse(res, 403, false, null, "Email not verified");
    }

    const salt = await bcrypt.genSalt(10);
    parsedData.password = await bcrypt.hash(parsedData.password, salt);
    delete parsedData.confirmPassword;

    user.name = parsedData.name;
    user.password = parsedData.password;
    user.dateOfBirth = parsedData.dateOfBirth;
    await user.save();

    const token = setUserAuth(res, user);

    await Session.create({
      user: user._id,
      userModel: "User",
      ...getRequestMeta(req),
      token,
    });

    logger.info(`Registration complete for user: ${user._id}`);
    return sendResponse(
      res,
      201,
      true,
      _.pick(user, ["_id", "userId", "name", "email", "dateOfBirth"]),
      "Registration completed successfully",
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.error("Validation error during complete registration");
      return res
        .status(400)
        .json({ success: false, errors: formatError(err.errors) });
    }
    logger.error(`Error in completeUserRegistration: ${err.message}`);
    return sendResponse(res, 500, false, null, "Server error");
  }
};
