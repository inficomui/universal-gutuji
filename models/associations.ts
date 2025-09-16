import { Plan } from './Plan.ts';
import { PlanRequest } from './PlanRequest.ts';
import { Payment } from './Payment.ts';
import { User } from './User.ts';
import { Wallet } from './Wallet.ts';
import { WalletTransaction } from './WalletTransaction.ts';
import { Withdrawal } from './Withdrawal.ts';
import { UserBV } from './UserBv.ts';
import { BVLog } from './BvLogs.ts';
import { Level } from './Level.ts';
import { Video } from './Video.ts';
import { Kyc } from './Kyc.ts';

// Define associations
PlanRequest.belongsTo(User, { 
  as: 'user', 
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

PlanRequest.belongsTo(Plan, { 
  as: 'plan', 
  foreignKey: 'planId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

PlanRequest.belongsTo(User, { 
  as: 'approver', 
  foreignKey: 'approvedBy',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

User.hasMany(PlanRequest, { 
  as: 'planRequests', 
  foreignKey: 'userId' 
});

Plan.hasMany(PlanRequest, { 
  as: 'planRequests', 
  foreignKey: 'planId' 
});

// Payment associations
Payment.belongsTo(User, { 
  as: 'user', 
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Payment.belongsTo(Plan, { 
  as: 'plan', 
  foreignKey: 'planId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

User.hasMany(Payment, { 
  as: 'payments', 
  foreignKey: 'userId' 
});

Plan.hasMany(Payment, { 
  as: 'payments', 
  foreignKey: 'planId' 
});


// User referral associations (no foreign key constraint for string references)
User.belongsTo(User, { 
  as: 'sponsor', 
  foreignKey: 'sponsorId',
  targetKey: 'username',
  constraints: false // Disable foreign key constraint for string references
});

User.hasMany(User, { 
  as: 'referrals', 
  foreignKey: 'sponsorId',
  sourceKey: 'username',
  constraints: false // Disable foreign key constraint for string references
});

// Wallet associations
Wallet.belongsTo(User, { 
  as: 'user', 
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

User.hasOne(Wallet, { 
  as: 'wallet', 
  foreignKey: 'userId' 
});

// WalletTransaction associations
WalletTransaction.belongsTo(User, { 
  as: 'user', 
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

User.hasMany(WalletTransaction, { 
  as: 'walletTransactions', 
  foreignKey: 'userId' 
});

// Withdrawal associations
Withdrawal.belongsTo(User, { 
  as: 'user', 
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

User.hasMany(Withdrawal, { 
  as: 'withdrawals', 
  foreignKey: 'userId' 
});

// UserBV associations
UserBV.belongsTo(User, { 
  as: 'userBVUser', 
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

User.hasOne(UserBV, { 
  as: 'userBV', 
  foreignKey: 'userId' 
});

// BVLog associations
BVLog.belongsTo(User, { 
  as: 'recipientUser', 
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

BVLog.belongsTo(User, { 
  as: 'sourceUser', 
  foreignKey: 'sourceUserId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

User.hasMany(BVLog, { 
  as: 'receivedBvLogs', 
  foreignKey: 'userId' 
});

User.hasMany(BVLog, { 
  as: 'sourceBvLogs', 
  foreignKey: 'sourceUserId' 
});

// Level-Video associations
Video.belongsTo(Level, { 
  as: 'level', 
  foreignKey: 'levelId',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

Level.hasMany(Video, { 
  as: 'videos', 
  foreignKey: 'levelId' 
});

// KYC associations
Kyc.belongsTo(User, { 
  as: 'user', 
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Kyc.belongsTo(User, { 
  as: 'processedByUser', 
  foreignKey: 'processedBy',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

User.hasMany(Kyc, { 
  as: 'kycRequests', 
  foreignKey: 'userId' 
});

User.hasMany(Kyc, { 
  as: 'processedKycs', 
  foreignKey: 'processedBy' 
});

export { Plan, PlanRequest, Payment, User, Wallet, WalletTransaction, Withdrawal, UserBV, BVLog, Level, Video, Kyc };

