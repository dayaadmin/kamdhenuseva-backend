// src/utils/cookieConfig.js

export const USER_TOKEN_COOKIE_NAME = "user-token";

const expiryInMs = (() => {
  const raw = process.env.JWT_EXPIRY || "7d";
  const match = /^(\d+)([dhms])$/.exec(raw);

  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback to 7d

  const [_, value, unit] = match;
  const multiplier =
    {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    }[unit] || 1000;

  return parseInt(value, 10) * multiplier;
})();

export const userTokenCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "None",
  maxAge: expiryInMs,
};
