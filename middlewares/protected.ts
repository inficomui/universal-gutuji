// src/middleware/auth.ts
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.ts";
// import { User } from "../models/User.ts";

type Role = "client" | "employee" | "admin";

interface JWTPayload {
  userId: number; 
  iat?: number;
  exp?: number;
}


interface JWTPayload { userId: number; iat?: number; exp?: number; }

export const authenticateJWT: RequestHandler = async (req, res, next) => {
  try {
    const header = req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as JWTPayload;

    // 👇 fetch only what you need, as a plain object
    const authUser = await User.findByPk(decoded.userId, {
      attributes: ["id", "role"],
      raw: true,
    });
    // console.log("authUser (plain):", authUser);

    if (!authUser) return res.status(401).json({ message: "Invalid token." });

    // In some DBs tinyint(1) may come back as 0/1; !! ensures boolean
    // if (!authUser.isActive || !Boolean(authUser.isActive)) {
    //   return res.status(403).json({ message: "User is blocked." });
    // }

    // Attach minimal identity to the request
    (req as any).user = {
      userId: authUser.id,
      role: authUser.role as Role,
      isActive: !!authUser.isActive,
    };

    next();
  } catch (err) {
    // console.error(err);
    res.status(401).json({ message: "Invalid token." });
  }
};
/** Generic role guard — use after authenticateJWT */
export const requireRole =
  (...allowed: Role[]): RequestHandler =>
  (req, res, next) => {
    const user = (req as any).user as { role?: Role } | undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (!user.role || !allowed.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

/** Convenience guards */
export const adminProtected = [authenticateJWT, requireRole("admin")] as const;

// Typically allow admins to access employee routes, too
export const employeeProtected = [authenticateJWT, requireRole("employee", "admin")] as const;

// Typically allow admins to access client routes, too
export const clientProtected = [authenticateJWT, requireRole("client", "admin")] as const;

// If you also want to export the misspelled alias used elsewhere:
export const clintProtected = clientProtected;
