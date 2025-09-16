import express from "express";
import * as levelController from "../controllers/level.controller.ts";
import { authenticateJWT, requireRole } from "../middlewares/protected.ts";
import { uploadMixed } from "../middlewares/upload.ts";

const levelRoutes = express.Router();

// Public routes (accessible to all authenticated users)
levelRoutes.get("/", levelController.getAllLevels);
levelRoutes.get("/active", levelController.getActiveLevels);
levelRoutes.get("/:id", levelController.getLevelById);
levelRoutes.get("/:id/videos", levelController.getVideosByLevel);

// Admin-only routes
levelRoutes.post("/", 
  authenticateJWT, 
  requireRole("admin"),
  uploadMixed.fields([
    { name: 'testPdf', maxCount: 1 },
    { name: 'certificatePng', maxCount: 1 }
  ]),
  levelController.createLevel
);

levelRoutes.put("/:id", 
  authenticateJWT, 
  requireRole("admin"), 
  levelController.updateLevel
);

levelRoutes.delete("/:id", 
  authenticateJWT, 
  requireRole("admin"), 
  levelController.deleteLevel
);

export default levelRoutes;
