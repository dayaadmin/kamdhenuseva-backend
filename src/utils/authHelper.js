import {
  USER_TOKEN_COOKIE_NAME,
  userTokenCookieOptions,
} from "./cookieConfig.js";
import { generateUserToken } from "../services/tokenServices.js";

/**
 * Generate token and set as HTTP-only cookie
 * @param {Response} res - Express response
 * @param {Object} user - Must contain `_id` and `email`
 * @returns {string} - The JWT token
 */
export const setUserAuth = (res, user) => {
  const token = generateUserToken({ id: user._id, email: user.email });
  res.cookie(USER_TOKEN_COOKIE_NAME, token, userTokenCookieOptions);
  return token;
};

/**
 * Clear the user token cookie
 * @param {Response} res
 */
export const clearUserAuth = (res) => {
  res.clearCookie(USER_TOKEN_COOKIE_NAME);
};
