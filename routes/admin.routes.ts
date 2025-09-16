import express from "express";
import {
  getUsers,
  getUserById,
  updateUser,
  blockUser,
  toggleUserStatus,
  deleteUser,
  checkUserIncomeStats,
  checkUserBV,
  getUserStats,
  updateSponsorBonus,
  getSponsorBonus,
  updateTds,
  getTds
} from "../controllers/admin.controller.ts";
import { authenticateJWT } from "@/middlewares/protected.ts";
// import { authenticateJWT } from "../middlewares/jwt.ts";
// import { requireAdmin } from "../middlewares/protected.ts";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateJWT);
// router.use(requireAdmin);

// User Management Routes
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.put("/users/:id/block", blockUser);
router.patch("/users/:id/status", toggleUserStatus);
router.delete("/users/:id", deleteUser);

// User Analysis Routes
router.get("/check-income/:username", checkUserIncomeStats);
router.get("/check-bv/:username", checkUserBV);

// Statistics Routes
router.get("/stats", getUserStats);

// Sponsor Bonus Management Routes
router.get("/sponsor-bonus", getSponsorBonus);
router.put("/sponsor-bonus", updateSponsorBonus);

// TDS Management Routes
router.get("/tds", getTds);
router.put("/tds", updateTds);

export default router;