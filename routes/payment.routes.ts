import express from "express";
import { 
  createPayment, 
  getUserPayments, 
  getAllPayments, 
  updatePaymentStatus, 
  getPaymentStats 
} from "../controllers/payment.controller.ts";
import { adminProtected, authenticateJWT } from "../middlewares/protected.ts";
// import { authenticateToken } from "../middlewares/jwt.ts";
// import { requireAdmin } from "../middlewares/protected.ts";

const router = express.Router();

// User routes (require authentication)
router.post("/",  createPayment);
router.get("/my-payments",  getUserPayments);

// Admin routes (require authentication + admin role)
router.get("/admin/all", authenticateJWT, getAllPayments);
router.put("/admin/:paymentId/status", authenticateJWT, updatePaymentStatus);
router.get("/admin/stats", authenticateJWT,  getPaymentStats);

export default router;
