import {
  sendUserVerificationOTPEmail,
  sendUserTwoFactorOTPEmail,
} from "../services/emailService.js";

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTP = async (user, type = "emailVerification") => {
  const otp = generateOTP();
  if (type === "emailVerification") {
    user.emailVerificationOTP = otp;
    user.emailVerificationOTPExpires = Date.now() + 24 * 60 * 60 * 1000; // Valid for 24 hours
    await user.save();
    return sendUserVerificationOTPEmail(user.email, otp);
  } else if (type === "twoFactor") {
    user.twoFactorOTP = otp;
    user.twoFactorOTPExpires = Date.now() + 5 * 60 * 1000; // Valid for 5 minutes
    await user.save();
    return sendUserTwoFactorOTPEmail(user.email, otp);
  }
  // Add more types if needed.
};
