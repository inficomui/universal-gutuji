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
 * BVLogs model
 * Tracks each BV addition event (for audit & matching reference)
 */
export class BVLog extends Model<
  InferAttributes<BVLog>,
  InferCreationAttributes<BVLog>
> {
  declare id: CreationOptional<number>;

  declare userId: number;          // The user who receives the BV
  declare sourceUserId: number;    // The user from whom this BV originates
  declare points: number;          // Amount of BV added

  declare matched: CreationOptional<boolean>; // Whether this BV got matched in a pair

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const bvLogAttributes = {
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

  sourceUserId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: "users", key: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  },


  points: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },

  matched: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<BVLog, InferCreationAttributes<BVLog>>;

BVLog.init(bvLogAttributes, {
  sequelize,
  tableName: "bv_logs",
  timestamps: true,
  indexes: [
    { name: "idx_bv_logs_user_id", fields: ["userId"] },
    { name: "idx_bv_logs_source_user_id", fields: ["sourceUserId"] },
    { name: "idx_bv_logs_matched", fields: ["matched"] },
  ],
});

export default BVLog;