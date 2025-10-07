// src/utils/resendMailer.js

import dotenv from "dotenv";
import { Resend } from "resend";

// Load environment variables from .env
dotenv.config();

// Ensure API key is present
if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not defined in environment variables");
}

// Create and export Resend instance
export const resend = new Resend(process.env.RESEND_API_KEY);
