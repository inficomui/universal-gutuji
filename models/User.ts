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
  
  export class User extends Model<
    InferAttributes<User>,
    InferCreationAttributes<User>
  > {
    declare id: CreationOptional<number>;
    declare name: string;
    declare email: string;
    declare password: string;
    declare role: CreationOptional<Role>;
    declare isActive: CreationOptional<boolean>;
  
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
  