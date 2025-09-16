import express from "express";
import { 
  requestWithdrawal,
  getMyWithdrawals,
  getWithdrawalBalance,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  completeWithdrawal,
  getWithdrawalStats
} from "../controllers/withdrawal.controller.ts";
import { authenticateJWT, adminProtected } from "../middlewares/protected.ts";

const router = express.Router();

// User routes (require authentication)
router.post("/request", authenticateJWT, requestWithdrawal);
router.get("/my-withdrawals", authenticateJWT, getMyWithdrawals);
router.get("/balance", authenticateJWT, getWithdrawalBalance);

// Admin routes (require admin authentication)
router.get("/admin/all", ...adminProtected, getAllWithdrawals);
router.get("/admin/stats", ...adminProtected, getWithdrawalStats);
router.put("/admin/:withdrawalId/approve", ...adminProtected, approveWithdrawal);
router.put("/admin/:withdrawalId/reject", ...adminProtected, rejectWithdrawal);
router.put("/admin/:withdrawalId/complete", ...adminProtected, completeWithdrawal);

export default router;
