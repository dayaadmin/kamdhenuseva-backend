// src/services/tokenServices.js

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

/**
 * Generate a JWT for the given payload.
 * @param {Object} payload - e.g. { id, email }
 * @returns {string} token
 */
export const generateUserToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

/**
 * Verify JWT token and return decoded data
 * @param {string} token
 * @returns {Object|null}
 */
export const verifyUserToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};
