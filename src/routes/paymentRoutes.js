// src/routes/paymentRoutes.js

import { Router } from "express";

import { createOneTimeDonation } from "../controllers/paymentController.js";
import { markDonationAsFailed } from "../controllers/paymentController.js";
import { userProtect } from "../middlewares/authMiddleware.js";

const router = Router();

// Donation route (One-time only)
router.post("/donate", userProtect, createOneTimeDonation);

// Mark donation as failed
router.post("/mark-failed", userProtect, markDonationAsFailed);

export default router;
