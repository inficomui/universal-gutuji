import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
// import { User } from "../models/User.ts";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();
// import { sendEmail } from "../utils/email.ts";
import { User } from "../models/User.ts";
import { sendEmail } from "../utils/email.ts";
const generateToken = (userId: number): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "7d",
  });
};


  export const register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, email, password } = req.body as {
        name?: string; email?: string; password?: string;
      };

      if (!name || !email || !password || typeof password !== "string") {
        res.status(400).json({ message: "name, email and password are required" });
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = await User.findOne({ where: { email: normalizedEmail } });
      if (existingUser) {
        res.status(400).json({ message: "User already exists with this email" });
        return;
      }

      const user = await User.create({ name, email: normalizedEmail, password });


      const token = generateToken(user.id);
      res.status(201).json({
        success: true,
        message: "User created successfully",
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          isActive: user.isActive 
        },
        token,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  };


// LOGIN
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = (email ?? "").toLowerCase().trim();

    // IMPORTANT: use the scope that includes password
    const user = await User.scope("withPassword").findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

  
    const token = generateToken(user.id);

    // Strip password from output (your toJSON already does this, but being explicit is fine)
    const { password: _omit, ...safe } = user.get({ plain: true });

    res.json({
      success: true,
      message: "Login successful",
      user: { 
        id: safe.id, 
        name: safe.name, 
        email: safe.email, 
        role: safe.role,
        isActive: safe.isActive 
      },
      token,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};



// LOGOUT
export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.json({ 
    success: true,
    message: "Logout successful" 
  });
};



const APP_NAME   = "Exam Portal";


const OTP_TTL_MS = 10 * 60 * 1000;           // 10 minutes
const OTP_MAX_ATTEMPTS = 5;                  // throttle brute force
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;   // 15 minutes

/** Helpers */
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

/** Safe generic response to prevent user enumeration */
const genericOk = { message: "If the email exists, we've sent an OTP with further instructions." };

/** ============== FORGOT PASSWORD (request OTP) ============== */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const email = (req.body?.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Fetch user; do NOT reveal whether it exists.
    const user = await User.findOne({ where: { email } });

    // Always return generic response to avoid enumeration
    if (!user) return res.json(genericOk);

    // Create OTP & store hash only
    const otp = generateOtp();
    user.resetOtpHash = sha256(otp);
    user.resetOtpExpiry = new Date(Date.now() + OTP_TTL_MS);
    user.resetOtpAttempts = 0;
    // Clear any previous reset tokens
    user.resetTokenHash = null;
    user.resetTokenExpiry = null;
    await user.save();

    // Build email
    const subject = `${APP_NAME} Password Reset Code`;
    const text = [
      `Your ${APP_NAME} password reset code is: ${otp}`,
      ``,
      `This code will expire in 10 minutes.`,
      `If you didn’t request this, you can ignore this email.`,
    ].join("\n");

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
        <h2 style="margin:0 0 12px">${APP_NAME} Password Reset</h2>
        <p>We received a request to reset your password. Use the one-time code below:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:4px;padding:16px 12px;border:1px solid #e5e7eb;border-radius:10px;text-align:center;margin:16px 0">
          ${otp}
        </div>
        <p style="margin:0 0 8px">This code expires in <b>10 minutes</b>.</p>
        <p style="color:#6b7280;margin:0 0 16px">If you didn’t request this, no action is needed.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
        <p style="font-size:12px;color:#9ca3af;margin:0">For your security, do not share this code with anyone.</p>
      </div>
    `;

    await sendEmail({ to: email, subject, text, html });

    // Still generic response
    return res.json(genericOk);
  } catch (error: any) {
    console.error("Forgot Password error:", error);
    return res.status(500).json({ message: error?.message || "Server error" });
  }
};

/** ============== VERIFY OTP (issue short-lived reset token) ============== */
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const email = (req.body?.email || "").toLowerCase().trim();
    const otp = (req.body?.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.scope("withResetSecrets").findOne({ where: { email } });

    // To keep responses consistent, use a single error message for invalid/expired
    const invalidMsg = "Invalid or expired OTP";

    if (!user || !user.resetOtpHash || !user.resetOtpExpiry) {
      return res.status(400).json({ message: invalidMsg });
    }

    // Check expiry
    if (user.resetOtpExpiry.getTime() < Date.now()) {
      // Clean up so users can re-request
      user.resetOtpHash = null;
      user.resetOtpExpiry = null;
      user.resetOtpAttempts = 0;
      await user.save();
      return res.status(400).json({ message: invalidMsg });
    }

    // Throttle attempts
    if ((user.resetOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      // Lock this OTP; user must re-request
      user.resetOtpHash = null;
      user.resetOtpExpiry = null;
      await user.save();
      return res.status(429).json({ message: "Too many attempts. Please request a new OTP." });
    }

    // Validate hash
    const isMatch = sha256(otp) === user.resetOtpHash;
    if (!isMatch) {
      user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: invalidMsg });
    }

    // OTP valid — issue a short-lived reset token (not a JWT; just a random secret)
    const resetTokenPlain = randomToken(32);
    user.resetTokenHash = sha256(resetTokenPlain);
    user.resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    // Clear OTP data to prevent reuse
    user.resetOtpHash = null;
    user.resetOtpExpiry = null;
    user.resetOtpAttempts = 0;

    await user.save();

    // Return the plain token to client; client must present it in /resetPassword
    return res.json({
      message: "OTP verified successfully",
      resetToken: resetTokenPlain, // Store it client-side (memory/local storage) for next step
      // Optionally return an expiresAt to guide UI
      expiresAt: user.resetTokenExpiry,
    });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ message: error?.message || "Server error" });
  }
};

/** ============== RESET PASSWORD (requires reset token) ============== */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const email = (req.body?.email || "").toLowerCase().trim();
    const { password, confirmPassword, resetToken } = req.body || {};

    if (!email || !password || !confirmPassword || !resetToken) {
      return res.status(400).json({ message: "Email, resetToken, password and confirmPassword are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const user = await User.scope("withResetSecrets").findOne({ where: { email } });
    if (!user || !user.resetTokenHash || !user.resetTokenExpiry) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    if (user.resetTokenExpiry.getTime() < Date.now()) {
      // token expired, cleanup
      user.resetTokenHash = null;
      user.resetTokenExpiry = null;
      await user.save();
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Validate token
    if (sha256(resetToken) !== user.resetTokenHash) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Set new password — your model hook should hash this automatically
    user.password = password;

    // Clear token
    user.resetTokenHash = null;
    user.resetTokenExpiry = null;

    await user.save();

    return res.json({ message: "Password reset successful" });
  } catch (error: any) {
    console.error("Reset Password error:", error);
    return res.status(500).json({ message: error?.message || "Server error" });
  }
};

// Make sure your authenticateJWT middleware sets req.user = { userId: number }
type AuthenticatedRequest = Request & { user?: { userId: number } };

export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    console.log("user from change password",  userId);
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "currentPassword, newPassword and confirmPassword are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Optional: add your own complexity rules here
    // if (newPassword.length < 8) { ... }

    // Fetch with password
    const user = await User.scope("withPassword").findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "User is blocked, contact support" });
    }

    // Verify current password
    const ok = await user.comparePassword(currentPassword);
    if (!ok) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Prevent reusing the same password
    const sameAsOld = await user.comparePassword(newPassword);
    if (sameAsOld) {
      return res.status(400).json({ message: "New password must be different from the current password" });
    }

    // Set and save — your hooks will hash it
    user.password = newPassword;
    await user.save();

    // If you issue refresh tokens, you may want to revoke them here.

    return res.json({ message: "Password changed successfully" });
  } catch (error: any) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: error?.message || "Server error" });
  }
};

// VERIFY TOKEN
export const verifyToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "Unauthorized" 
      });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(401).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    res.json({
      success: true,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        isActive: user.isActive 
      }
    });
  } catch (error: any) {
    console.error("Verify token error:", error);
    res.status(500).json({ 
      success: false,
      message: error?.message || "Server error" 
    });
  }
};