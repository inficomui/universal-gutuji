import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { Payment } from "../models/Payment.ts";
import { Plan } from "../models/Plan.ts";
import { AdminConfig } from "../models/AdminConfig.ts";
import { Op, Transaction } from "sequelize";
import { AdvancedBVMatchingService } from "../services/advancedBvMatchingService.ts";

// Get all users with pagination (excluding admins)
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    const status = req.query.status as string || '';

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      role: 'user' // Exclude admins
    };

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } }
      ];
    }

    // Add status filter
    if (status === 'active') {
      whereClause.isActive = true;
    } else if (status === 'inactive') {
      whereClause.isActive = false;
    } else if (status === 'blocked') {
      whereClause.isActive = false; // Assuming blocked users are inactive
    }

    // Get users with pagination
    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: [
        'id', 'name', 'email', 'username', 'isActive', 'role', 
        'createdAt', 'totalIncome', 'totalWithdrawals', 'totalMatched',
        'sponsorId', 'position'
      ],
      include: [
        {
          model: User,
          as: 'sponsor',
          attributes: ['name', 'username'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    // Get additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Get plan count
        const planCount = await Payment.count({
          where: { userId: user.id, status: 'approved' }
        });

        // Get referral count
        const referralCount = await User.count({
          where: { sponsorId: user.username }
        });

        // Get total spent
        const totalSpent = await Payment.sum('amount', {
          where: { userId: user.id, status: 'approved' }
        }) || 0;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: null, // Add phone field to User model if needed
          username: user.username,
          isActive: user.isActive,
          isBlocked: !user.isActive, // Assuming blocked = inactive
          role: user.role,
          createdAt: user.createdAt,
          lastLogin: null, // Add lastLogin field to User model if needed
          totalSpent: Number(totalSpent),
          planCount,
          referralCount,
        sponsor: (user as any).sponsor ? {
          name: (user as any).sponsor.name,
          username: (user as any).sponsor.username
        } : null,
          totalIncome: Number(user.totalIncome) || 0,
          totalWithdrawals: Number(user.totalWithdrawals) || 0,
          totalMatched: Number(user.totalMatched) || 0,
          sponsorId: user.sponsorId,
          position: user.position
        };
      })
    );

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          page,
          limit,
          total: count,
          pages: totalPages
        }
      }
    });
  } catch (error: any) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: [
        'id', 'name', 'email', 'username', 'isActive', 'role', 
        'createdAt', 'totalIncome', 'totalWithdrawals', 'totalMatched',
        'sponsorId', 'position'
      ],
      include: [
        {
          model: User,
          as: 'sponsor',
          attributes: ['name', 'username'],
          required: false
        }
      ]
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    // Get additional stats
    const planCount = await Payment.count({
      where: { userId: user.id, status: 'approved' }
    });

    const referralCount = await User.count({
      where: { sponsorId: user.username }
    });

    const totalSpent = await Payment.sum('amount', {
      where: { userId: user.id, status: 'approved' }
    }) || 0;

    const userWithStats = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: null,
      username: user.username,
      isActive: user.isActive,
      isBlocked: !user.isActive,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: null,
      totalSpent: Number(totalSpent),
      planCount,
      referralCount,
        sponsor: (user as any).sponsor ? {
          name: (user as any).sponsor.name,
          username: (user as any).sponsor.username
        } : null,
      totalIncome: Number(user.totalIncome) || 0,
      totalWithdrawals: Number(user.totalWithdrawals) || 0,
      totalMatched: Number(user.totalMatched) || 0,
      sponsorId: user.sponsorId,
      position: user.position
    };

    res.json({
      success: true,
      data: userWithStats
    });
  } catch (error: any) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    await user.update(updateData);

    res.json({
      success: true,
      message: "User updated successfully",
      data: user
    });
  } catch (error: any) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Block/Unblock user
export const blockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    await user.update({ isActive: !isBlocked });

    res.json({
      success: true,
      message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      data: user
    });
  } catch (error: any) {
    console.error("Block user error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Toggle user status (active/inactive)
export const toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    await user.update({ isActive });

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: user
    });
  } catch (error: any) {
    console.error("Toggle user status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    // Check if user has referrals
    const referralCount = await User.count({
      where: { sponsorId: user.username }
    });

    if (referralCount > 0) {
      res.status(400).json({
        success: false,
        message: "Cannot delete user with active referrals"
      });
      return;
    }

    await user.destroy();

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Check user income stats by username
export const checkUserIncomeStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;

    const user = await User.findOne({
      where: { username },
      attributes: ['id', 'name', 'username', 'sponsorId', 'position', 'totalIncome', 'totalWithdrawals', 'totalMatched']
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    // Get BV summary
    const bvSummary = await AdvancedBVMatchingService.getUserBVSummary(user.id);
    
    // Get referrals
    const referrals = await User.findAll({
      where: { sponsorId: user.username },
      attributes: ['id', 'name', 'username', 'position', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    const response = {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        sponsorId: user.sponsorId,
        position: user.position
      },
      income: {
        totalIncome: Number(user.totalIncome) || 0,
        totalWithdrawals: Number(user.totalWithdrawals) || 0,
        availableBalance: (Number(user.totalIncome) || 0) - (Number(user.totalWithdrawals) || 0),
        totalMatched: Number(user.totalMatched) || 0
      },
      bv: bvSummary,
      referrals: referrals.map(ref => ({
        id: ref.id,
        name: ref.name,
        username: ref.username,
        position: ref.position,
        joinedAt: ref.createdAt
      }))
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error: any) {
    console.error("Check user income stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Check user BV data by username
export const checkUserBV = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;

    const user = await User.findOne({
      where: { username },
      attributes: ['id', 'name', 'username', 'sponsorId', 'position']
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    // Get BV summary
    const bvSummary = await AdvancedBVMatchingService.getUserBVSummary(user.id);
    
    // Get referrals
    const referrals = await User.findAll({
      where: { sponsorId: user.username },
      attributes: ['id', 'name', 'username', 'position', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    const response = {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        sponsorId: user.sponsorId,
        position: user.position
      },
      bv: bvSummary,
      referrals: referrals.map(ref => ({
        id: ref.id,
        name: ref.name,
        username: ref.username,
        position: ref.position,
        joinedAt: ref.createdAt
      }))
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error: any) {
    console.error("Check user BV error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Get user statistics for admin dashboard
export const getUserStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.count({
      where: { role: 'user' }
    });

    const activeUsers = await User.count({
      where: { role: 'user', isActive: true }
    });

    const blockedUsers = await User.count({
      where: { role: 'user', isActive: false }
    });

    const adminUsers = await User.count({
      where: { role: 'admin' }
    });

    // Get total revenue from all approved payments
    const totalRevenue = await Payment.sum('amount', {
      where: { status: 'approved' }
    }) || 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        blockedUsers,
        adminUsers,
        totalRevenue: Number(totalRevenue)
      }
    });
  } catch (error: any) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Update sponsor bonus amount
export const updateSponsorBonus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) < 0) {
      res.status(400).json({
        success: false,
        message: "Valid bonus amount is required"
      });
      return;
    }

    const bonusAmount = Number(amount);

    // Update sponsor bonus in the first admin config record
    const config = await AdminConfig.findOne({
      order: [['id', 'ASC']]
    });

    if (config) {
      await config.update({
        sponsorBonus: bonusAmount
      });
    } else {
      // Create a new config if none exists
      await AdminConfig.create({
        key: 'sponsor-bonus',
        value: bonusAmount.toString(),
        description: 'Sponsor bonus amount in rupees when referred user buys a plan',
        category: 'payment',
        sponsorBonus: bonusAmount
      });
    }

    res.json({
      success: true,
      message: "Sponsor bonus amount updated successfully",
      data: {
        sponsorBonus: bonusAmount
      }
    });
  } catch (error: any) {
    console.error("Update sponsor bonus error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Get sponsor bonus amount
export const getSponsorBonus = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await AdminConfig.findOne({
      order: [['id', 'ASC']]
    });
console.log("config", config);

    const sponsorBonus = config ? Number(config.sponsorBonus) : 500.00;

    res.json({
      success: true,
      data: {
        sponsorBonus
      }
    });
  } catch (error: any) {
    console.error("Get sponsor bonus error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Update TDS percentage
export const updateTds = async (req: Request, res: Response): Promise<void> => {
  try {
    const { percentage } = req.body;

    if (!percentage || isNaN(Number(percentage)) || Number(percentage) < 0 || Number(percentage) > 100) {
      res.status(400).json({
        success: false,
        message: "Valid TDS percentage is required (0-100%)"
      });
      return;
    }

    const tdsPercentage = Number(percentage);

    // Update TDS in the first admin config record
    const config = await AdminConfig.findOne({
      order: [['id', 'ASC']]
    });

    if (config) {
      await config.update({
        tds: tdsPercentage
      });
    } else {
      // Create a new config if none exists
      await AdminConfig.create({
        key: 'tds-config',
        value: tdsPercentage.toString(),
        description: 'TDS percentage for withdrawals',
        category: 'payment',
        tds: tdsPercentage
      });
    }

    res.json({
      success: true,
      message: "TDS percentage updated successfully",
      data: {
        tds: tdsPercentage
      }
    });
  } catch (error: any) {
    console.error("Update TDS error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Get TDS percentage
export const getTds = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await AdminConfig.findOne({
      order: [['id', 'ASC']]
    });

    const tds = config ? Number(config.tds) : 5.00;

    res.json({
      success: true,
      data: {
        tds
      }
    });
  } catch (error: any) {
    console.error("Get TDS error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};