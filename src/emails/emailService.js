import { sendMailResend } from "../utils/sendMailResend.js";

/**
 * Sends a two-factor authentication OTP email.
 * @param {string} to - Recipient's email address.
 * @param {string} otp - One-time password code.
 * @returns {Promise} - Resolves when the email is sent.
 */
export const sendOTPEmail = async (to, otp) => {
  const subject = `Your OTP Code is ${otp} - Dayadevraha`;
  return sendMailResend({
    to,
    subject,
    templateName: "otp", // matches otp.hbs
    templateData: { otp },
  });
};

/**
 * Sends a donation confirmation email to a user.
 * @param {string} to - Recipient's email address.
 * @param {number|string} amount - Donation amount.
 * @param {string} cowName - Name of the cow (or care) being supported.
 * @returns {Promise} - Resolves when the email is sent.
 */
export const sendDonationConfirmationEmail = async (to, amount, cowName) => {
  const subject = `Thank You for Your Donation - Dayadevraha`;

  return sendMailResend({
    to,
    subject,
    templateName: "donation-confirmation", // matches donation-confirmation.hbs
    templateData: {
      amount,
      cowName: cowName || "our cows",
    },
  });
};
