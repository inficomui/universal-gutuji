import express from "express";
import { 
  createPayment, 
  getUserPayments, 
  getAllPayments, 
  updatePaymentStatus, 
  getPaymentStats,
  getUserWallet,
  getWalletTransactions,
  getWalletTransactionSummary,
  createWithdrawal,
  getUserWithdrawals,
  updateWithdrawalStatus
} from "../controllers/payment.controller.ts";
import { adminProtected, authenticateJWT } from "../middlewares/protected.ts";
// import { authenticateToken } from "../middlewares/jwt.ts";
// import { requireAdmin } from "../middlewares/protected.ts";

const router = express.Router();

// User routes (require authentication)
router.post("/", authenticateJWT, createPayment);
router.get("/my-payments",  getUserPayments);

// Wallet routes
router.get("/wallet", authenticateJWT, getUserWallet);
router.get("/wallet/transactions", authenticateJWT, getWalletTransactions);
router.get("/wallet/transactions/summary", authenticateJWT, getWalletTransactionSummary);

// Withdrawal routes
router.post("/withdrawals", authenticateJWT, createWithdrawal);
router.get("/withdrawals", authenticateJWT, getUserWithdrawals);

// Admin routes (require authentication + admin role)
router.get("/admin/all", authenticateJWT, getAllPayments);
router.put("/admin/:paymentId/status", authenticateJWT, updatePaymentStatus);
router.get("/admin/stats", authenticateJWT,  getPaymentStats);
router.put("/admin/withdrawals/:withdrawalId/status", authenticateJWT, updateWithdrawalStatus);

export default router;
