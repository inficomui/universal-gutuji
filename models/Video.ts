import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type ModelAttributes,
} from "sequelize";
import { sequelize } from "../utils/db.ts";

export class Video extends Model<
  InferAttributes<Video>,
  InferCreationAttributes<Video>
> {
  declare id: CreationOptional<number>;
  declare key: string;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare path: CreationOptional<string | null>;
  declare testPdf: CreationOptional<string | null>;
  declare levelId: CreationOptional<number | null>;

  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toJSON() {
    const { ...rest } = this.get();
    return rest as any;
  }
}

const videoAttributes = {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: { name: "uniq_videos_key", msg: "Video key already exists" },
    validate: { notEmpty: { msg: "Video key is required" } },
  },

  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { notEmpty: { msg: "Video title is required" } },
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },

  isActive: { 
    type: DataTypes.BOOLEAN, 
    allowNull: false, 
    defaultValue: true 
  },
  path: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
    validate: {
      len: {
        args: [0, 500],
        msg: "Path can be up to 500 characters long",
      },
    },
  },
  testPdf: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
    validate: {
      len: {
        args: [0, 500],
        msg: "Test PDF path can be up to 500 characters long",
      },
    },
  },

  levelId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    defaultValue: null,
    references: {
      model: 'levels',
      key: 'id',
    },
    validate: {
      isInt: { msg: "Level ID must be a valid integer" },
      min: { args: [1], msg: "Level ID must be positive" },
    },
  },
  
  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<Video, InferCreationAttributes<Video>>;

Video.init(videoAttributes, {
  sequelize,
  tableName: "videos",
  timestamps: true,
  indexes: [
    { name: "uniq_videos_key", unique: true, fields: ["key"] },
    { name: "idx_videos_is_active", fields: ["isActive"] },
    { name: "idx_videos_level_id", fields: ["levelId"] },
  ],
});
