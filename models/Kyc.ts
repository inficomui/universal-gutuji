import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ModelAttributes,
} from "sequelize";
import { sequelize } from "../utils/db.ts";

export class Kyc extends Model<
  InferAttributes<Kyc>,
  InferCreationAttributes<Kyc>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  
  // KYC Documents (at least one required)
  declare panNumber: CreationOptional<string | null>;
  declare aadhaarNumber: CreationOptional<string | null>;
  
  // Bank Details
  declare accountNumber: string;
  declare ifscCode: string;
  declare bankName: string;
  declare accountHolderName: string;
  
  // Address Details
  declare address: CreationOptional<string | null>;
  declare pincode: CreationOptional<string | null>;
  
  // Document Images
  declare parentImage: CreationOptional<string | null>;
  declare childImage: CreationOptional<string | null>;
  
  // Status
  declare status: CreationOptional<'pending' | 'approved' | 'rejected'>;
  declare rejectionReason: CreationOptional<string | null>;
  
  // Admin who processed
  declare processedBy: CreationOptional<number | null>;
  declare processedAt: CreationOptional<Date | null>;
  
  // Associations
  declare user?: any;
  declare processedByUser?: any;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const kycAttributes = {
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
  
  panNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    validate: {
      is: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, // PAN format validation
    },
  },
  
  aadhaarNumber: {
    type: DataTypes.STRING(12),
    allowNull: true,
    unique: true,
    validate: {
      is: /^[0-9]{12}$/, // Aadhaar format validation
    },
  },
  
  accountNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  
  ifscCode: {
    type: DataTypes.STRING(11),
    allowNull: false,
    validate: {
      is: /^[A-Z]{4}0[A-Z0-9]{6}$/i, // IFSC format validation
    },
  },
  
  bankName: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  
  accountHolderName: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  
  // Address Details
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },
  
  pincode: {
    type: DataTypes.STRING(10),
    allowNull: true,
    defaultValue: null,
    validate: {
      is: /^[0-9]{6}$/, // 6-digit pincode validation
    },
  },
  
  // Document Images
  parentImage: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  },
  
  childImage: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  },
  
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  },
  
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  
  processedBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "users", key: "id" },
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  },
  
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<Kyc, InferCreationAttributes<Kyc>>;

Kyc.init(kycAttributes, {
  sequelize,
  modelName: "Kyc",
  tableName: "kycs",
  timestamps: true,
  underscored: false,
  freezeTableName: true,
});

// Add validation to ensure at least one KYC document is provided
Kyc.addHook('beforeValidate', (kyc) => {
  if (!kyc.getDataValue('panNumber') && !kyc.getDataValue('aadhaarNumber')) {
    throw new Error('Either PAN number or Aadhaar number must be provided');
  }
});

export default Kyc;

