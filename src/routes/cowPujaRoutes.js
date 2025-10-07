// src/routes/cowPujaRoutes.js
import express from "express";

import {
  createCowPujaOrder,
  verifyCowPujaPayment,
  markCowPujaOrderFailed,
  listMyCowPujaOrders,
  getMyCowPujaOrder,
  abortCowPujaOrder,
} from "../controllers/cow-puja/clientController.js";
import { userProtect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Authenticated JSON endpoints
router.post("/orders", userProtect, createCowPujaOrder);
router.post("/verify", userProtect, verifyCowPujaPayment);
router.post("/mark-failed", userProtect, markCowPujaOrderFailed);

router.get("/my/orders", userProtect, listMyCowPujaOrders);
router.post("/orders/:orderId/abort", userProtect, abortCowPujaOrder);
router.get("/my/orders/:id", userProtect, getMyCowPujaOrder);

export default router;
