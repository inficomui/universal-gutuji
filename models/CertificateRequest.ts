import { DataTypes, Model, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../utils/db.js';

export enum CertificateStatus {
  PENDING = 'pending',
  APPROVED = 'approved', 
  REJECTED = 'rejected',
  ISSUED = 'issued',
  FAILED = 'failed'
}

export interface CertificatePositions {
  studentName: { x: number; y: number; fontSize: number; anchor: 'left' | 'center' | 'right' };
  parentName: { x: number; y: number; fontSize: number; anchor: 'left' | 'center' | 'right' };
  levelName: { x: number; y: number; fontSize: number; anchor: 'left' | 'center' | 'right' };
  date: { x: number; y: number; fontSize: number; anchor: 'left' | 'center' | 'right' };
  certificateNo: { x: number; y: number; fontSize: number; anchor: 'left' | 'center' | 'right' };
}

export class CertificateRequest extends Model<InferAttributes<CertificateRequest>, InferCreationAttributes<CertificateRequest>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare levelId: number;
  declare status: CertificateStatus;
  declare studentName: string;
  declare parentName: string;
  declare levelName: string;
  declare certificateNo: CreationOptional<string | null>;
  declare issuedAt: CreationOptional<Date | null>;
  declare emailTo: string;
  declare imagePath: CreationOptional<string | null>;
  declare pdfPath: CreationOptional<string | null>;
  declare errorMessage: CreationOptional<string | null>;
  declare positionsJson: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare user?: any;
  declare level?: any;

  // Default positions for certificate text placement
  static getDefaultPositions(): CertificatePositions {
    return {
      studentName: { x: 400, y: 300, fontSize: 32, anchor: 'center' },
      parentName: { x: 400, y: 350, fontSize: 24, anchor: 'center' },
      levelName: { x: 400, y: 400, fontSize: 28, anchor: 'center' },
      date: { x: 400, y: 450, fontSize: 20, anchor: 'center' },
      certificateNo: { x: 400, y: 500, fontSize: 18, anchor: 'center' }
    };
  }

  // Get positions as object
  getPositions(): CertificatePositions {
    if (this.positionsJson) {
      return JSON.parse(this.positionsJson);
    }
    return CertificateRequest.getDefaultPositions();
  }

  // Set positions from object
  setPositions(positions: CertificatePositions): void {
    this.positionsJson = JSON.stringify(positions);
  }
}

CertificateRequest.init({
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false
  },
  levelId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(...Object.values(CertificateStatus)),
    allowNull: false,
    defaultValue: CertificateStatus.PENDING
  },
  studentName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  parentName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  levelName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  certificateNo: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true
  },
  issuedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  emailTo: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  imagePath: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  pdfPath: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  positionsJson: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: JSON.stringify(CertificateRequest.getDefaultPositions())
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'CertificateRequest',
  tableName: 'certificate_requests',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['certificateNo']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['levelId']
    },
    {
      fields: ['status']
    }
  ]
});
