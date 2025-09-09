import express from "express";
import * as planController from "../controllers/plan.controller.ts";
import { authenticateJWT, requireRole } from "../middlewares/protected.ts";

const planRoutes = express.Router();

// Public routes (accessible to all users)
planRoutes.get("/", planController.getAllPlans);
planRoutes.get("/:id", planController.getPlanById);

// Admin-only routes
planRoutes.post("/", 
  authenticateJWT, 
  requireRole("admin"), 
  planController.createPlan
);

planRoutes.put("/:id", 
  authenticateJWT, 
  requireRole("admin"), 
  planController.updatePlan
);

planRoutes.delete("/:id", 
  authenticateJWT, 
  requireRole("admin"), 
  planController.deletePlan
);

planRoutes.patch("/:id/toggle-status", 
  authenticateJWT, 
  requireRole("admin"), 
  planController.togglePlanStatus
);

planRoutes.patch("/:id/toggle-popular", 
  authenticateJWT, 
  requireRole("admin"), 
  planController.togglePlanPopular
);

planRoutes.get("/stats", 
  authenticateJWT, 
  requireRole("admin"), 
  planController.getPlanStats
);

export default planRoutes;
