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
 * UserBV model
 * Stores accumulated Business Volume (BV) for left/right sides
 */
export class UserBV extends Model<
  InferAttributes<UserBV>,
  InferCreationAttributes<UserBV>
> {
  declare id: CreationOptional<number>;
  declare userId: number;

  declare leftBV: CreationOptional<number>;
  declare rightBV: CreationOptional<number>;
  declare carryLeft: CreationOptional<number>;
  declare carryRight: CreationOptional<number>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const userBVAttributes = {
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

  leftBV: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.0,
  },

  rightBV: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.0,
  },

  carryLeft: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.0,
  },

  carryRight: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.0,
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<UserBV, InferCreationAttributes<UserBV>>;

UserBV.init(userBVAttributes, {
  sequelize,
  tableName: "user_bv",
  timestamps: true,
  defaultScope: {
    attributes: {
      exclude: [],
    },
  },
  indexes: [
    { name: "idx_user_bv_user_id", unique: true, fields: ["userId"] }, // one row per user
  ],
});

export default UserBV;