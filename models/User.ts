import {
    DataTypes,
    Model,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
    type ModelAttributes,
  } from "sequelize";
  import { sequelize } from "../utils/db.ts";
  import bcrypt from "bcryptjs";
  
  /**
   * User roles for Universal Guruji MLM platform
   */
  export const ALLOWED_ROLES = [
    "admin",
    "user",
  ] as const;
  
  export type Role = (typeof ALLOWED_ROLES)[number];

  /**
   * User positions for MLM binary tree
   */
  export const ALLOWED_POSITIONS = [
    "left",
    "right",
  ] as const;
  
  export type Position = (typeof ALLOWED_POSITIONS)[number];
  
  export class User extends Model<
    InferAttributes<User>,
    InferCreationAttributes<User>
  > {
    declare id: CreationOptional<number>;
    declare name: string;
    declare email: string;
    declare phone: CreationOptional<string | null>; // User's phone number
    declare password: string;
    declare role: CreationOptional<Role>;
    declare isActive: CreationOptional<boolean>;
    declare username: CreationOptional<string | null>; // My unique username/ID
    declare sponsorId: CreationOptional<string | null>; // Another person's sponsor ID who referred me
    declare position: CreationOptional<Position | null>; // Position in binary tree (left/right)
  
    // BV matching and income tracking fields
    declare totalWithdrawals: CreationOptional<number>; // Total amount withdrawn by user
    declare totalIncome: CreationOptional<number>; // Total income earned from BV matches
    declare totalMatched: CreationOptional<number>; // Total number of BV matches completed
    
    // KYC verification
    declare kycVerified: CreationOptional<boolean>; // Whether user's KYC is verified
  
    // Password reset / recovery fields
    declare resetOtpHash: CreationOptional<string | null>;
    declare resetOtpExpiry: CreationOptional<Date | null>;
    declare resetOtpAttempts: CreationOptional<number>;
    declare resetTokenHash: CreationOptional<string | null>;
    declare resetTokenExpiry: CreationOptional<Date | null>;
  
    // Timestamps
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
  
    async comparePassword(candidate: string) {
      const hash = this.getDataValue("password");
      if (!hash) return false;
      return bcrypt.compare(candidate, hash);
    }
  
    hasRole(...roles: Role[]) {
      return roles.includes(this.getDataValue("role") as Role);
    }
  
    toJSON() {
      const {
        password,
        resetOtpHash,
        resetTokenHash,
        resetOtpExpiry,
        resetTokenExpiry,
        resetOtpAttempts,
        ...rest
      } = this.get();
      return rest as any;
    }
  }
  
  const userAttributes = {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  
    name: {
      type: DataTypes.STRING(80),
      allowNull: false,
      validate: { notEmpty: { msg: "Name is required" } },
    },
  
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: { name: "uniq_users_email", msg: "Email already in use" },
      validate: { isEmail: { msg: "Invalid email" } },
      set(this: User, val: string) {
        this.setDataValue("email", (val ?? "").trim().toLowerCase());
      },
    },
  
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
      validate: {
        isValidPhone(value: string | null) {
          if (value && !/^[\+]?[1-9][\d]{0,15}$/.test(value)) {
            throw new Error("Invalid phone number format");
          }
        }
      }
    },
  
    password: { type: DataTypes.STRING(255), allowNull: false },
  
    /**
     * Use VARCHAR + validation instead of ENUM so you can add roles later
     * without ALTER ENUM migrations.
     */
    role: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "user",
      validate: {
        isIn: {
          args: [ALLOWED_ROLES as unknown as string[]],
          msg: `Role must be one of: ${ALLOWED_ROLES.join(", ")}`,
        },
      },
    },
  
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    
    username: { 
      type: DataTypes.STRING(20), 
      allowNull: true, 
      defaultValue: null,
      unique: { name: "uniq_users_username", msg: "Username already in use" }
    },
    
    sponsorId: { 
      type: DataTypes.STRING(20), 
      allowNull: true, 
      defaultValue: null
    },

    position: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: null,
      validate: {
        isIn: {
          args: [ALLOWED_POSITIONS as unknown as string[]],
          msg: `Position must be one of: ${ALLOWED_POSITIONS.join(", ")}`,
        },
      },
    },

    /** ---------- BV matching and income tracking fields ---------- **/
    totalWithdrawals: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: { args: [0], msg: "Total withdrawals cannot be negative" }
      }
    },

    totalIncome: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: { args: [0], msg: "Total income cannot be negative" }
      }
    },

    totalMatched: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: "Total matched cannot be negative" }
      }
    },

    /** ---------- KYC verification ---------- **/
    kycVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
  
    /** ---------- Reset / Recovery fields ---------- **/
    resetOtpHash: { type: DataTypes.STRING(128), allowNull: true, defaultValue: null },
    resetOtpExpiry: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    resetOtpAttempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    resetTokenHash: { type: DataTypes.STRING(128), allowNull: true, defaultValue: null },
    resetTokenExpiry: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  
    // TS satisfaction for timestamps
    createdAt: { type: DataTypes.DATE, allowNull: true },
    updatedAt: { type: DataTypes.DATE, allowNull: true },
  } satisfies ModelAttributes<User, InferCreationAttributes<User>>;
  
  User.init(userAttributes, {
    sequelize,
    tableName: "users",
    timestamps: true,
    defaultScope: {
      attributes: {
        exclude: [
          "password",
          "resetOtpHash",
          "resetOtpExpiry",
          "resetOtpAttempts",
          "resetTokenHash",
          "resetTokenExpiry",
        ],
      },
    },
    scopes: {
      withPassword: { attributes: { include: ["password"] } },
      withResetSecrets: {
        attributes: {
          include: [
            "resetOtpHash",
            "resetOtpExpiry",
            "resetOtpAttempts",
            "resetTokenHash",
            "resetTokenExpiry",
          ],
        },
      },
    },
    indexes: [
      { name: "uniq_users_email", unique: true, fields: ["email"] },
      { name: "uniq_users_username", unique: true, fields: ["username"] },
      { name: "idx_users_sponsor_id", fields: ["sponsorId"] },
      { name: "idx_users_position", fields: ["position"] },
      { name: "idx_users_sponsor_position", fields: ["sponsorId", "position"] },
      { name: "idx_users_reset_otp_expiry", fields: ["resetOtpExpiry"] },
      { name: "idx_users_reset_token_expiry", fields: ["resetTokenExpiry"] },
    ],
  });
  
  /** ---------------- Hooks ---------------- **/
  User.beforeCreate(async (user) => {
    const plain = user.getDataValue("password");
    if (!plain) throw new Error("Password is required");
    user.set("password", await bcrypt.hash(plain, 10));
  });
  
  User.beforeUpdate(async (user) => {
    if (user.changed("password")) {
      const plain = user.getDataValue("password");
      if (!plain) throw new Error("Password is required");
      user.set("password", await bcrypt.hash(plain, 10));
    }
  });

  User.afterUpdate(async (user) => {
    // Check if user was just activated (isActive changed from false to true)
    if (user.changed("isActive") && user.isActive === true) {
      // Import here to avoid circular dependency
      const { UserActivationService } = await import("../services/userActivationService.js");
      
      // Trigger BV distribution for newly activated user
      await UserActivationService.handleUserActivation(user.id);
    }
  });
  