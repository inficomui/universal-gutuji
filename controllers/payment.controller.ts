import type { Request, Response } from "express";
import { Payment } from "../models/Payment.ts";
import { Plan } from "../models/Plan.ts";
import { BVLog } from "../models/BvLogs.ts";
import { User } from "../models/User.ts";
import { UserBV } from "../models/UserBv.ts";
import { Wallet } from "../models/Wallet.ts";
import { WalletTransaction } from "../models/WalletTransaction.ts";
import { Withdrawal } from "../models/Withdrawal.ts";
import { AdminConfig } from "../models/AdminConfig.ts";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../utils/db.ts";
// import BVLog from "@/models/BvLogs.ts";
// import BVLog from "@/models/BvLogs.ts";

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId, utrNumber, paymentMethod = "UPI" } = req.body;
    const userId = (req as any).user?.userId;
// console.log("req.user", req.user);


    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    if (!planId || !utrNumber) {
      res.status(400).json({
        success: false,
        message: "Plan ID and UTR number are required"
      });
      return;
    }

    // Check if plan exists
    const plan = await Plan.findByPk(planId);
    if (!plan) {
      res.status(404).json({
        success: false,
        message: "Plan not found"
      });
      return;
    }

    // Check if user already has a pending payment for this plan
    const existingPayment = await Payment.findOne({
      where: {
        userId,
        planId,
        status: "pending"
      }
    });

    if (existingPayment) {
      res.status(400).json({
        success: false,
        message: "You already have a pending payment for this plan"
      });
      return;
    }

    // Check if user already has an approved payment for this plan
    const approvedPayment = await Payment.findOne({
      where: {
        userId,
        planId,
        status: "approved"
      }
    });

    if (approvedPayment) {
      res.status(400).json({
        success: false,
        message: "You already have an approved payment for this plan"
      });
      return;
    }

    // Create payment record
    const payment = await Payment.create({
      userId,
      planId,
      amount: plan.price,
      currency: plan.currency,
      utrNumber: utrNumber.toUpperCase(),
      paymentMethod,
      status: "pending"
    });

    // Include plan details in response
    const paymentWithPlan = await Payment.findByPk(payment.id, {
      include: [
        {
          model: Plan,
          as: 'plan'
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: "Payment submitted successfully. Please wait for admin verification.",
      data: paymentWithPlan
    });
  } catch (error: any) {
    console.error("Create payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const getUserPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { status, page = 1, limit = 10 } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    const whereClause: any = { userId };
    if (status) {
      whereClause.status = status;
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Plan,
          as: 'plan'
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset
    });

    res.json({
      success: true,
      data: payments,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error: any) {
    console.error("Get user payments error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const getAllPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, userId, planId, page = 1, limit = 20 } = req.query;

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }
    if (userId) {
      whereClause.userId = userId;
    }
    if (planId) {
      whereClause.planId = planId;
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Plan,
          as: 'plan'
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset
    });

    res.json({
      success: true,
      data: payments,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error: any) {
    console.error("Get all payments error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response): Promise<void> => {
  let transaction: Transaction | null = null;
  
  try {
    const { paymentId } = req.params;
    const { status, adminNotes } = req.body;

    if (!paymentId || !status) {
      res.status(400).json({
        success: false,
        message: "Payment ID and status are required"
      });
      return;
    }

    const validStatuses = ['pending', 'verified', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(', ')
      });
      return;
    }

    // Start database transaction
    transaction = await Payment.sequelize!.transaction();

    const payment = await Payment.findByPk(paymentId, {
      include: [
        {
          model: Plan,
          as: 'plan'
        },
        {
          model: User,
          as: 'user'
        }
      ],
      transaction
    });

    if (!payment) {
      await transaction.rollback();
      res.status(404).json({
        success: false,
        message: "Payment not found"
      });
      return;
    }

    // Update payment status
    await payment.update({
      status,
      adminNotes: adminNotes || payment.adminNotes
    }, { transaction });

    // If payment is approved, activate the user and process BV
    if (status === 'approved') {
      try {
        // Activate the user
        await User.update(
          { isActive: true },
          { where: { id: payment.userId }, transaction }
        );

        // Process BV distribution
        const bvPoints = 50; // fixed BV for every approved payment
        let currentUser = await User.findByPk(payment.userId, { transaction });

        while (currentUser && currentUser.sponsorId) {
          // Find sponsor by username (sponsorId contains the username)
          const sponsor = await User.findOne({
            where: { username: currentUser.sponsorId },
            transaction
          });

          if (sponsor) {
            // Update or create sponsor BV row
            const [bvRow] = await UserBV.findOrCreate({
              where: { userId: sponsor.id },
              defaults: { 
                userId: sponsor.id,
                leftBV: 0, 
                rightBV: 0, 
                carryLeft: 0, 
                carryRight: 0 
              },
              transaction
            });

            // Add BV to sponsor (no left/right distinction in new system)
            await bvRow.update({
              leftBV: Number(bvRow.leftBV) + bvPoints
            }, { transaction });

            // Add a log entry (no side field in new system)
            await BVLog.create({
              userId: sponsor.id,
              sourceUserId: payment.userId,
              points: bvPoints,
              matched: false
            }, { transaction });
          }

          // Move up the chain
          currentUser = sponsor;
        }

        // Process sponsor bonus for DIRECT SPONSOR ONLY (not the entire upline tree)
        console.log(`🎁 Processing sponsor bonus for payment ${payment.id}...`);
        const user = await User.findByPk(payment.userId, { transaction });
        console.log(`👤 User details:`, { 
          id: user?.id, 
          username: user?.username, 
          sponsorId: user?.sponsorId,
          name: user?.name,
          email: user?.email
        });
        
        if (user?.sponsorId) {
          console.log(`🔍 Looking for sponsor with username: "${user.sponsorId}"`);
          const directSponsor = await User.findOne({
            where: { username: user.sponsorId },
            transaction
          });

          console.log(`🎯 Direct sponsor found:`, { 
            id: directSponsor?.id, 
            username: directSponsor?.username,
            name: directSponsor?.name,
            email: directSponsor?.email
          });

          if (directSponsor) {
            // Get sponsor bonus amount from admin config
            const sponsorBonusConfig = await AdminConfig.findOne({
              order: [['id', 'ASC']],
              transaction
            });

            console.log(`💰 Sponsor bonus config:`, { sponsorBonus: sponsorBonusConfig?.sponsorBonus });

            if (sponsorBonusConfig) {
              const bonusAmount = Number(sponsorBonusConfig.sponsorBonus);
              console.log(`💵 Bonus amount: ₹${bonusAmount}`);
              
              if (bonusAmount > 0) {
                // Get or create sponsor's wallet
                const [sponsorWallet] = await Wallet.findOrCreate({
                  where: { userId: directSponsor.id },
                  defaults: { 
                    userId: directSponsor.id,
                    balance: 0,
                    totalEarned: 0,
                    totalWithdrawn: 0
                  },
                  transaction
                });

                // Add bonus to sponsor's wallet
                await sponsorWallet.update({
                  balance: Number(sponsorWallet.balance) + bonusAmount,
                  totalEarned: Number(sponsorWallet.totalEarned) + bonusAmount,
                  lastTransactionAt: new Date()
                }, { transaction });

                // Add bonus to sponsor's totalIncome
                await User.update({
                  totalIncome: Number(directSponsor.totalIncome) + bonusAmount
                }, {
                  where: { id: directSponsor.id },
                  transaction
                });

                // Create wallet transaction record
                await WalletTransaction.create({
                  userId: directSponsor.id,
                  type: 'commission',
                  amount: bonusAmount,
                  balanceBefore: Number(sponsorWallet.balance),
                  balanceAfter: Number(sponsorWallet.balance) + bonusAmount,
                  status: 'completed',
                  description: `Sponsor bonus for referring user ${user.username} (${user.name})`,
                  referenceId: `SPONSOR_BONUS_${user.id}_${directSponsor.id}_${Date.now()}`,
                  metadata: {
                    referredUserId: user.id,
                    referredUsername: user.username,
                    referredUserName: user.name,
                    referredUserEmail: user.email,
                    sponsorId: directSponsor.id,
                    sponsorUsername: directSponsor.username,
                    sponsorName: directSponsor.name,
                    paymentId: payment.id,
                    bonusAmount: bonusAmount,
                    timestamp: new Date().toISOString()
                  }
                }, { transaction });

                console.log(`✅ Sponsor bonus of ₹${bonusAmount} credited to DIRECT SPONSOR ${directSponsor.id} (${directSponsor.username})`);
              } else {
                console.log(`⚠️ Bonus amount is 0 or negative: ${bonusAmount}`);
              }
            } else {
              console.log(`❌ No sponsor bonus config found`);
            }
          } else {
            console.log(`❌ Direct sponsor not found for username: ${user.sponsorId}`);
          }
        } else {
          console.log(`❌ User has no sponsorId: ${user?.sponsorId}`);
        }

        // Process BV matching and wallet updates
        await processBVMatching(payment.userId, transaction);
      } catch (bvError) {
        console.error("BV processing error:", bvError);
        await transaction.rollback();
        res.status(500).json({
          success: false,
          message: "Error processing BV distribution"
        });
        return;
      }
    }

    // Commit transaction
    await transaction.commit();

    // Get updated payment with relations
    const updatedPayment = await Payment.findByPk(paymentId, {
      include: [
        {
          model: Plan,
          as: 'plan'
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'isActive']
        }
      ]
    });

    res.json({
      success: true,
      message: `Payment ${status} successfully`,
      data: updatedPayment
    });
  } catch (error: any) {
    console.error("Update payment status error:", error);
    
    // Rollback transaction if it exists
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Transaction rollback error:", rollbackError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const getPaymentStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalPayments = await Payment.count();
    const pendingPayments = await Payment.count({ where: { status: 'pending' } });
    const verifiedPayments = await Payment.count({ where: { status: 'verified' } });
    const approvedPayments = await Payment.count({ where: { status: 'approved' } });
    const rejectedPayments = await Payment.count({ where: { status: 'rejected' } });

    // Calculate total revenue
    const revenueResult = await Payment.sum('amount', {
      where: { status: 'approved' }
    });

    const totalRevenue = revenueResult || 0;

    res.json({
      success: true,
      data: {
        total: totalPayments,
        pending: pendingPayments,
        verified: verifiedPayments,
        approved: approvedPayments,
        rejected: rejectedPayments,
        totalRevenue
      }
    });
  } catch (error: any) {
    console.error("Get payment stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// BV Matching Logic
const processBVMatching = async (userId: number, transaction: Transaction): Promise<void> => {
  try {
    // Get all users who need BV matching processing
    const users = await User.findAll({
      where: {
        isActive: true
      },
      include: [{
        model: UserBV,
        as: 'userBV',
        required: true
      }],
      transaction
    });

    for (const user of users) {
      const userBV = (user as any).userBV;
      if (!userBV) continue;

      const leftBV = Number(userBV.leftBV);
      const rightBV = Number(userBV.rightBV);
      const carryLeft = Number(userBV.carryLeft);
      const carryRight = Number(userBV.carryRight);

      // Calculate total available BV on each side
      const totalLeftBV = leftBV + carryLeft;
      const totalRightBV = rightBV + carryRight;

      // Find the minimum BV to match
      const matchableBV = Math.min(totalLeftBV, totalRightBV);

      if (matchableBV > 0) {
        // Calculate earnings (example: 10% of matched BV)
        const earnings = matchableBV * 0.1; // 10% commission
        const newLeftBV = totalLeftBV - matchableBV;
        const newRightBV = totalRightBV - matchableBV;

        // Update UserBV
        await userBV.update({
          leftBV: newLeftBV,
          rightBV: newRightBV,
          carryLeft: 0,
          carryRight: 0
        }, { transaction });

        // Update or create wallet
        const [wallet] = await Wallet.findOrCreate({
          where: { userId: user.id },
          defaults: {
            userId: user.id,
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0
          },
          transaction
        });

        // Add earnings to wallet
        const balanceBefore = Number(wallet.balance);
        wallet.addAmount(earnings);
        await wallet.save({ transaction });

        // Create wallet transaction record
        await WalletTransaction.create({
          userId: user.id,
          type: 'bv_match',
          amount: earnings,
          balanceBefore,
          balanceAfter: Number(wallet.balance),
          status: 'completed',
          description: `BV Matching Income: ${matchableBV} points matched (${earnings} earned)`,
          referenceId: `BV_MATCH_${user.id}_${Date.now()}`,
          metadata: {
            matchedBV: matchableBV,
            leftBV: totalLeftBV,
            rightBV: totalRightBV,
            earnings: earnings,
            commissionRate: 0.1,
            username: user.username,
            userEmail: user.email,
            userFullName: user.name,
            timestamp: new Date().toISOString(),
            incomeType: 'BV_MATCHING'
          }
        }, { transaction });

        // Update BV logs to mark as matched
        await BVLog.update(
          { matched: true },
          {
            where: {
              userId: user.id,
              matched: false
            },
            transaction
          }
        );

        console.log(`BV Match processed for user ${user.id}: ${earnings} earned from ${matchableBV} matched BV`);
      }
    }
  } catch (error) {
    console.error("BV matching error:", error);
    throw error;
  }
};

// Wallet Controller Functions
export const getUserWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
console.log("req.user", req.user);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    const wallet = await Wallet.findOne({
      where: { userId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      const newWallet = await Wallet.create({
        userId,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      });

      res.json({
        success: true,
        data: newWallet
      });
      return;
    }

    res.json({
      success: true,
      data: wallet
    });
  } catch (error: any) {
    console.error("Get user wallet error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const getWalletTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { type, page = 1, limit = 20 } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    const whereClause: any = { userId };
    if (type) {
      whereClause.type = type;
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: transactions } = await WalletTransaction.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset
    });

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error: any) {
    console.error("Get wallet transactions error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Get wallet transaction summary by type
export const getWalletTransactionSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    // Get transaction summary by type
    const summary = await WalletTransaction.findAll({
      where: { userId },
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      group: ['type'],
      raw: true
    });

    // Get total earnings and withdrawals
    const totalEarnings = await WalletTransaction.sum('amount', {
      where: { 
        userId,
        amount: { [Op.gt]: 0 }
      }
    });

    const totalWithdrawals = await WalletTransaction.sum('amount', {
      where: { 
        userId,
        amount: { [Op.lt]: 0 }
      }
    });

    res.json({
      success: true,
      data: {
        summary: summary.map((item: any) => ({
          type: item.type,
          count: Number(item.count),
          totalAmount: Number(item.totalAmount)
        })),
        totals: {
          totalEarnings: totalEarnings || 0,
          totalWithdrawals: Math.abs(totalWithdrawals || 0),
          netAmount: (totalEarnings || 0) + (totalWithdrawals || 0)
        }
      }
    });
  } catch (error: any) {
    console.error("Get wallet transaction summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const createWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { amount, method, accountDetails } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    if (!amount || !method || !accountDetails) {
      res.status(400).json({
        success: false,
        message: "Amount, method, and account details are required"
      });
      return;
    }

    // Check if user's KYC is verified
    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    if (!user.kycVerified) {
      res.status(400).json({
        success: false,
        message: "KYC verification is required for withdrawals. Please complete your KYC first."
      });
      return;
    }

    // Check minimum withdrawal amount
    if (amount < 100) {
      res.status(400).json({
        success: false,
        message: "Minimum withdrawal amount is ₹100"
      });
      return;
    }

    // Get user wallet
    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet || Number(wallet.balance) < amount) {
      res.status(400).json({
        success: false,
        message: "Insufficient wallet balance"
      });
      return;
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      userId,
      amount,
      method,
      accountDetails,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: withdrawal
    });
  } catch (error: any) {
    console.error("Create withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const getUserWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { status, page = 1, limit = 20 } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    const whereClause: any = { userId };
    if (status) {
      whereClause.status = status;
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: withdrawals } = await Withdrawal.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset
    });

    res.json({
      success: true,
      data: withdrawals,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error: any) {
    console.error("Get user withdrawals error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const updateWithdrawalStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { withdrawalId } = req.params;
    const { status, adminNotes, transactionId } = req.body;

    if (!withdrawalId || !status) {
      res.status(400).json({
        success: false,
        message: "Withdrawal ID and status are required"
      });
      return;
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status"
      });
      return;
    }

    const withdrawal = await Withdrawal.findByPk(withdrawalId);
    if (!withdrawal) {
      res.status(404).json({
        success: false,
        message: "Withdrawal not found"
      });
      return;
    }

    // If approving withdrawal, deduct from wallet
    if (status === 'approved' && withdrawal.status === 'pending') {
      const wallet = await Wallet.findOne({ where: { userId: withdrawal.userId } });
      if (!wallet || Number(wallet.balance) < withdrawal.amount) {
        res.status(400).json({
          success: false,
          message: "Insufficient wallet balance"
        });
        return;
      }

      // Deduct from wallet
      wallet.subtractAmount(withdrawal.amount);
      await wallet.save();

      // Create wallet transaction
      await WalletTransaction.create({
        userId: withdrawal.userId,
        type: 'withdrawal',
        amount: -withdrawal.amount,
        balanceBefore: Number(wallet.balance) + Number(withdrawal.amount),
        balanceAfter: Number(wallet.balance),
        status: 'completed',
        description: `Withdrawal: ${withdrawal.method} - ₹${withdrawal.amount}`,
        referenceId: `WITHDRAWAL_${withdrawalId}_${Date.now()}`,
        metadata: {
          withdrawalId: withdrawal.id,
          withdrawalMethod: withdrawal.method,
          withdrawalAmount: Number(withdrawal.amount),
          accountDetails: typeof withdrawal.accountDetails === 'string' 
            ? JSON.parse(withdrawal.accountDetails) 
            : withdrawal.accountDetails,
          adminNotes: withdrawal.adminNotes,
          transactionId: withdrawal.transactionId,
          timestamp: new Date().toISOString(),
          incomeType: 'WITHDRAWAL'
        }
      });
    }

    // Update withdrawal status
    await withdrawal.update({
      status,
      adminNotes: adminNotes || withdrawal.adminNotes,
      transactionId: transactionId || withdrawal.transactionId,
      processedAt: status === 'completed' ? new Date() : withdrawal.processedAt
    });

    res.json({
      success: true,
      message: `Withdrawal ${status} successfully`,
      data: withdrawal
    });
  } catch (error: any) {
    console.error("Update withdrawal status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};


