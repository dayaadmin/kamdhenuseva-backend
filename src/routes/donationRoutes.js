// src/routes/donationRoutes.js

import { Router } from "express";

import {
  getDonationHistory,
  getCowDonations,
  getAshramDonations,
} from "../controllers/donationController.js";
import { userProtect } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/my", userProtect, getDonationHistory);
router.get("/my/cows", userProtect, getCowDonations);
router.get("/my/ashram", userProtect, getAshramDonations);

export default router;
