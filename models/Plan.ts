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
  declare features: CreationOptional<string[]>;
  declare duration: CreationOptional<number | null>; // in days, null for lifetime
  declare maxVideos: CreationOptional<number | null>; // null for unlimited
  declare maxUsers: CreationOptional<number | null>; // null for unlimited
  declare isPopular: CreationOptional<boolean>;
  declare isActive: CreationOptional<boolean>;
  declare status: CreationOptional<PlanStatus>;
  declare sortOrder: CreationOptional<number>;
  declare imageUrl: CreationOptional<string | null>;
  declare videoUrl: CreationOptional<string | null>;
  declare tags: CreationOptional<string[]>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Helper methods
  isLifetime() {
    return this.duration === null;
  }

  hasUnlimitedVideos() {
    return this.maxVideos === null;
  }

  hasUnlimitedUsers() {
    return this.maxUsers === null;
  }

  getDiscountPercentage() {
    if (!this.originalPrice || this.originalPrice <= this.price) return 0;
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }

  toJSON() {
    const data = this.get();
    return {
      ...data,
      discountPercentage: this.getDiscountPercentage(),
      isLifetime: this.isLifetime(),
      hasUnlimitedVideos: this.hasUnlimitedVideos(),
      hasUnlimitedUsers: this.hasUnlimitedUsers(),
    };
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

  features: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    validate: {
      isValidFeatures(value: any) {
        if (!Array.isArray(value)) {
          throw new Error("Features must be an array");
        }
        if (value.length > 20) {
          throw new Error("Maximum 20 features allowed");
        }
        for (const feature of value) {
          if (typeof feature !== "string" || feature.length > 200) {
            throw new Error("Each feature must be a string with max 200 characters");
          }
        }
      },
    },
  },

  duration: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    defaultValue: null,
    validate: { 
      min: { args: [1], msg: "Duration must be at least 1 day" },
      max: { args: [3650], msg: "Duration cannot exceed 10 years" }
    },
  },

  maxVideos: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    defaultValue: null,
    validate: { 
      min: { args: [1], msg: "Max videos must be at least 1" },
      max: { args: [999999], msg: "Max videos too high" }
    },
  },

  maxUsers: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    defaultValue: null,
    validate: { 
      min: { args: [1], msg: "Max users must be at least 1" },
      max: { args: [999999], msg: "Max users too high" }
    },
  },

  isPopular: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
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

  sortOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { 
      min: { args: [0], msg: "Sort order must be non-negative" }
    },
  },

  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
    validate: {
      isUrl: { msg: "Image URL must be a valid URL" },
    },
  },

  videoUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
    validate: {
      isUrl: { msg: "Video URL must be a valid URL" },
    },
  },

  tags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    validate: {
      isValidTags(value: any) {
        if (!Array.isArray(value)) {
          throw new Error("Tags must be an array");
        }
        if (value.length > 10) {
          throw new Error("Maximum 10 tags allowed");
        }
        for (const tag of value) {
          if (typeof tag !== "string" || tag.length > 50) {
            throw new Error("Each tag must be a string with max 50 characters");
          }
        }
      },
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
    order: [["sortOrder", "ASC"], ["createdAt", "DESC"]],
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
    popular: {
      where: {
        isPopular: true,
        isActive: true,
        status: "active",
      },
    },
    withInactive: {
      // No additional where clause - shows all plans
    },
  },
  indexes: [
    { name: "idx_plans_status", fields: ["status"] },
    { name: "idx_plans_is_active", fields: ["isActive"] },
    { name: "idx_plans_is_popular", fields: ["isPopular"] },
    { name: "idx_plans_sort_order", fields: ["sortOrder"] },
    { name: "idx_plans_price", fields: ["price"] },
  ],
});

/** ---------------- Hooks ---------------- **/
Plan.beforeValidate((plan) => {
  // Ensure originalPrice is not less than price
  if (plan.originalPrice && plan.originalPrice < plan.price) {
    plan.originalPrice = plan.price;
  }
  
  // Ensure features is always an array
  if (!Array.isArray(plan.features)) {
    plan.features = [];
  }
  
  // Ensure tags is always an array
  if (!Array.isArray(plan.tags)) {
    plan.tags = [];
  }
});

Plan.beforeCreate(async (plan) => {
  // Set default sort order if not provided
  if (plan.sortOrder === undefined || plan.sortOrder === null) {
    const maxSortOrder = (await Plan.max("sortOrder")) as number || 0;
    plan.sortOrder = maxSortOrder + 1;
  }
});

export default Plan;
