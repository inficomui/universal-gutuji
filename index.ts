import express,{ type NextFunction, type Request, type Response }  from "express";
import cors from "cors";
import dotenv from "dotenv";
import passport from "passport";
import path from "node:path";


import authRoutes from "./routes/auth.routes.ts";
import videoRoutes from "./routes/video.routes.ts";
import levelRoutes from "./routes/level.routes.ts";
import planRoutes from "./routes/plan.routes.ts";
import planRequestRoutes from "./routes/planRequest.routes.ts";
import paymentRoutes from "./routes/payment.routes.ts";
import pdfRoutes from "./routes/pdf.routes.ts";
import bvRoutes from "./routes/bv.routes.ts";
import adminRoutes from "./routes/admin.routes.ts";
import settingsRoutes from "./routes/settings.routes.ts";
import mlmRoutes from "./routes/mlm.routes.ts";
import userPlanRoutes from "./routes/userPlan.routes.ts";
import kycRoutes from "./routes/kyc.routes.ts";
import withdrawalRoutes from "./routes/withdrawal.routes.ts";
import { configurePassport } from "./middlewares/passport.ts";
import { sequelize } from "./utils/db.ts";
import "./models/User.ts";
import "./models/Video.ts";
import "./models/Level.ts";
import "./models/Plan.ts";
import "./models/PlanRequest.ts";
import "./models/Payment.ts";
import "./models/AdminConfig.ts";
import "./models/associations.ts";




// Load .env
dotenv.config();

// Master data relations

export async function syncModels() {
  await sequelize.sync({ alter: true }); // dev only; use migrations for prod
}



// Init express + socket.io
const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - Development mode (more permissive)
const corsOptions: cors.CorsOptions = {
  origin: "*", // Allow all origins in development
  credentials: true,
 
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));

// Passport
app.use(passport.initialize());
configurePassport(passport);



// Routes
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/levels", levelRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/plan-requests", planRequestRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/bv", bvRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/mlm", mlmRoutes);
app.use("/api/user-plans", userPlanRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/withdrawals", withdrawalRoutes);

// Health check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// CORS test endpoint
app.get("/api/cors-test", (req: Request, res: Response) => {
  res.json({ 
    status: "CORS working", 
    origin: req.headers.origin,
    timestamp: new Date().toISOString() 
  });
});

// Debug CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});
app.use((req, res) => {
  res.status(404).json({ message: "Not Found", path: req.originalUrl });
});
// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// ✅ Sequelize DB Sync (all tables)

(async () => {
  try {
    // 1) connect DB first (uses bootstrap .env)
    await sequelize.authenticate();
    console.log("✅ Database connected successfully");
    
    // 2) sync database - skip alter to avoid MySQL key limit
    await sequelize.sync({ alter: false });
    console.log("📊 Database tables synced");

    // 2) init app config (loads from DB into memory)


    // 3) Now use DB-backed config everywhere:
    const PORT = Number(process.env.PORT) || 5000

    app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));
  } catch (e) {
    console.error("Startup error:", e);
    process.exit(1);
  }
})();