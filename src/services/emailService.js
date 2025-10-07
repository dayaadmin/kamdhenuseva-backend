// /src/services/emailService.js

import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

// Create a nodemailer transporter using environment SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // e.g., "smtp.gmail.com"
  port: Number(process.env.SMTP_PORT), // e.g., 587 (TLS) or 465 (SSL)
  secure: false, // false for port 587 (TLS), true for port 465 (SSL)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends a verification OTP email to a user.
 * @param {string} to - Recipient's email address.
 * @param {string} otp - One-time password code.
 * @returns {Promise} - Resolves when the email is sent.
 */
export const sendUserVerificationOTPEmail = async (to, otp) => {
  const mailOptions = {
    from: `"No Reply" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your Email Verification OTP - Dayadevraha",
    text: `Your email verification OTP is: ${otp}`,
    html: `<html>
  <head>
    <style type="text/css">
      .email-container {
        width: 100%;
        background: #DAD7CD;
        padding: 20px;
        font-family: Arial, sans-serif;
      }
      .email-content {
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .header {
        background: #344E41;
        padding: 15px;
        text-align: center;
        color: #ffffff;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
      }
      .body-text {
        color: #333333;
        line-height: 1.5;
        text-align: center;
      }
      .otp-code {
        font-size: 24px;
        font-weight: bold;
        color: #A3B18A;
        margin: 20px 0;
      }
      .footer {
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #588157;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-content">
        <div class="header">
          <h2>Email Verification OTP</h2>
        </div>
        <div class="body-text">
          <p>Hello,</p>
          <p>Your OTP for email verification is:</p>
          <p class="otp-code">${otp}</p>
          <p>Please enter this code in your app to verify your email. The OTP is valid for 24 hours.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Dayadevraha. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
</html>`,
  };
  return transporter.sendMail(mailOptions);
};

/**
 * Sends a password reset email to a user.
 * @param {string} to - Recipient's email address.
 * @param {string} token - Unique password reset token.
 * @returns {Promise} - Resolves when the email is sent.
 */
export const sendUserResetPasswordEmail = async (to, token) => {
  const resetLink = `http://localhost:3000/en/forgot-password/reset-password?token=${token}`;
  const mailOptions = {
    from: `"No Reply" <${process.env.SMTP_USER}>`,
    to,
    subject: "Reset Your Password - Dayadevraha",
    text: `You requested a password reset. Click the following link to reset your password: ${resetLink}`,
    html: `<html>
  <head>
    <style type="text/css">
      .email-container {
        width: 100%;
        background: #DAD7CD;
        padding: 20px;
        font-family: Arial, sans-serif;
      }
      .email-content {
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .header {
        background: #588157;
        padding: 15px;
        text-align: center;
        color: #ffffff;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
      }
      .body-text {
        color: #333333;
        line-height: 1.5;
        text-align: center;
      }
      .button {
        display: inline-block;
        margin-top: 20px;
        padding: 12px 20px;
        background: #A3B18A;
        color: #ffffff;
        text-decoration: none;
        border-radius: 5px;
        font-weight: bold;
      }
      .footer {
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #588157;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-content">
        <div class="header">
          <h2>Reset Your Password</h2>
        </div>
        <div class="body-text">
          <p>Hello,</p>
          <p>You requested a password reset for your Dayadevraha account.</p>
          <p style="text-align:center;"><a href="${resetLink}" class="button">Reset Password</a></p>
          <p>If the button doesn’t work, please copy and paste the following link into your browser:</p>
          <p>${resetLink}</p>
          <p>If you did not request a password reset, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Dayadevraha. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
</html>`,
  };
  return transporter.sendMail(mailOptions);
};

/**
 * Sends a two-factor authentication OTP email to a user.
 * This OTP is valid for 5 minutes.
 * @param {string} to - Recipient's email address.
 * @param {string} otp - One-time password code.
 * @returns {Promise} - Resolves when the email is sent.
 */
export const sendUserTwoFactorOTPEmail = async (to, otp) => {
  const mailOptions = {
    from: `"No Reply" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your Two-Factor Authentication Code - Dayadevraha",
    text: `Your OTP code is: ${otp}`,
    html: `<html>
  <head>
    <style type="text/css">
      .email-container {
        width: 100%;
        background: #DAD7CD;
        padding: 20px;
        font-family: Arial, sans-serif;
      }
      .email-content {
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .header {
        background: #344E41;
        padding: 15px;
        text-align: center;
        color: #ffffff;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
      }
      .body-text {
        color: #333333;
        line-height: 1.5;
        text-align: center;
      }
      .otp-code {
        font-size: 24px;
        font-weight: bold;
        color: #A3B18A;
        margin: 20px 0;
      }
      .footer {
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #588157;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-content">
        <div class="header">
          <h2>Your OTP Code</h2>
        </div>
        <div class="body-text">
          <p>Hello,</p>
          <p>Your one-time password (OTP) for two-factor authentication is:</p>
          <p class="otp-code">${otp}</p>
          <p>This code is valid for 5 minutes.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Dayadevraha. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
</html>`,
  };
  return transporter.sendMail(mailOptions);
};

/**
 * Sends a donation confirmation email to a user.
 * @param {string} to - Recipient's email address.
 * @param {number|string} amount - Donation amount.
 * @param {string} cowName - Name of the cow (or care) being supported.
 * @returns {Promise} - Resolves when the email is sent.
 */
export const sendDonationConfirmationEmail = async (to, amount, cowName) => {
  const mailOptions = {
    from: `"No Reply" <${process.env.SMTP_USER}>`,
    to,
    subject: "Thank You for Your Donation - Dayadevraha",
    text: `Thank you for donating ₹${amount} to support ${cowName || "our cows"} at Dayadevraha.`,
    html: `<html>
  <head>
    <style type="text/css">
      .email-container {
        width: 100%;
        background: #DAD7CD;
        padding: 20px;
        font-family: Arial, sans-serif;
      }
      .email-content {
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .header {
        background: #A3B18A;
        padding: 15px;
        text-align: center;
        color: #ffffff;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
      }
      .body-text {
        color: #333333;
        line-height: 1.5;
      }
      .footer {
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #588157;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-content">
        <div class="header">
          <h2>Thank You for Your Donation</h2>
        </div>
        <div class="body-text">
          <p>Dear Supporter,</p>
          <p>Thank you for donating ₹${amount} to support ${cowName || "our cows"}.</p>
          <p>Your support means a lot to us and helps in providing care and sustenance to our cows at Dayadevraha.</p>
          <p>If you have any questions, feel free to reply to this email.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Dayadevraha. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
</html>`,
  };
  return transporter.sendMail(mailOptions);
};
