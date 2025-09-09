// routes/auth.routes.ts
import express from "express";
import * as authController from "../controllers/auth.controller.ts";
import { authenticateJWT } from "../middlewares/protected.ts";
// import { authenticateJWT } from "../middlewares/protected.ts";

const authRoutes = express.Router();

authRoutes.post("/register", authController.register);
authRoutes.post("/login", authController.login);
authRoutes.post("/forgot-password", authController.forgotPassword);
authRoutes.post("/verify-otp", authController.verifyOtp);
authRoutes.post("/reset-password", authController.resetPassword);

// 🔐 Only for logged-in users
authRoutes.get("/verify", authenticateJWT, authController.verifyToken);
// authRoutes.post("/change-password", authenticateJWT, authController.changePassword);
authRoutes.post("/logout", authenticateJWT, authController.logout);

export default authRoutes;
