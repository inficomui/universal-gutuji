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
 * Wallet model
 * Stores user's earnings and transaction history
 */
export class Wallet extends Model<
  InferAttributes<Wallet>,
  InferCreationAttributes<Wallet>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare balance: number;
  declare totalEarned: number;
  declare totalWithdrawn: number;
  declare lastTransactionAt: CreationOptional<Date | null>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Helper methods
  addAmount(amount: number) {
    this.balance = Number(this.balance) + amount;
    this.totalEarned = Number(this.totalEarned) + amount;
    this.lastTransactionAt = new Date();
  }

  subtractAmount(amount: number) {
    if (Number(this.balance) < amount) {
      throw new Error("Insufficient wallet balance");
    }
    this.balance = Number(this.balance) - amount;
    this.totalWithdrawn = Number(this.totalWithdrawn) + amount;
    this.lastTransactionAt = new Date();
  }

  toJSON() {
    const data = this.get();
    return {
      ...data,
      balance: Number(data.balance),
      totalEarned: Number(data.totalEarned),
      totalWithdrawn: Number(data.totalWithdrawn),
    };
  }
}

const walletAttributes = {
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
    unique: true, // One wallet per user
  },

  balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.0,
    validate: { min: { args: [0], msg: "Balance cannot be negative" } },
  },

  totalEarned: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.0,
    validate: { min: { args: [0], msg: "Total earned cannot be negative" } },
  },

  totalWithdrawn: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.0,
    validate: { min: { args: [0], msg: "Total withdrawn cannot be negative" } },
  },

  lastTransactionAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<Wallet, InferCreationAttributes<Wallet>>;

Wallet.init(walletAttributes, {
  sequelize,
  tableName: "wallets",
  timestamps: true,
  defaultScope: {
    attributes: {
      exclude: [],
    },
  },
  indexes: [
    { name: "idx_wallets_user_id", unique: true, fields: ["userId"] },
    { name: "idx_wallets_balance", fields: ["balance"] },
    { name: "idx_wallets_last_transaction", fields: ["lastTransactionAt"] },
  ],
});

export default Wallet;
