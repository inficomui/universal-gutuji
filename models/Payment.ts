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
 * Payment status for plan purchases
 */
export const PAYMENT_STATUSES = [
  "pending",
  "verified",
  "approved",
  "rejected",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export class Payment extends Model<
  InferAttributes<Payment>,
  InferCreationAttributes<Payment>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare planId: number;
  declare amount: number;
  declare currency: string;
  declare utrNumber: string;
  declare paymentMethod: string;
  declare status: PaymentStatus;
  declare adminNotes: CreationOptional<string | null>;
  declare verifiedAt: CreationOptional<Date | null>;
  declare approvedAt: CreationOptional<Date | null>;
  declare rejectedAt: CreationOptional<Date | null>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Helper methods
  isPending() {
    return this.status === 'pending';
  }

  isVerified() {
    return this.status === 'verified';
  }

  isApproved() {
    return this.status === 'approved';
  }

  isRejected() {
    return this.status === 'rejected';
  }

  toJSON() {
    const data = this.get();
    return {
      ...data,
      isPending: this.isPending(),
      isVerified: this.isVerified(),
      isApproved: this.isApproved(),
      isRejected: this.isRejected(),
    };
  }
}

const paymentAttributes = {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },

  planId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'plans',
      key: 'id'
    }
  },

  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { 
      min: { args: [0], msg: "Amount must be non-negative" },
      max: { args: [999999.99], msg: "Amount too high" }
    },
  },

  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: "INR",
    validate: {
      isIn: {
        args: [["INR", "USD", "EUR", "GBP"]],
        msg: "Currency must be INR, USD, EUR, or GBP",
      },
    },
  },

  utrNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: { 
      notEmpty: { msg: "UTR number is required" },
      len: { args: [6, 50], msg: "UTR number must be between 6 and 50 characters" }
    },
  },

  paymentMethod: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "UPI",
    validate: {
      isIn: {
        args: [["UPI", "BANK_TRANSFER", "CASH"]],
        msg: "Payment method must be UPI, BANK_TRANSFER, or CASH",
      },
    },
  },

  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "pending",
    validate: {
      isIn: {
        args: [PAYMENT_STATUSES as unknown as string[]],
        msg: `Status must be one of: ${PAYMENT_STATUSES.join(", ")}`,
      },
    },
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

  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },

  rejectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },

  // TS satisfaction for timestamps
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
} satisfies ModelAttributes<Payment, InferCreationAttributes<Payment>>;

Payment.init(paymentAttributes, {
  sequelize,
  tableName: "payments",
  timestamps: true,
  defaultScope: {
    order: [["createdAt", "DESC"]],
  },
  scopes: {
    pending: {
      where: {
        status: "pending",
      },
    },
    verified: {
      where: {
        status: "verified",
      },
    },
    approved: {
      where: {
        status: "approved",
      },
    },
    rejected: {
      where: {
        status: "rejected",
      },
    },
  },
  indexes: [
    { name: "idx_payments_user_id", fields: ["userId"] },
    { name: "idx_payments_plan_id", fields: ["planId"] },
    { name: "idx_payments_status", fields: ["status"] },
    { name: "idx_payments_utr", fields: ["utrNumber"] },
    { name: "idx_payments_created_at", fields: ["createdAt"] },
  ],
});

/** ---------------- Hooks ---------------- **/
Payment.beforeValidate((payment) => {
  // Ensure UTR number is uppercase for consistency
  if (payment.utrNumber) {
    payment.utrNumber = payment.utrNumber.toUpperCase();
  }
});

Payment.beforeUpdate((payment) => {
  // Set timestamps based on status changes
  if (payment.changed('status')) {
    const now = new Date();
    switch (payment.status) {
      case 'verified':
        payment.verifiedAt = now;
        break;
      case 'approved':
        payment.approvedAt = now;
        break;
      case 'rejected':
        payment.rejectedAt = now;
        break;
    }
  }
});

export default Payment;
