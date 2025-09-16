import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type ModelAttributes,
} from "sequelize";
import { sequelize } from "../utils/db.ts";

export class AdminConfig extends Model<
  InferAttributes<AdminConfig>,
  InferCreationAttributes<AdminConfig>
> {
  declare id: CreationOptional<number>;
  declare key: string;
  declare value: string;
  declare description: CreationOptional<string | null>;
  declare category: CreationOptional<string>;
  declare isActive: CreationOptional<boolean>;
  declare sponsorBonus: CreationOptional<number>;
  declare tds: CreationOptional<number>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Helper methods
  getValueAsObject() {
    try {
      return JSON.parse(this.value);
    } catch {
      return this.value;
    }
  }

  setValueFromObject(obj: any) {
    this.value = JSON.stringify(obj);
  }

  toJSON() {
    const data = this.get();
    return {
      ...data,
      parsedValue: this.getValueAsObject(),
    };
  }
}

const adminConfigAttributes = {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: { 
      notEmpty: { msg: "Config key is required" },
      len: { args: [2, 100], msg: "Config key must be between 2 and 100 characters" }
    },
  },

  value: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { 
      notEmpty: { msg: "Config value is required" }
    },
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },

  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: "general",
    validate: {
      isIn: {
        args: [["general", "payment", "email", "system", "ui"]],
        msg: "Category must be one of: general, payment, email, system, ui",
      },
    },
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

  sponsorBonus: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 500.00,
    validate: {
      min: { args: [0], msg: "Sponsor bonus must be a positive number" }
    },
  },

  tds: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 5.00,
    validate: {
      min: { args: [0], msg: "TDS must be a positive number" },
      max: { args: [100], msg: "TDS cannot exceed 100%" }
    },
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<AdminConfig, InferCreationAttributes<AdminConfig>>;

AdminConfig.init(adminConfigAttributes, {
  sequelize,
  tableName: "admin_configs",
  timestamps: true,
  defaultScope: {
    where: {
      isActive: true,
    },
    order: [["category", "ASC"], ["key", "ASC"]],
  },
  scopes: {
    byCategory: (category: string) => ({
      where: { category },
    }),
    payment: {
      where: { category: "payment" },
    },
    email: {
      where: { category: "email" },
    },
    system: {
      where: { category: "system" },
    },
    ui: {
      where: { category: "ui" },
    },
  },
  indexes: [
    { name: "idx_admin_config_key", fields: ["key"], unique: true },
    { name: "idx_admin_config_category", fields: ["category"] },
    { name: "idx_admin_config_active", fields: ["isActive"] },
  ],
});

/** ---------------- Hooks ---------------- **/
AdminConfig.beforeValidate((config) => {
  // Ensure key is lowercase and kebab-case
  if (config.key) {
    config.key = config.key.toLowerCase().replace(/\s+/g, '-');
  }
});

export default AdminConfig;


