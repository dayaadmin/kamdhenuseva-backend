import { Router } from "express";

import {
  getCows,
  getCowById,
  getCowByParam,
} from "../controllers/cowController.js";

const router = Router();

// GET /cows
router.get("/", getCows);

// GET /cows/:id  (supports both cowId and _id)
router.get("/:id", getCowByParam);

// Optional legacy endpoint if needed
router.get("/cowByCowId/:id", getCowById);

export default router;
