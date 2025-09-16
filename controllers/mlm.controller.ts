import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { Op } from "sequelize";
import { AdvancedBVMatchingService } from "../services/advancedBvMatchingService.ts";

// Get user's referrals with basic info
export const getMyReferrals = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    // Get current user's username
    const currentUser = await User.findByPk(userId);
    if (!currentUser || !currentUser.username) {
      res.status(404).json({ 
        success: false,
        message: "User or username not found" 
      });
      return;
    }

    // Get referrals
    const referrals = await User.findAll({
      where: { sponsorId: currentUser.username },
      attributes: [
        'id',
        'name',
        'email',
        'username',
        'sponsorId',
        'position',
        'isActive',
        'createdAt',
      ],
      order: [['createdAt', 'DESC']],
    });

    // Separate referrals by position
    const leftSideReferrals = referrals.filter(ref => ref.position === 'left');
    const rightSideReferrals = referrals.filter(ref => ref.position === 'right');

    // Get counts
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(ref => ref.isActive).length;
    const inactiveReferrals = totalReferrals - activeReferrals;

    res.json({
      success: true,
      data: {
        myUsername: currentUser.username,
        totalReferrals,
        activeReferrals,
        inactiveReferrals,
        leftSide: {
          total: leftSideReferrals.length,
          active: leftSideReferrals.filter(ref => ref.isActive).length,
          inactive: leftSideReferrals.filter(ref => !ref.isActive).length,
          referrals: leftSideReferrals.map(ref => ({
            id: ref.id,
            name: ref.name,
            email: ref.email,
            username: ref.username,
            sponsorId: ref.sponsorId,
            position: ref.position,
            isActive: ref.isActive,
            joinedAt: ref.createdAt
          }))
        },
        rightSide: {
          total: rightSideReferrals.length,
          active: rightSideReferrals.filter(ref => ref.isActive).length,
          inactive: rightSideReferrals.filter(ref => !ref.isActive).length,
          referrals: rightSideReferrals.map(ref => ({
            id: ref.id,
            name: ref.name,
            email: ref.email,
            username: ref.username,
            sponsorId: ref.sponsorId,
            position: ref.position,
            isActive: ref.isActive,
            joinedAt: ref.createdAt
          }))
        },
        referrals: referrals.map(ref => ({
          id: ref.id,
          name: ref.name,
          email: ref.email,
          username: ref.username,
          sponsorId: ref.sponsorId,
          position: ref.position,
          isActive: ref.isActive,
          joinedAt: ref.createdAt
        }))
      }
    });
  } catch (error: any) {
    console.error("Get referrals error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get full referral tree for a user
export const getReferralTree = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    // Get current user's info
    const currentUser = await User.findByPk(userId);
    if (!currentUser || !currentUser.username) {
      res.status(404).json({ 
        success: false,
        message: "User or username not found" 
      });
      return;
    }

    // Get the full referral tree
    const tree = await buildReferralTree(currentUser.username);

    res.json({
      success: true,
      data: {
        myUsername: currentUser.username,
        myName: currentUser.name,
        tree
      }
    });
  } catch (error: any) {
    console.error("Get referral tree error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get referral details and their nested tree
export const getReferralDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { referralId } = req.params;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    // Get current user's username
    const currentUser = await User.findByPk(userId);
    if (!currentUser || !currentUser.username) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    // Get the specific referral
    const referral = await User.findOne({
      where: { 
        id: referralId,
        sponsorId: currentUser.username // Ensure it's actually a referral of current user
      },
      attributes: [
        'id',
        'name',
        'email',
        'username',
        'sponsorId',
        'position',
        'isActive',
        'createdAt',
      ]
    });

    if (!referral) {
      res.status(404).json({ 
        success: false,
        message: "Referral not found" 
      });
      return;
    }

    // Get the referral's nested tree
    const nestedTree = await buildReferralTree(referral.username!);

    res.json({
      success: true,
      data: {
        referral: {
          id: referral.id,
          name: referral.name,
          email: referral.email,
          username: referral.username,
          sponsorId: referral.sponsorId,
          position: referral.position,
          isActive: referral.isActive,
          joinedAt: referral.createdAt
        },
        nestedTree
      }
    });
  } catch (error: any) {
    console.error("Get referral details error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Helper function to build referral tree recursively
async function buildReferralTree(username: string, maxDepth: number = 10, currentDepth: number = 0): Promise<any> {
  if (currentDepth >= maxDepth) {
    return {
      leftSide: { count: 0, activeCount: 0, referrals: [] },
      rightSide: { count: 0, activeCount: 0, referrals: [] },
      totalCount: 0,
      totalActiveCount: 0
    };
  }

  // Get direct referrals
  const referrals = await User.findAll({
    where: { sponsorId: username },
    attributes: [
      'id',
      'name',
      'email',
      'username',
      'sponsorId',
      'position',
      'isActive',
      'createdAt',
    ],
    order: [['createdAt', 'DESC']],
  });

  // Separate by position
  const leftSideReferrals = referrals.filter(ref => ref.position === 'left');
  const rightSideReferrals = referrals.filter(ref => ref.position === 'right');

  // Build nested trees for each referral
  const leftSideWithNested = await Promise.all(
    leftSideReferrals.map(async (referral) => {
      const nestedTree = await buildReferralTree(referral.username!, maxDepth, currentDepth + 1);
      return {
        id: referral.id,
        name: referral.name,
        email: referral.email,
        username: referral.username,
        sponsorId: referral.sponsorId,
        position: referral.position,
        isActive: referral.isActive,
        joinedAt: referral.createdAt,
        referrals: nestedTree
      };
    })
  );

  const rightSideWithNested = await Promise.all(
    rightSideReferrals.map(async (referral) => {
      const nestedTree = await buildReferralTree(referral.username!, maxDepth, currentDepth + 1);
      return {
        id: referral.id,
        name: referral.name,
        email: referral.email,
        username: referral.username,
        sponsorId: referral.sponsorId,
        position: referral.position,
        isActive: referral.isActive,
        joinedAt: referral.createdAt,
        referrals: nestedTree
      };
    })
  );

  // Calculate counts including nested
  const leftCount = leftSideWithNested.reduce((sum, ref) => sum + 1 + (ref.referrals?.totalCount || 0), 0);
  const leftActiveCount = leftSideWithNested.reduce((sum, ref) => sum + (ref.isActive ? 1 : 0) + (ref.referrals?.totalActiveCount || 0), 0);
  
  const rightCount = rightSideWithNested.reduce((sum, ref) => sum + 1 + (ref.referrals?.totalCount || 0), 0);
  const rightActiveCount = rightSideWithNested.reduce((sum, ref) => sum + (ref.isActive ? 1 : 0) + (ref.referrals?.totalActiveCount || 0), 0);

  return {
    leftSide: {
      count: leftCount,
      activeCount: leftActiveCount,
      referrals: leftSideWithNested
    },
    rightSide: {
      count: rightCount,
      activeCount: rightActiveCount,
      referrals: rightSideWithNested
    },
    totalCount: leftCount + rightCount,
    totalActiveCount: leftActiveCount + rightActiveCount
  };
}

// Get referral statistics
export const getReferralStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    // Get current user's username
    const currentUser = await User.findByPk(userId);
    if (!currentUser || !currentUser.username) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    // Get all referrals in the tree (recursive)
    const allReferrals = await getAllReferralsInTree(currentUser.username);

    // Calculate statistics
    const totalReferrals = allReferrals.length;
    const activeReferrals = allReferrals.filter(ref => ref.isActive).length;
    const leftSideReferrals = allReferrals.filter(ref => ref.position === 'left');
    const rightSideReferrals = allReferrals.filter(ref => ref.position === 'right');

    res.json({
      success: true,
      data: {
        totalReferrals,
        activeReferrals,
        inactiveReferrals: totalReferrals - activeReferrals,
        leftSide: {
          total: leftSideReferrals.length,
          active: leftSideReferrals.filter(ref => ref.isActive).length,
          inactive: leftSideReferrals.filter(ref => !ref.isActive).length
        },
        rightSide: {
          total: rightSideReferrals.length,
          active: rightSideReferrals.filter(ref => ref.isActive).length,
          inactive: rightSideReferrals.filter(ref => !ref.isActive).length
        }
      }
    });
  } catch (error: any) {
    console.error("Get referral stats error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Helper function to get all referrals in tree (flattened)
async function getAllReferralsInTree(username: string, visited: Set<string> = new Set()): Promise<any[]> {
  if (visited.has(username)) {
    return []; // Prevent infinite loops
  }
  visited.add(username);

  const referrals = await User.findAll({
    where: { sponsorId: username },
    attributes: [
      'id',
      'name',
      'email',
      'username',
      'sponsorId',
      'position',
      'isActive',
      'createdAt',
    ]
  });

  let allReferrals = [...referrals];

  // Recursively get referrals of referrals
  for (const referral of referrals) {
    const nestedReferrals = await getAllReferralsInTree(referral.username!, visited);
    allReferrals = allReferrals.concat(nestedReferrals);
  }

  return allReferrals;
}

// Check position availability for a sponsor
export const checkPositionAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sponsorId } = req.query;
    
    if (!sponsorId) {
      res.status(400).json({ 
        success: false,
        message: "Sponsor ID is required" 
      });
      return;
    }

    // Check if sponsor exists
    const sponsor = await User.findOne({
      where: { username: sponsorId as string }
    });

    if (!sponsor) {
      res.status(404).json({ 
        success: false,
        message: "Sponsor not found" 
      });
      return;
    }

    // Check available positions
    const leftPosition = await User.findOne({
      where: { 
        sponsorId: sponsorId as string,
        position: 'left'
      }
    });

    const rightPosition = await User.findOne({
      where: { 
        sponsorId: sponsorId as string,
        position: 'right'
      }
    });

    res.json({
      success: true,
      data: {
        sponsorId,
        leftAvailable: !leftPosition,
        rightAvailable: !rightPosition,
        positions: {
          left: leftPosition ? 'taken' : 'available',
          right: rightPosition ? 'taken' : 'available'
        }
      }
    });
  } catch (error: any) {
    console.error("Check position availability error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get available positions for a sponsor
export const getAvailablePositions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sponsorId } = req.params;
    
    if (!sponsorId) {
      res.status(400).json({ 
        success: false,
        message: "Sponsor ID is required" 
      });
      return;
    }

    // Check if sponsor exists
    const sponsor = await User.findOne({
      where: { username: sponsorId }
    });

    if (!sponsor) {
      res.status(404).json({ 
        success: false,
        message: "Sponsor not found" 
      });
      return;
    }

    // Get positions
    const leftPosition = await User.findOne({
      where: { 
        sponsorId: sponsorId,
        position: 'left'
      }
    });

    const rightPosition = await User.findOne({
      where: { 
        sponsorId: sponsorId,
        position: 'right'
      }
    });

    const availablePositions = [];
    if (!leftPosition) availablePositions.push('left');
    if (!rightPosition) availablePositions.push('right');

    res.json({
      success: true,
      data: {
        sponsorId,
        availablePositions,
        leftAvailable: !leftPosition,
        rightAvailable: !rightPosition
      }
    });
  } catch (error: any) {
    console.error("Get available positions error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get user tree (admin function)
export const getUserTree = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId);
    if (!user || !user.username) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    const tree = await buildReferralTree(user.username);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email
        },
        tree
      }
    });
  } catch (error: any) {
    console.error("Get user tree error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get user position
export const getUserPosition = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    res.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        sponsorId: user.sponsorId,
        position: user.position,
        isActive: user.isActive
      }
    });
  } catch (error: any) {
    console.error("Get user position error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get user downline stats
export const getUserDownlineStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId);
    if (!user || !user.username) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    const allReferrals = await getAllReferralsInTree(user.username);
    
    const totalReferrals = allReferrals.length;
    const activeReferrals = allReferrals.filter(ref => ref.isActive).length;
    const leftSideReferrals = allReferrals.filter(ref => ref.position === 'left');
    const rightSideReferrals = allReferrals.filter(ref => ref.position === 'right');

    res.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        totalReferrals,
        activeReferrals,
        inactiveReferrals: totalReferrals - activeReferrals,
        leftSide: {
          total: leftSideReferrals.length,
          active: leftSideReferrals.filter(ref => ref.isActive).length,
          inactive: leftSideReferrals.filter(ref => !ref.isActive).length
        },
        rightSide: {
          total: rightSideReferrals.length,
          active: rightSideReferrals.filter(ref => ref.isActive).length,
          inactive: rightSideReferrals.filter(ref => !ref.isActive).length
        }
      }
    });
  } catch (error: any) {
    console.error("Get user downline stats error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get user referrals by position
export const getUserReferrals = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const currentUser = await User.findByPk(userId);
    if (!currentUser || !currentUser.username) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    const referrals = await User.findAll({
      where: { sponsorId: currentUser.username },
      attributes: [
        'id',
        'name',
        'email',
        'username',
        'sponsorId',
        'position',
        'isActive',
        'createdAt',
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: {
        myUsername: currentUser.username,
        referrals: referrals.map(ref => ({
          id: ref.id,
          name: ref.name,
          email: ref.email,
          username: ref.username,
          sponsorId: ref.sponsorId,
          position: ref.position,
          isActive: ref.isActive,
          joinedAt: ref.createdAt
        }))
      }
    });
  } catch (error: any) {
    console.error("Get user referrals error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get user referrals by specific position
export const getUserReferralsByPosition = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { position } = req.params;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    if (!['left', 'right'].includes(position)) {
      res.status(400).json({ 
        success: false,
        message: "Position must be 'left' or 'right'" 
      });
      return;
    }

    const currentUser = await User.findByPk(userId);
    if (!currentUser || !currentUser.username) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    const referrals = await User.findAll({
      where: { 
        sponsorId: currentUser.username,
        position: position
      },
      attributes: [
        'id',
        'name',
        'email',
        'username',
        'sponsorId',
        'position',
        'isActive',
        'createdAt',
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: {
        myUsername: currentUser.username,
        position,
        referrals: referrals.map(ref => ({
          id: ref.id,
          name: ref.name,
          email: ref.email,
          username: ref.username,
          sponsorId: ref.sponsorId,
          position: ref.position,
          isActive: ref.isActive,
          joinedAt: ref.createdAt
        }))
      }
    });
  } catch (error: any) {
    console.error("Get user referrals by position error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get all users with sponsors (admin function)
export const getAllUsersWithSponsors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause: any = {};
    
    // Add search filter
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } }
      ];
    }

    // Add status filter
    if (status !== 'all') {
      whereClause.isActive = status === 'active';
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'email',
        'username',
        'sponsorId',
        'position',
        'isActive',
        'createdAt',
      ],
      include: [
        {
          model: User,
          as: 'sponsor',
          attributes: ['id', 'name', 'username', 'email'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          sponsorId: user.sponsorId,
          position: user.position,
          isActive: user.isActive,
          joinedAt: user.createdAt,
          sponsor: (user as any).sponsor ? {
            id: (user as any).sponsor.id,
            name: (user as any).sponsor.name,
            username: (user as any).sponsor.username,
            email: (user as any).sponsor.email
          } : null
        })),
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / Number(limit)),
          totalUsers: count,
          hasNext: offset + Number(limit) < count,
          hasPrev: Number(page) > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get all users with sponsors error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};