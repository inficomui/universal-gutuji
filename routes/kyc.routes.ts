import express from "express";
import {
  submitKycRequest,
  getMyKycStatus,
  getAllKycRequests,
  approveKycRequest,
  rejectKycRequest,
  getKycRequestDetails
} from "../controllers/kyc.controller.ts";
import { authenticateJWT, adminProtected } from "../middlewares/protected.ts";
import { upload } from "../middlewares/upload.ts";

const router = express.Router();

// User KYC routes (require authentication)
router.use(authenticateJWT);

// Submit KYC request with file uploads
router.post("/submit", upload.fields([
  { name: 'parentImage', maxCount: 1 },
  { name: 'childImage', maxCount: 1 }
]), submitKycRequest);

// Get user's KYC status
router.get("/my-status", getMyKycStatus);

// Admin KYC routes (require admin role)
router.get("/admin/all", ...adminProtected, getAllKycRequests);
router.get("/admin/:kycId", ...adminProtected, getKycRequestDetails);
router.put("/admin/:kycId/approve", ...adminProtected, approveKycRequest);
router.put("/admin/:kycId/reject", ...adminProtected, rejectKycRequest);

export default router;
