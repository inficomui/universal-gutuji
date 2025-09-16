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
 * Level model for Universal Guruji platform
 * Represents different levels for video content organization
 */
export class Level extends Model<
  InferAttributes<Level>,
  InferCreationAttributes<Level>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare isActive: CreationOptional<boolean>;
  declare testPdf: CreationOptional<string | null>;
  declare certificatePng: CreationOptional<string | null>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const levelAttributes = {
  id: { 
    type: DataTypes.INTEGER.UNSIGNED, 
    autoIncrement: true, 
    primaryKey: true 
  },

  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: { name: "uniq_levels_name", msg: "Level name already exists" },
    validate: { 
      notEmpty: { msg: "Level name is required" },
      len: { args: [2, 100], msg: "Level name must be between 2 and 100 characters" }
    },
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

  testPdf: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  },

  certificatePng: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<Level, InferCreationAttributes<Level>>;

Level.init(levelAttributes, {
  sequelize,
  tableName: "levels",
  timestamps: true,
  defaultScope: {
    where: {
      isActive: true,
    },
    order: [["createdAt", "ASC"]],
  },
  scopes: {
    active: {
      where: {
        isActive: true,
      },
    },
    inactive: {
      where: {
        isActive: false,
      },
    },
    withInactive: {
      // No additional where clause - shows all levels
    },
  },
  indexes: [
    { name: "uniq_levels_name", unique: true, fields: ["name"] },
    { name: "idx_levels_is_active", fields: ["isActive"] },
  ],
});

export default Level;
