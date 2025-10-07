// src/config/db.js

import mongoose from "mongoose";

/**
 * Establishes a connection to the MongoDB database using Mongoose.
 *
 * Uses `MONGO_URI` from environment and appends '/production' only if ENVIRONMENT is 'production'.
 */
export default async function connectDB() {
  try {
    const isProduction =
      process.env.ENVIRONMENT?.toLowerCase() === "production";
    const mongoUri = isProduction
      ? `${process.env.MONGO_URI}/production`
      : process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("Missing MONGO_URI in environment variables.");
    }

    const conn = await mongoose.connect(mongoUri);

    const envLabel = isProduction ? "Production" : "Development";
    console.log(`✅ MongoDB connected [${envLabel}] → ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
}
