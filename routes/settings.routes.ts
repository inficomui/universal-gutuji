import express from "express";
import { 
  getAdminUPIConfig, 
  updateAdminUPIConfig, 
  getAllAdminConfigs, 
  updateAdminConfig, 
  deleteAdminConfig 
} from "../controllers/settings.controller.ts";
import { verifyToken } from "../middlewares/jwt.ts";
import { adminProtected, authenticateJWT, requireRole } from "../middlewares/protected.ts";

const router = express.Router();

// Public route to get UPI config (users need to see this)
router.get("/upi-config", getAdminUPIConfig);

// Admin routes for configuration management
router.get("/admin/configs", authenticateJWT, requireRole("admin"), getAllAdminConfigs);
router.put("/admin/configs", authenticateJWT, requireRole("admin"), updateAdminConfig);
router.put("/upi-config", authenticateJWT, requireRole("admin"), updateAdminUPIConfig);
router.delete("/admin/configs/:category/:key", authenticateJWT, requireRole("admin"), deleteAdminConfig);

export default router;
