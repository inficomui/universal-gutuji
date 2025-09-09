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
 * Plan request status for Universal Guruji MLM platform
 */
export const ALLOWED_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type PlanRequestStatus = (typeof ALLOWED_REQUEST_STATUSES)[number];

export class PlanRequest extends Model<
  InferAttributes<PlanRequest>,
  InferCreationAttributes<PlanRequest>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare planId: number;
  declare status: CreationOptional<PlanRequestStatus>;
  declare paymentMethod: CreationOptional<string | null>;
  declare paymentReference: CreationOptional<string | null>;
  declare amount: number;
  declare currency: CreationOptional<string>;
  declare notes: CreationOptional<string | null>;
  declare approvedBy: CreationOptional<number | null>;
  declare approvedAt: CreationOptional<Date | null>;
  declare rejectionReason: CreationOptional<string | null>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Helper methods
  isPending() {
    return this.status === 'pending';
  }

  isApproved() {
    return this.status === 'approved';
  }

  isRejected() {
    return this.status === 'rejected';
  }

  isCancelled() {
    return this.status === 'cancelled';
  }

  toJSON() {
    const data = this.get();
    return {
      ...data,
      isPending: this.isPending(),
      isApproved: this.isApproved(),
      isRejected: this.isRejected(),
      isCancelled: this.isCancelled(),
    };
  }
}

const planRequestAttributes = {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },

  planId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'plans',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },

  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "pending",
    validate: {
      isIn: {
        args: [ALLOWED_REQUEST_STATUSES as unknown as string[]],
        msg: `Status must be one of: ${ALLOWED_REQUEST_STATUSES.join(", ")}`,
      },
    },
  },

  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
  },

  paymentReference: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  },

  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { 
      min: { args: [0], msg: "Amount must be non-negative" },
      max: { args: [999999.99], msg: "Amount too high" }
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

  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },

  approvedBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    defaultValue: null,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },

  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },

  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<PlanRequest, InferCreationAttributes<PlanRequest>>;

PlanRequest.init(planRequestAttributes, {
  sequelize,
  tableName: "plan_requests",
  timestamps: true,
  defaultScope: {
    order: [["createdAt", "DESC"]],
  },
  scopes: {
    pending: {
      where: {
        status: "pending",
      },
    },
    approved: {
      where: {
        status: "approved",
      },
    },
    rejected: {
      where: {
        status: "rejected",
      },
    },
    cancelled: {
      where: {
        status: "cancelled",
      },
    },
  },
  indexes: [
    { name: "idx_plan_requests_user_id", fields: ["userId"] },
    { name: "idx_plan_requests_plan_id", fields: ["planId"] },
    { name: "idx_plan_requests_status", fields: ["status"] },
    { name: "idx_plan_requests_created_at", fields: ["createdAt"] },
  ],
});

export default PlanRequest;
