// src/middleware/passport.ts
import type { PassportStatic } from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { User } from "../models/User.ts";
// import { User } from "../models/User.ts";
// import { User } from "../models/User.js"; // <-- Sequelize User model

type JWTPayload = {
  userId: number | string; // number for INT PK, string for UUID
  iat?: number;
  exp?: number;
};

export const configurePassport = (passport: PassportStatic): void => {
  // ---- JWT Strategy ----
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET || "your-secret-key",
      },
      async (payload: JWTPayload, done) => {
        try {
          // Find by primary key (works for numeric or UUID)
          const user = await User.findByPk(payload.userId as any, {
            attributes: { exclude: ["password"] }, // do not expose password
          });

          if (!user) return done(null, false);

          // Optional: block inactive users if your model has isActive
          if ((user as any).isActive === false) {
            return done(null, false);
          }

          return done(null, user);
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );

  // ---- Local Strategy (email/password) ----
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        session: false, // JWT-based, no sessions
      },
      async (email, password, done) => {
        try {
          const normalizedEmail = email.toLowerCase().trim();

          const user = await User.findOne({
            where: { email: normalizedEmail },
          });

          if (!user) {
            return done(null, false, { message: "Invalid credentials" });
          }

          // If you added an instance method (e.g., user.comparePassword), use that.
          // Otherwise, compare directly with bcrypt:
          const ok = await bcrypt.compare(password, (user as any).password);
          if (!ok) {
            return done(null, false, { message: "Invalid credentials" });
          }

          // Optional: block inactive users
          if ((user as any).isActive === false) {
            return done(null, false, { message: "User is blocked" });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // If you were using sessions (not typical with JWT), you could add:
  // passport.serializeUser((user: any, done) => done(null, user.id));
  // passport.deserializeUser(async (id: number | string, done) => {
  //   try {
  //     const user = await User.findByPk(id, { attributes: { exclude: ["password"] } });
  //     done(null, user || false);
  //   } catch (err) {
  //     done(err, false);
  //   }
  // });
};
