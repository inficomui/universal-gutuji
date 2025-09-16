import express from "express";
import * as userPlanController from "../controllers/userPlan.controller.ts";
import { authenticateJWT } from "../middlewares/protected.ts";

const userPlanRoutes = express.Router();

// All routes require authentication
userPlanRoutes.use(authenticateJWT);

// Get user's plan requests
userPlanRoutes.get("/my-requests", userPlanController.getMyPlanRequests);

// Get user's active plans (approved)
userPlanRoutes.get("/my-active-plans", userPlanController.getMyActivePlans);

// Get user's plan statistics
userPlanRoutes.get("/my-stats", userPlanController.getMyPlanStats);

// Create new plan request
userPlanRoutes.post("/create-request", userPlanController.createMyPlanRequest);

// Cancel plan request
userPlanRoutes.put("/cancel-request/:requestId", userPlanController.cancelMyPlanRequest);

export default userPlanRoutes;
