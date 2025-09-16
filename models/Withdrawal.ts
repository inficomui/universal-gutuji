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
 * Withdrawal statuses
 */
export const WITHDRAWAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "processing",
  "completed",
  "failed"
] as const;

export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

/**
 * Withdrawal methods
 */
export const WITHDRAWAL_METHODS = [
  "bank_transfer",
  "upi",
  "paytm",
  "phonepe",
  "google_pay"
] as const;

export type WithdrawalMethod = (typeof WITHDRAWAL_METHODS)[number];

/**
 * Withdrawal model
 * Stores withdrawal requests and their status
 */
export class Withdrawal extends Model<
  InferAttributes<Withdrawal>,
  InferCreationAttributes<Withdrawal>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare amount: number;
  declare method: WithdrawalMethod;
  declare accountDetails: Record<string, any>; // Bank details, UPI ID, etc.
  declare status: WithdrawalStatus;
  declare adminNotes: CreationOptional<string | null>;
  declare processedAt: CreationOptional<Date | null>;
  declare transactionId: CreationOptional<string | null>; // External transaction reference

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

  isCompleted() {
    return this.status === 'completed';
  }

  toJSON() {
    const data = this.get();
    return {
      ...data,
      amount: Number(data.amount),
      isPending: this.isPending(),
      isApproved: this.isApproved(),
      isRejected: this.isRejected(),
      isCompleted: this.isCompleted(),
    };
  }
}

const withdrawalAttributes = {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: "users", key: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  },

  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: { 
      min: { args: [100], msg: "Minimum withdrawal amount is ₹100" },
      max: { args: [100000], msg: "Maximum withdrawal amount is ₹1,00,000" }
    },
  },

  method: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: {
        args: [WITHDRAWAL_METHODS as unknown as string[]],
        msg: `Method must be one of: ${WITHDRAWAL_METHODS.join(", ")}`,
      },
    },
  },

  accountDetails: {
    type: DataTypes.JSON,
    allowNull: false,
    validate: {
      isValidAccountDetails(value: Record<string, any>) {
        if (!value || typeof value !== 'object') {
          throw new Error('Account details must be a valid object');
        }
        
        // Basic validation - method-specific validation moved to controller
        if (!value.accountNumber && !value.upiId) {
          throw new Error('Account details must include either account number or UPI ID');
        }
      }
    }
  },

  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "pending",
    validate: {
      isIn: {
        args: [WITHDRAWAL_STATUSES as unknown as string[]],
        msg: `Status must be one of: ${WITHDRAWAL_STATUSES.join(", ")}`,
      },
    },
  },

  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },

  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },

  transactionId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<Withdrawal, InferCreationAttributes<Withdrawal>>;

Withdrawal.init(withdrawalAttributes, {
  sequelize,
  tableName: "withdrawals",
  timestamps: true,
  defaultScope: {
    order: [["createdAt", "DESC"]],
  },
  scopes: {
    pending: {
      where: { status: "pending" }
    },
    approved: {
      where: { status: "approved" }
    },
    rejected: {
      where: { status: "rejected" }
    },
    completed: {
      where: { status: "completed" }
    },
    byUser: (userId: number) => ({
      where: { userId }
    }),
  },
  indexes: [
    { name: "idx_withdrawals_user_id", fields: ["userId"] },
    { name: "idx_withdrawals_status", fields: ["status"] },
    { name: "idx_withdrawals_method", fields: ["method"] },
    { name: "idx_withdrawals_amount", fields: ["amount"] },
    { name: "idx_withdrawals_created_at", fields: ["createdAt"] },
  ],
});

export default Withdrawal;
