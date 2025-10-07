// src/app.js

// Import external modules
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

// Import route modules which provide user and admin API endpoints
import { cowPujaWebhook } from "./controllers/cow-puja/clientController.js";
import { paymentWebhook } from "./controllers/paymentController.js";
import cowPujaRoutes from "./routes/cowPujaRoutes.js";
import cowRoutes from "./routes/cowRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import userExtraRoutes from "./routes/userExtraRoutes.js";
import userRoutes from "./routes/userRoutes.js";

// Load environment variables from .env file
dotenv.config();

const app = express();

// Set up basic configuration with defaults:
// CLIENT_PORT for client origin, and API_VERSION for route versioning.
const API_VERSION = process.env.API_VERSION || "1";

// Enable CORS for requests from the client origin, allowing credentials.
const allowedOrigins = process.env.CLIENT_URL.split(",").map((url) =>
  url.trim(),
);
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
  }),
);

// Let's express-rate-limiter trust proxies
app.set("trust proxy", 1);

// Secure HTTP headers with Helmet.
app.use(helmet());

// Log incoming HTTP requests for debugging and monitoring with Morgan.
app.use(morgan("combined"));

// Parse cookie payloads
app.use(cookieParser());

// Razorpay Route (must use raw body for signature verification)
app.post(
  `/api/v${API_VERSION}/payments/webhook`,
  bodyParser.raw({ type: "application/json" }),
  paymentWebhook,
);

app.post(
  `/api/v${API_VERSION}/cow-puja/webhook`,
  bodyParser.raw({ type: "*/*" }),
  cowPujaWebhook,
);

// Parse JSON payloads, URL-encoded form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Mount routes with dynamic API versioning.
// User Routes: typically include login, registration etc.
// The actual base path is defined within the userRoutes module.
app.use(userRoutes(API_VERSION));
app.use(userExtraRoutes(API_VERSION));

// Other routes
app.use(`/api/v${API_VERSION}/cows`, cowRoutes);
app.use(`/api/v${API_VERSION}/donations`, donationRoutes);
app.use(`/api/v${API_VERSION}/payments`, paymentRoutes);
app.use(`/api/v${API_VERSION}/cow-puja`, cowPujaRoutes);

// Health Check Route:
// GET / returns a simple message to verify that the server is running.
app.get("/", (req, res) => {
  res.send("Welcome to the Authentication API");
});

export default app;
