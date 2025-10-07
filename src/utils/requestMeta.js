// src/utils/requestMeta.js

export const getRequestMeta = (req) => ({
  ipAddress:
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown",
  location: "Unknown", // Later plug in geoip
  userAgent: req.headers["user-agent"] || "Unknown",
});
