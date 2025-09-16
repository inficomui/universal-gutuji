import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type ModelAttributes,
} from "sequelize";
import { sequelize } from "../utils/db.ts";

/**
 * Plan status for Universal Guruji MLM platform
 */
export const ALLOWED_STATUSES = [
  "active",
  "inactive",
  "draft",
] as const;

export type PlanStatus = (typeof ALLOWED_STATUSES)[number];

export class Plan extends Model<
  InferAttributes<Plan>,
  InferCreationAttributes<Plan>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare description: string;
  declare price: number;
  declare originalPrice: CreationOptional<number | null>;
  declare currency: CreationOptional<string>;
 
  declare isActive: CreationOptional<boolean>;
  declare status: CreationOptional<PlanStatus>;
  declare bvValue: CreationOptional<number>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;




  getDiscountPercentage() {
    if (!this.originalPrice || this.originalPrice <= this.price) return 0;
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }

  

}

const planAttributes = {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { 
      notEmpty: { msg: "Plan name is required" },
      len: { args: [2, 100], msg: "Plan name must be between 2 and 100 characters" }
    },
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { 
      notEmpty: { msg: "Plan description is required" },
      len: { args: [10, 1000], msg: "Plan description must be between 10 and 1000 characters" }
    },
  },

  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { 
      min: { args: [0], msg: "Price must be non-negative" },
      max: { args: [999999.99], msg: "Price too high" }
    },
  },

  originalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: null,
    validate: { 
      min: { args: [0], msg: "Original price must be non-negative" },
      max: { args: [999999.99], msg: "Original price too high" }
    },
  },

  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: "INR",
    validate: {
      isIn: {
        args: [["INR", "USD", "EUR", "GBP"]],
        msg: "Currency must be INR, USD, EUR, or GBP",
      },
    },
  },




  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "draft",
    validate: {
      isIn: {
        args: [ALLOWED_STATUSES as unknown as string[]],
        msg: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
      },
    },
  },



  bvValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    validate: { 
      min: { args: [0], msg: "BV value must be non-negative" },
      max: { args: [999999.99], msg: "BV value too high" }
    },
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<Plan, InferCreationAttributes<Plan>>;

Plan.init(planAttributes, {
  sequelize,
  tableName: "plans",
  timestamps: true,
  defaultScope: {
    where: {
      isActive: true,
    },
    order: [["createdAt", "DESC"]],
  },
  scopes: {
    active: {
      where: {
        isActive: true,
        status: "active",
      },
    },
    inactive: {
      where: {
        isActive: false,
      },
    },
    draft: {
      where: {
        status: "draft",
      },
    },
    withInactive: {
      // No additional where clause - shows all plans
    },
  },
  indexes: [
    { name: "idx_plans_status", fields: ["status"] },
    { name: "idx_plans_is_active", fields: ["isActive"] },
    { name: "idx_plans_price", fields: ["price"] },
  ],
});

/** ---------------- Hooks ---------------- **/
Plan.beforeValidate((plan) => {
  // Ensure originalPrice is not less than price
  if (plan.originalPrice && plan.originalPrice < plan.price) {
    plan.originalPrice = plan.price;
  }
  
  
});


export default Plan;
