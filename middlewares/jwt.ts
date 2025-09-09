// auth/jwt.ts
import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export type UserRole = "admin" | "teacher" | "student";
export type JWTPayload = { id: number; role: UserRole };

export function signToken(payload: JWTPayload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not defined");

  
const options: SignOptions = {
  algorithm: "HS256",
  expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as import("ms").StringValue,
};


  return jwt.sign(payload, secret, options);
}

export function verifyToken(token: string): JWTPayload & JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not defined");
  return jwt.verify(token, secret) as JWTPayload & JwtPayload;
}
