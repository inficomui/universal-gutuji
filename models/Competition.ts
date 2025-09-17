import {
  DataTypes,
  Model,
  Op,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type ModelAttributes,
} from "sequelize";
import { sequelize } from "../utils/db.ts";

/**
 * Competition model for Universal Guruji platform
 * Represents competitions that users can participate in
 */
export class Competition extends Model<
  InferAttributes<Competition>,
  InferCreationAttributes<Competition>
> {
  declare id: CreationOptional<number>;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare price: number;
  declare address: string;
  declare image: CreationOptional<string | null>;
  declare gmapLocation: CreationOptional<string | null>;
  declare date: Date;
  declare isActive: CreationOptional<boolean>;
  declare maxParticipants: CreationOptional<number | null>;
  declare currentParticipants: CreationOptional<number>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const competitionAttributes = {
  id: { 
    type: DataTypes.INTEGER.UNSIGNED, 
    autoIncrement: true, 
    primaryKey: true 
  },

  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { 
      notEmpty: { msg: "Competition title is required" },
      len: { args: [5, 200], msg: "Title must be between 5 and 200 characters" }
    },
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: { args: [0], msg: "Price must be non-negative" }
    }
  },

  address: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Address is required" }
    }
  },

  image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
  },

  gmapLocation: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },

  date: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: { args: true, msg: "Valid date is required" },
      isAfter: { 
        args: new Date().toISOString(), 
        msg: "Competition date must be in the future" 
      }
    }
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

  maxParticipants: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    defaultValue: null,
  },

  currentParticipants: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<Competition, InferCreationAttributes<Competition>>;

Competition.init(competitionAttributes, {
  sequelize,
  tableName: "competitions",
  timestamps: true,
  defaultScope: {
    where: {
      isActive: true,
    },
    order: [["date", "ASC"]],
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
    upcoming: {
      where: {
        isActive: true,
        date: {
          [Op.gte]: new Date()
        }
      }
    },
    past: {
      where: {
        date: {
          [Op.lt]: new Date()
        }
      }
    },
    withInactive: {
      // No additional where clause - shows all competitions
    },
  },
  indexes: [
    { name: "idx_competitions_is_active", fields: ["isActive"] },
    { name: "idx_competitions_date", fields: ["date"] },
    { name: "idx_competitions_price", fields: ["price"] },
  ],
});

export default Competition;
