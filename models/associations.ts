import { Plan } from './Plan.ts';
import { PlanRequest } from './PlanRequest.ts';
import { Payment } from './Payment.ts';
import { User } from './User.ts';

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

export { Plan, PlanRequest, Payment, User };

