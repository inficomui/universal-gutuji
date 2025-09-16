import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

import { User } from "../models/User.ts";
import { sendEmail } from "../utils/email.ts";
import { BVMatchingService } from "../services/bvMatchingService.ts";
const generateToken = (userId: number): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "7d",
  });
};

const generateUsername = (): string => {
  const digits = '0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return result;
};


export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, sponsorId, position } = req.body as {
      name?: string; email?: string; password?: string; sponsorId?: string; position?: string;
    };

    if (!name || !email || !password || typeof password !== "string") {
      res.status(400).json({ message: "name, email, and password are required" });
      return;
    }
    console.log("position", position);
    

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(400).json({ message: "User already exists with this email" });
      return;
    }

    // Check if this is the first user
    const userCount = await User.count();

    if (userCount > 0) {
      // For all users except the first one, sponsorId and position are required
      if (!sponsorId) {
        res.status(400).json({ message: "sponsorId is required for registration" });
        return;
      }
      
      if (!position) {
        res.status(400).json({ message: "position is required for registration (left or right)" });
        return;
      }

      // Validate position
      if (position !== 'left' && position !== 'right') {
        res.status(400).json({ message: "position must be either 'left' or 'right'" });
        return;
      }
      
      const sponsor = await User.findOne({ where: { username: sponsorId } });
      if (!sponsor) {
        res.status(400).json({ message: "Invalid sponsor username" });
        return;
      }

      // Position validation - just ensure it's valid
      if (position !== 'left' && position !== 'right') {
        res.status(400).json({ 
          message: `Position must be either 'left' or 'right'` 
        });
        return;
      }
    }

    // Generate unique username for new user
    let newUsername: string | undefined;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      newUsername = generateUsername();
      const existingUsername = await User.findOne({ where: { username: newUsername } });
      if (!existingUsername) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      res.status(500).json({ message: "Failed to generate unique username" });
      return;
    }

    let user;
    try {
      user = await User.create({
        name,
        email: normalizedEmail,
        password,
        username: newUsername!,
        sponsorId: userCount === 0 ? null : sponsorId, // null for first user, else sponsorId
        position: position as 'left' | 'right' | null,
        isActive: false
      });
    } catch (createError: any) {
      // Handle any other database errors
      console.error("User creation error:", createError);
      throw createError; // Re-throw errors
    }

    // Note: BV distribution will happen after admin accepts user's plan purchase
    // No BV distribution during registration

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        username: user.username,
        sponsorId: user.sponsorId,
        position: user.position
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
// console.log("safe", safe);

    res.json({
      success: true,
      message: "Login successful",
      user: { 
        id: safe.id, 
        name: safe.name, 
        email: safe.email, 
        role: safe.role,
        isActive: safe.isActive,
        username: safe.username,
        position: safe.position,
        sponsorId: safe.sponsorId 
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

// GET /api/auth/my-referrals - Get user's referrals
export const getMyReferrals = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    // console.log("req.user", req.user);
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    // Get current user's username
    const currentUser = await User.findByPk(userId);
    // console.log("currentUser", currentUser);
    if (!currentUser || !currentUser.username) {
      res.status(404).json({ 
        success: false,
        message: "User or username not found" 
      });
      return;
    }

    // Debug: Check what users exist with this sponsorId
    // console.log('Looking for users with sponsorId:', currentUser.username);
    
    // Debug: Check all users and their sponsorIds
    const allUsers = await User.findAll({
      attributes: ['id', 'name', 'username', 'sponsorId'],
      order: [['createdAt', 'DESC']]
    });
    // console.log('All users in database:', allUsers.map(u => ({ id: u.id, name: u.name, username: u.username, sponsorId: u.sponsorId })));
    
    // Find all users referred by this user (sponsorId = current user's username)
   // Get referrals
const referrals = await User.findAll({
  where: { sponsorId: currentUser.username },
  attributes: [
    'id',
    'name',
    'email',
    'username',
    'sponsorId',
    'position',     // ← add this
    'isActive',
    'createdAt',
  ],
  order: [['createdAt', 'DESC']],
})

    // console.log('Found referrals:', referrals.length);
    // console.log('Referrals data:', referrals.map(r => ({ id: r.id, name: r.name, sponsorId: r.sponsorId })));
// console.log("referrals", referrals);

    // Get referral statistics
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(ref => ref.isActive).length;
// console.log("referrals", referrals);

    res.json({
      success: true,
      data: {
        myUsername: currentUser.username,
        totalReferrals,
        activeReferrals,
        inactiveReferrals: totalReferrals - activeReferrals,
        referrals: referrals.map(ref => ({
          id: ref.id,
          name: ref.name,
          email: ref.email,
          username: ref.username,
          sponsorId: ref.sponsorId,
          position: ref.position,
          isActive: ref.isActive,
          joinedAt: ref.createdAt
        }))
      }
    });
  } catch (error: any) {
    console.error("Get referrals error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/auth/profile - Get user profile with live income and match data
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    // Get sponsor information if user was referred by someone
    let sponsorInfo = null;
    if (user.sponsorId) {
      const sponsor = await User.findOne({
        where: { username: user.sponsorId },
        attributes: ['id', 'name', 'email', 'username']
      });
      if (sponsor) {
        sponsorInfo = {
          id: sponsor.id,
          name: sponsor.name,
          email: sponsor.email,
          username: sponsor.username
        };
      }
    }

    // Get user's BV summary for live data
    const bvSummary = await BVMatchingService.getUserBVSummary(userId) || {
      leftBV: 0,
      rightBV: 0,
      carryLeft: 0,
      carryRight: 0,
      totalBV: 0,
      canMatch: false,
      matchableAmount: 0
    };
    
    // Get user's referral tree BV for live referral data
    const referralTreeBV = await BVMatchingService.getUserReferralTreeBV(userId);

    // Get user's referrals count
    const referrals = await User.findAll({
      where: { sponsorId: user.username },
      attributes: ['id', 'name', 'username', 'position', 'isActive', 'createdAt']
    });

    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(ref => ref.isActive).length;

    res.json({
      success: true,
      data: {
        // Basic user info
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        username: user.username,
        sponsorId: user.sponsorId,
        position: user.position,
        createdAt: user.createdAt,
        
        // Sponsor info
        sponsor: sponsorInfo,
        
        // Live income data
        income: {
          totalIncome: Number(user.totalIncome) || 0,
          totalWithdrawals: Number(user.totalWithdrawals) || 0,
          availableBalance: (Number(user.totalIncome) || 0) - (Number(user.totalWithdrawals) || 0),
          totalMatched: Number(user.totalMatched) || 0
        },
        
        // Live BV data
        bv: {
          leftBV: (bvSummary as any).current?.leftBV || (bvSummary as any).leftBV || 0,
          rightBV: (bvSummary as any).current?.rightBV || (bvSummary as any).rightBV || 0,
          carryLeft: (bvSummary as any).current?.carryLeft || (bvSummary as any).carryLeft || 0,
          carryRight: (bvSummary as any).current?.carryRight || (bvSummary as any).carryRight || 0,
          totalBV: (bvSummary as any).total?.leftBV + (bvSummary as any).total?.rightBV || (bvSummary as any).totalBV || 0,
          canMatch: (bvSummary as any).canMatch || false,
          matchableAmount: (bvSummary as any).matchableAmount || 0
        },
        
        // Live referral data
        referrals: {
          total: totalReferrals,
          active: activeReferrals,
          inactive: totalReferrals - activeReferrals,
          leftSide: {
            count: referralTreeBV.leftSide.referralCount,
            totalBV: referralTreeBV.leftSide.totalBV,
            referrals: referralTreeBV.leftSide.referrals
          },
          rightSide: {
            count: referralTreeBV.rightSide.referralCount,
            totalBV: referralTreeBV.rightSide.totalBV,
            referrals: referralTreeBV.rightSide.referrals
          }
        }
      }
    });
  } catch (error: any) {
    console.error("Get user profile error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
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

// Lookup sponsor by username
export const lookupSponsor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;

    if (!username || username.length < 3) {
      res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters long"
      });
      return;
    }

    const sponsor = await User.findOne({
      where: { 
        username: username,
        role: 'user' // Only allow user role as sponsors
      },
      attributes: ['id', 'name', 'email', 'username', 'isActive']
    });

    if (!sponsor) {
      res.status(404).json({
        success: false,
        message: "Sponsor not found"
      });
      return;
    }

    if (!sponsor.isActive) {
      res.status(400).json({
        success: false,
        message: "This sponsor account is inactive"
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: sponsor.id,
        name: sponsor.name,
        email: sponsor.email,
        username: sponsor.username,
        isActive: sponsor.isActive
      }
    });
  } catch (error: any) {
    console.error("Lookup sponsor error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Server error"
    });
  }
};