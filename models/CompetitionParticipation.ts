import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type ModelAttributes,
} from "sequelize";
import { sequelize } from "../utils/db.ts";

export enum ParticipationStatus {
  PENDING = 'PENDING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_VERIFIED = 'PAYMENT_VERIFIED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

/**
 * CompetitionParticipation model for Universal Guruji platform
 * Represents user participation in competitions
 */
export class CompetitionParticipation extends Model<
  InferAttributes<CompetitionParticipation>,
  InferCreationAttributes<CompetitionParticipation>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare competitionId: number;
  declare status: ParticipationStatus;
  declare paymentAmount: number;
  declare paymentMethod: CreationOptional<string | null>;
  declare utrNumber: CreationOptional<string | null>;
  declare paymentScreenshot: CreationOptional<string | null>;
  declare adminNotes: CreationOptional<string | null>;
  declare verifiedAt: CreationOptional<Date | null>;
  declare verifiedBy: CreationOptional<number | null>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare user?: any;
  declare competition?: any;
  declare verifier?: any;
}

const participationAttributes = {
  id: { 
    type: DataTypes.INTEGER.UNSIGNED, 
    autoIncrement: true, 
    primaryKey: true 
  },

  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },

  competitionId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'competitions',
      key: 'id'
    }
  },

  status: {
    type: DataTypes.ENUM(...Object.values(ParticipationStatus)),
    allowNull: false,
    defaultValue: ParticipationStatus.PENDING
  },

  paymentAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: { args: [0], msg: "Payment amount must be non-negative" }
    }
  },

  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
  },

  utrNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
  },

  paymentScreenshot: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
  },

  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },

  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },

  verifiedBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    defaultValue: null,
    references: {
      model: 'users',
      key: 'id'
    }
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<CompetitionParticipation, InferCreationAttributes<CompetitionParticipation>>;

CompetitionParticipation.init(participationAttributes, {
  sequelize,
  tableName: "competition_participations",
  timestamps: true,
  defaultScope: {
    order: [["createdAt", "DESC"]],
  },
  scopes: {
    pending: {
      where: {
        status: ParticipationStatus.PENDING
      }
    },
    paymentPending: {
      where: {
        status: ParticipationStatus.PAYMENT_PENDING
      }
    },
    approved: {
      where: {
        status: ParticipationStatus.APPROVED
      }
    },
    rejected: {
      where: {
        status: ParticipationStatus.REJECTED
      }
    },
    verified: {
      where: {
        status: ParticipationStatus.PAYMENT_VERIFIED
      }
    }
  },
  indexes: [
    { name: "idx_participations_user_id", fields: ["userId"] },
    { name: "idx_participations_competition_id", fields: ["competitionId"] },
    { name: "idx_participations_status", fields: ["status"] },
    { name: "idx_participations_utr", fields: ["utrNumber"] },
    { 
      name: "idx_participations_user_competition", 
      fields: ["userId", "competitionId"],
      unique: true
    }
  ],
});

export default CompetitionParticipation;
