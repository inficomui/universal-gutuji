import express from "express";
import * as videoController from "../controllers/video.controller.ts";
import { authenticateJWT, requireRole } from "../middlewares/protected.ts";
import { uploadMixed } from "../middlewares/upload.ts";

const videoRoutes = express.Router();

// Public routes (accessible to all authenticated users)
videoRoutes.get("/", videoController.getAllVideos);
videoRoutes.get("/:id", videoController.getVideoById);
videoRoutes.get("/:id/stream", videoController.streamVideo);

// Admin-only routes
videoRoutes.post("/", 
  authenticateJWT, 
  requireRole("admin"), 
  uploadMixed.fields([
    { name: 'video', maxCount: 1 },
    { name: 'testPdf', maxCount: 1 }
  ]), 
  videoController.createVideo
);

videoRoutes.put("/:id", 
  authenticateJWT, 
  requireRole("admin"), 
  uploadMixed.fields([
    { name: 'video', maxCount: 1 },
    { name: 'testPdf', maxCount: 1 }
  ]), 
  videoController.updateVideo
);

videoRoutes.delete("/:id", 
  authenticateJWT, 
  requireRole("admin"), 
  videoController.deleteVideo
);

export default videoRoutes;
