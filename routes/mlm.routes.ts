import express from "express";
import * as mlmController from "../controllers/mlm.controller.ts";
import { authenticateJWT } from "../middlewares/protected.ts";

const mlmRoutes = express.Router();

// Public routes (no authentication required)
mlmRoutes.get("/check-position", mlmController.checkPositionAvailability);
mlmRoutes.get("/available-positions/:sponsorId", mlmController.getAvailablePositions);

// Protected routes (authentication required)
mlmRoutes.use(authenticateJWT);

// User tree and position routes
mlmRoutes.get("/tree/:userId", mlmController.getUserTree);
mlmRoutes.get("/position/:userId", mlmController.getUserPosition);
mlmRoutes.get("/downline-stats/:userId", mlmController.getUserDownlineStats);

// Referral routes
mlmRoutes.get("/my-referrals", mlmController.getUserReferrals);
mlmRoutes.get("/my-referrals/:position", mlmController.getUserReferralsByPosition);

// Referral tree routes
mlmRoutes.get("/referral-tree", mlmController.getReferralTree);
mlmRoutes.get("/referral-details/:referralId", mlmController.getReferralDetails);

// Admin routes (additional authentication for admin users)
mlmRoutes.get("/users", mlmController.getAllUsersWithSponsors);

export default mlmRoutes;
