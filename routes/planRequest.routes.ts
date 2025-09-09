import express from "express";
import * as planRequestController from "../controllers/planRequest.controller.ts";
import { authenticateJWT, requireRole } from "../middlewares/protected.ts";

const planRequestRoutes = express.Router();

// User routes
planRequestRoutes.post("/", 
  authenticateJWT, 
  planRequestController.createPlanRequest
);

planRequestRoutes.get("/user/:userId", 
  authenticateJWT, 
  planRequestController.getUserPlanRequests
);

planRequestRoutes.delete("/:id", 
  authenticateJWT, 
  planRequestController.cancelPlanRequest
);

// Admin routes
planRequestRoutes.get("/", 
  authenticateJWT, 
  requireRole("admin"), 
  planRequestController.getAllPlanRequests
);

planRequestRoutes.put("/:id/approve", 
  authenticateJWT, 
  requireRole("admin"), 
  planRequestController.approvePlanRequest
);

planRequestRoutes.put("/:id/reject", 
  authenticateJWT, 
  requireRole("admin"), 
  planRequestController.rejectPlanRequest
);

planRequestRoutes.get("/stats", 
  authenticateJWT, 
  requireRole("admin"), 
  planRequestController.getPlanRequestStats
);

export default planRequestRoutes;
