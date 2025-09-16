import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { Withdrawal, WITHDRAWAL_METHODS, WITHDRAWAL_STATUSES } from "../models/Withdrawal.ts";
import { Kyc } from "../models/Kyc.ts";
import { Wallet } from "../models/Wallet.ts";
import { WalletTransaction, WALLET_TRANSACTION_TYPES } from "../models/WalletTransaction.ts";
import { AdminConfig } from "../models/AdminConfig.ts";
import { Op } from "sequelize";

// Request withdrawal
export const requestWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const { amount } = req.body;

    // Validate required fields
    if (!amount) {
      res.status(400).json({ 
        success: false,
        message: "Amount is required" 
      });
      return;
    }

    // Validate amount
    const withdrawalAmount = Number(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount < 100) {
      res.status(400).json({ 
        success: false,
        message: "Minimum withdrawal amount is ₹100" 
      });
      return;
    }

    if (withdrawalAmount > 100000) {
      res.status(400).json({ 
        success: false,
        message: "Maximum withdrawal amount is ₹1,00,000" 
      });
      return;
    }

    // Get user with KYC status
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'kycVerified', 'totalIncome', 'totalWithdrawals']
    });

    if (!user) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    // Check if user is KYC verified
    if (!user.kycVerified) {
      res.status(403).json({ 
        success: false,
        message: "KYC verification is required to make withdrawals" 
      });
      return;
    }

    // Get user's KYC details for withdrawal
    const kyc = await Kyc.findOne({
      where: { 
        userId,
        status: 'approved'
      },
      order: [['createdAt', 'DESC']]
    });

    if (!kyc) {
      res.status(400).json({ 
        success: false,
        message: "No approved KYC found. Please complete KYC verification first" 
      });
      return;
    }

    // Check if user has sufficient balance
    const availableBalance = Number(user.totalIncome) - Number(user.totalWithdrawals);
    if (availableBalance < withdrawalAmount) {
      res.status(400).json({ 
        success: false,
        message: `Insufficient balance. Available: ₹${availableBalance.toFixed(2)}` 
      });
      return;
    }

    // Check for pending withdrawals
    const pendingWithdrawal = await Withdrawal.findOne({
      where: { 
        userId,
        status: { [Op.in]: ['pending', 'approved', 'processing'] }
      }
    });

    if (pendingWithdrawal) {
      res.status(400).json({ 
        success: false,
        message: "You already have a pending withdrawal request" 
      });
      return;
    }

    // Get TDS percentage from admin config
    const tdsConfig = await AdminConfig.findOne({
      order: [['id', 'ASC']]
    });
    const tdsPercentage = tdsConfig ? Number(tdsConfig.tds) : 5.00;

    // Calculate TDS deduction
    const tdsAmount = (withdrawalAmount * tdsPercentage) / 100;
    const netAmount = withdrawalAmount - tdsAmount;

    // Prepare account details from KYC
    const accountDetails = {
      accountNumber: kyc.accountNumber,
      ifscCode: kyc.ifscCode,
      bankName: kyc.bankName,
      accountHolderName: kyc.accountHolderName,
      address: kyc.address,
      pincode: kyc.pincode
    };

    // Create withdrawal request with TDS details
    const withdrawal = await Withdrawal.create({
      userId,
      amount: withdrawalAmount,
      method: 'bank_transfer', // Default to bank transfer since we're using KYC bank details
      accountDetails: {
        ...accountDetails,
        tdsPercentage,
        tdsAmount,
        netAmount
      },
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        method: withdrawal.method,
        status: withdrawal.status,
        tdsDetails: {
          tdsPercentage,
          tdsAmount,
          netAmount
        },
        accountDetails: {
          bankName: kyc.bankName,
          accountHolderName: kyc.accountHolderName,
          accountNumber: `${kyc.accountNumber.substring(0, 4)}****${kyc.accountNumber.substring(kyc.accountNumber.length - 4)}`,
          ifscCode: kyc.ifscCode
        },
        requestedAt: withdrawal.createdAt
      }
    });
  } catch (error: any) {
    console.error("Request withdrawal error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get user's withdrawal history
export const getMyWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const { page = 1, limit = 10, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build where clause
    const whereClause: any = { userId };
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const { count, rows: withdrawals } = await Withdrawal.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: {
        withdrawals: withdrawals.map(withdrawal => ({
          id: withdrawal.id,
          amount: Number(withdrawal.amount),
          method: withdrawal.method,
          status: withdrawal.status,
          accountDetails: typeof withdrawal.accountDetails === 'string' 
            ? JSON.parse(withdrawal.accountDetails) 
            : withdrawal.accountDetails,
          adminNotes: withdrawal.adminNotes,
          transactionId: withdrawal.transactionId,
          requestedAt: withdrawal.createdAt,
          processedAt: withdrawal.processedAt
        })),
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / Number(limit)),
          totalItems: count,
          itemsPerPage: Number(limit)
        }
      }
    });
  } catch (error: any) {
    console.error("Get my withdrawals error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get user's withdrawal balance info
export const getWithdrawalBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'kycVerified', 'totalIncome', 'totalWithdrawals']
    });

    if (!user) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    const totalIncome = Number(user.totalIncome);
    const totalWithdrawn = Number(user.totalWithdrawals);
    const availableBalance = totalIncome - totalWithdrawn;

    // Get KYC details if verified
    let kycDetails = null;
    if (user.kycVerified) {
      const kyc = await Kyc.findOne({
        where: { 
          userId,
          status: 'approved'
        },
        order: [['createdAt', 'DESC']]
      });

      if (kyc) {
        kycDetails = {
          bankName: kyc.bankName,
          accountHolderName: kyc.accountHolderName,
          accountNumber: `${kyc.accountNumber.substring(0, 4)}****${kyc.accountNumber.substring(kyc.accountNumber.length - 4)}`,
          ifscCode: kyc.ifscCode,
          address: kyc.address,
          pincode: kyc.pincode
        };
      }
    }

    // Check for pending withdrawals
    const pendingWithdrawal = await Withdrawal.findOne({
      where: { 
        userId,
        status: { [Op.in]: ['pending', 'approved', 'processing'] }
      },
      attributes: ['id', 'amount', 'status', 'createdAt']
    });

    res.json({
      success: true,
      data: {
        kycVerified: user.kycVerified,
        kycDetails,
        totalIncome,
        totalWithdrawn,
        availableBalance,
        pendingWithdrawal: pendingWithdrawal ? {
          id: pendingWithdrawal.id,
          amount: Number(pendingWithdrawal.amount),
          status: pendingWithdrawal.status,
          requestedAt: pendingWithdrawal.createdAt
        } : null
      }
    });
  } catch (error: any) {
    console.error("Get withdrawal balance error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get all withdrawal requests (Admin only)
export const getAllWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build where clause
    const whereClause: any = {};
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // Build search clause
    const searchClause: any = {};
    if (search) {
      searchClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: withdrawals } = await Withdrawal.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username', 'kycVerified'],
          where: searchClause
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: {
        withdrawals: withdrawals.map(withdrawal => ({
          id: withdrawal.id,
          amount: Number(withdrawal.amount),
          method: withdrawal.method,
          status: withdrawal.status,
          accountDetails: typeof withdrawal.accountDetails === 'string' 
            ? JSON.parse(withdrawal.accountDetails) 
            : withdrawal.accountDetails,
          adminNotes: withdrawal.adminNotes,
          transactionId: withdrawal.transactionId,
          user: {
            id: (withdrawal as any).user.id,
            name: (withdrawal as any).user.name,
            email: (withdrawal as any).user.email,
            username: (withdrawal as any).user.username,
            kycVerified: (withdrawal as any).user.kycVerified
          },
          requestedAt: withdrawal.createdAt,
          processedAt: withdrawal.processedAt
        })),
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / Number(limit)),
          totalItems: count,
          itemsPerPage: Number(limit)
        }
      }
    });
  } catch (error: any) {
    console.error("Get all withdrawals error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Approve withdrawal request (Admin only)
export const approveWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { withdrawalId } = req.params;
    const { transactionId } = req.body;
    const adminId = (req as any).user?.userId;

    const withdrawal = await Withdrawal.findByPk(withdrawalId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username', 'totalIncome', 'totalWithdrawals']
        }
      ]
    });

    if (!withdrawal) {
      res.status(404).json({ 
        success: false,
        message: "Withdrawal request not found" 
      });
      return;
    }

    if (withdrawal.status !== 'pending') {
      res.status(400).json({ 
        success: false,
        message: "Withdrawal request is not pending" 
      });
      return;
    }

    // Check if user still has sufficient balance
    const user = (withdrawal as any).user;
    const availableBalance = Number(user.totalIncome) - Number(user.totalWithdrawals);
    if (availableBalance < Number(withdrawal.amount)) {
      res.status(400).json({ 
        success: false,
        message: "User has insufficient balance for this withdrawal" 
      });
      return;
    }

    // Update withdrawal status
    await withdrawal.update({
      status: 'approved',
      transactionId: transactionId || null,
      processedAt: new Date()
    });

    // Update user's total withdrawals
    await User.update(
      { totalWithdrawals: Number(user.totalWithdrawals) + Number(withdrawal.amount) },
      { where: { id: withdrawal.userId } }
    );

    res.json({
      success: true,
      message: "Withdrawal request approved successfully",
      data: {
        withdrawalId: withdrawal.id,
        userId: withdrawal.userId,
        userName: user.name,
        amount: Number(withdrawal.amount),
        status: 'approved',
        transactionId: withdrawal.transactionId,
        processedAt: withdrawal.processedAt
      }
    });
  } catch (error: any) {
    console.error("Approve withdrawal error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Reject withdrawal request (Admin only)
export const rejectWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { withdrawalId } = req.params;
    const { adminNotes } = req.body;
    const adminId = (req as any).user?.userId;

    const withdrawal = await Withdrawal.findByPk(withdrawalId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        }
      ]
    });

    if (!withdrawal) {
      res.status(404).json({ 
        success: false,
        message: "Withdrawal request not found" 
      });
      return;
    }

    if (withdrawal.status !== 'pending') {
      res.status(400).json({ 
        success: false,
        message: "Withdrawal request is not pending" 
      });
      return;
    }

    // Update withdrawal status
    await withdrawal.update({
      status: 'rejected',
      adminNotes: adminNotes || null,
      processedAt: new Date()
    });

    res.json({
      success: true,
      message: "Withdrawal request rejected successfully",
      data: {
        withdrawalId: withdrawal.id,
        userId: withdrawal.userId,
        userName: (withdrawal as any).user.name,
        amount: Number(withdrawal.amount),
        status: 'rejected',
        adminNotes: withdrawal.adminNotes,
        processedAt: withdrawal.processedAt
      }
    });
  } catch (error: any) {
    console.error("Reject withdrawal error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Complete withdrawal (Admin only)
export const completeWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { withdrawalId } = req.params;
    const { transactionId } = req.body;
    const adminId = (req as any).user?.userId;

    const withdrawal = await Withdrawal.findByPk(withdrawalId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        }
      ]
    });

    if (!withdrawal) {
      res.status(404).json({ 
        success: false,
        message: "Withdrawal request not found" 
      });
      return;
    }

    if (withdrawal.status !== 'approved') {
      res.status(400).json({ 
        success: false,
        message: "Withdrawal request must be approved before completion" 
      });
      return;
    }

    // Update withdrawal status
    await withdrawal.update({
      status: 'completed',
      transactionId: transactionId || withdrawal.transactionId,
      processedAt: new Date()
    });

    res.json({
      success: true,
      message: "Withdrawal completed successfully",
      data: {
        withdrawalId: withdrawal.id,
        userId: withdrawal.userId,
        userName: (withdrawal as any).user.name,
        amount: Number(withdrawal.amount),
        status: 'completed',
        transactionId: withdrawal.transactionId,
        processedAt: withdrawal.processedAt
      }
    });
  } catch (error: any) {
    console.error("Complete withdrawal error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get withdrawal statistics (Admin only)
export const getWithdrawalStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter[Op.gte] = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter[Op.lte] = new Date(endDate as string);
    }

    const whereClause: any = {};
    if (Object.keys(dateFilter).length > 0) {
      whereClause.createdAt = dateFilter;
    }

    // Get withdrawal statistics
    const [
      totalWithdrawals,
      pendingWithdrawals,
      approvedWithdrawals,
      rejectedWithdrawals,
      completedWithdrawals,
      totalAmount,
      pendingAmount,
      approvedAmount,
      completedAmount
    ] = await Promise.all([
      Withdrawal.count({ where: whereClause }),
      Withdrawal.count({ where: { ...whereClause, status: 'pending' } }),
      Withdrawal.count({ where: { ...whereClause, status: 'approved' } }),
      Withdrawal.count({ where: { ...whereClause, status: 'rejected' } }),
      Withdrawal.count({ where: { ...whereClause, status: 'completed' } }),
      Withdrawal.sum('amount', { where: whereClause }),
      Withdrawal.sum('amount', { where: { ...whereClause, status: 'pending' } }),
      Withdrawal.sum('amount', { where: { ...whereClause, status: 'approved' } }),
      Withdrawal.sum('amount', { where: { ...whereClause, status: 'completed' } })
    ]);

    res.json({
      success: true,
      data: {
        counts: {
          total: totalWithdrawals,
          pending: pendingWithdrawals,
          approved: approvedWithdrawals,
          rejected: rejectedWithdrawals,
          completed: completedWithdrawals
        },
        amounts: {
          total: Number(totalAmount || 0),
          pending: Number(pendingAmount || 0),
          approved: Number(approvedAmount || 0),
          completed: Number(completedAmount || 0)
        }
      }
    });
  } catch (error: any) {
    console.error("Get withdrawal stats error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};
