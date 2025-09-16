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
 * Transaction statuses
 */
export const TRANSACTION_STATUSES = [
  "pending",
  "completed",
  "failed",
  "cancelled"
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/**
 * Transaction types for wallet
 */
export const WALLET_TRANSACTION_TYPES = [
  "bv_match",
  "withdrawal",
  "refund",
  "bonus",
  "commission"
] as const;

export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

/**
 * WalletTransaction model
 * Stores individual wallet transactions
 */
export class WalletTransaction extends Model<
  InferAttributes<WalletTransaction>,
  InferCreationAttributes<WalletTransaction>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare type: WalletTransactionType;
  declare amount: number;
  declare balanceBefore: number;
  declare balanceAfter: number;
  declare status: TransactionStatus;
  declare description: string;
  declare referenceId: CreationOptional<string | null>; // Reference to payment, withdrawal, etc.
  declare metadata: CreationOptional<Record<string, any> | null>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toJSON() {
    const data = this.get();
    return {
      ...data,
      amount: Number(data.amount),
      balanceBefore: Number(data.balanceBefore),
      balanceAfter: Number(data.balanceAfter),
    };
  }
}

const walletTransactionAttributes = {
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

  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: {
        args: [WALLET_TRANSACTION_TYPES as unknown as string[]],
        msg: `Type must be one of: ${WALLET_TRANSACTION_TYPES.join(", ")}`,
      },
    },
  },

  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: { 
      min: { args: [0.01], msg: "Amount must be greater than 0" },
      max: { args: [999999.99], msg: "Amount too high" }
    },
  },

  balanceBefore: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: { min: { args: [0], msg: "Balance before cannot be negative" } },
  },

  balanceAfter: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: { min: { args: [0], msg: "Balance after cannot be negative" } },
  },

  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "completed",
    validate: {
      isIn: {
        args: [TRANSACTION_STATUSES as unknown as string[]],
        msg: `Status must be one of: ${TRANSACTION_STATUSES.join(", ")}`,
      },
    },
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { notEmpty: { msg: "Description is required" } },
  },

  referenceId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
  },

  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<WalletTransaction, InferCreationAttributes<WalletTransaction>>;

WalletTransaction.init(walletTransactionAttributes, {
  sequelize,
  tableName: "wallet_transactions",
  timestamps: true,
  defaultScope: {
    order: [["createdAt", "DESC"]],
  },
  scopes: {
    byType: (type: WalletTransactionType) => ({
      where: { type }
    }),
    byStatus: (status: TransactionStatus) => ({
      where: { status }
    }),
    byUser: (userId: number) => ({
      where: { userId }
    }),
  },
  indexes: [
    { name: "idx_wallet_transactions_user_id", fields: ["userId"] },
    { name: "idx_wallet_transactions_type", fields: ["type"] },
    { name: "idx_wallet_transactions_status", fields: ["status"] },
    { name: "idx_wallet_transactions_reference", fields: ["referenceId"] },
    { name: "idx_wallet_transactions_created_at", fields: ["createdAt"] },
  ],
});

export default WalletTransaction;
