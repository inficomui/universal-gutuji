import express from "express";
import {
  getMyBV,
  getMyBVTree,
  getUserBV,
  getUserBVTree,
  getBVStats,
  getBVLogsUser
} from "../controllers/bv.controller.ts";
import { authenticateJWT } from "../middlewares/protected.ts";

const router = express.Router();

// All BV routes require authentication
router.use(authenticateJWT);

// BV Management Routes
router.get("/my-bv", getMyBV);
router.get("/my-bv-tree", getMyBVTree);
router.get("/user-bv/:username", getUserBV);
router.get("/user-bv-tree/:username", getUserBVTree);
router.get("/stats", getBVStats);
router.get("/my-bv-logs", getBVLogsUser);

export default router;