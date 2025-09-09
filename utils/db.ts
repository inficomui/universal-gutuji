import { Sequelize } from "sequelize";
import dotenv from "dotenv"
dotenv.config()
console.log("process.env.DB_NAME:", process.env.DB_NAME);

export const sequelize = new Sequelize(
  process.env.DB_NAME || "exam_portal",
  process.env.DB_USER || "root",
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
    logging: false,
  }
);

// Test connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
  }
})();
