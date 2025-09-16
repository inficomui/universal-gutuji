import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { UserBV } from "../models/UserBv.ts";
import { BVLog } from "../models/BvLogs.ts";
import { Op } from "sequelize";

// Get logged-in user's BV data
export const getMyBV = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    // Get user info
    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    // Get or create user's BV record
    let userBV = await UserBV.findOne({ where: { userId } });
    if (!userBV) {
      userBV = await UserBV.create({
        userId,
        leftBV: 0,
        rightBV: 0,
        carryLeft: 0,
        carryRight: 0
      });
    }

    // Get BV logs for this user
    const bvLogs = await BVLog.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Calculate totals
    const totalBV = Number(userBV.leftBV) + Number(userBV.rightBV);
    const canMatch = Number(userBV.leftBV) > 0 && Number(userBV.rightBV) > 0;
    const matchableAmount = canMatch ? Math.min(Number(userBV.leftBV), Number(userBV.rightBV)) : 0;
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email
        },
        bv: {
          leftBV: Number(userBV.leftBV),
          rightBV: Number(userBV.rightBV),
          carryLeft: Number(userBV.carryLeft),
          carryRight: Number(userBV.carryRight),
          totalBV,
          canMatch,
          matchableAmount
        },
        recentLogs: bvLogs.map(log => ({
          id: log.id,
          points: Number(log.points),
          matched: log.matched,
          createdAt: log.createdAt,
          sourceUserId: log.sourceUserId
        }))
      }
    });
  } catch (error: any) {
    console.error("Get my BV error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Get BV tree for logged-in user
export const getMyBVTree = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    // Get user info
    const user = await User.findByPk(userId);
    if (!user || !user.username) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    // Build BV tree
    const bvTree = await buildBVTree(user.username);
    
    res.json({
      success: true,
      data: {
        myUsername: user.username,
        myName: user.name,
        tree: bvTree
      }
    });
  } catch (error: any) {
    console.error("Get my BV tree error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Get specific user's BV data by username
export const getUserBV = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;
    const currentUserId = (req as any).user?.userId;
    
    if (!currentUserId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    // Get the target user
    const targetUser = await User.findOne({ where: { username } });
    if (!targetUser) {
      res.status(404).json({ 
      success: false,
        message: "User not found" 
      });
      return;
    }

    // Check if current user has access to this user's BV (must be in their referral tree)
    const hasAccess = await checkUserAccess(currentUserId, targetUser.id);
    if (!hasAccess) {
      res.status(403).json({ 
        success: false,
        message: "Access denied. You can only view BV of users in your referral tree." 
      });
      return;
    }

    // Get user's BV record
    let userBV = await UserBV.findOne({ where: { userId: targetUser.id } });
    if (!userBV) {
      userBV = await UserBV.create({
        userId: targetUser.id,
        leftBV: 0,
        rightBV: 0,
        carryLeft: 0,
        carryRight: 0
      });
    }

    // Get BV logs
    const bvLogs = await BVLog.findAll({
      where: { userId: targetUser.id },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Calculate totals
    const totalBV = Number(userBV.leftBV) + Number(userBV.rightBV);
    const canMatch = Number(userBV.leftBV) > 0 && Number(userBV.rightBV) > 0;
    const matchableAmount = canMatch ? Math.min(Number(userBV.leftBV), Number(userBV.rightBV)) : 0;
    
    res.json({
      success: true,
      data: {
        user: {
          id: targetUser.id,
          name: targetUser.name,
          username: targetUser.username,
          email: targetUser.email
        },
        bv: {
          leftBV: Number(userBV.leftBV),
          rightBV: Number(userBV.rightBV),
          carryLeft: Number(userBV.carryLeft),
          carryRight: Number(userBV.carryRight),
          totalBV,
          canMatch,
          matchableAmount
        },
        recentLogs: bvLogs.map(log => ({
          id: log.id,
          points: Number(log.points),
          matched: log.matched,
          createdAt: log.createdAt,
          sourceUserId: log.sourceUserId
        }))
      }
    });
  } catch (error: any) {
    console.error("Get user BV error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Get BV tree for specific user by username
export const getUserBVTree = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;
    const currentUserId = (req as any).user?.userId;
    
    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    // Get the target user
    const targetUser = await User.findOne({ where: { username } });
    if (!targetUser) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }
    
    // Check if current user has access to this user's BV tree
    const hasAccess = await checkUserAccess(currentUserId, targetUser.id);
    if (!hasAccess) {
      res.status(403).json({ 
        success: false,
        message: "Access denied. You can only view BV trees of users in your referral tree." 
      });
      return;
    }

    // Build BV tree for the target user
    const bvTree = await buildBVTree(targetUser.username!);

    res.json({
      success: true,
      data: {
        myUsername: targetUser.username,
        myName: targetUser.name,
        tree: bvTree
      }
    });
  } catch (error: any) {
    console.error("Get user BV tree error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Helper function to build BV tree recursively
async function buildBVTree(username: string, maxDepth: number = 10, currentDepth: number = 0): Promise<any> {
  if (currentDepth >= maxDepth) {
    return {
      leftSide: { count: 0, totalBV: 0, referrals: [] },
      rightSide: { count: 0, totalBV: 0, referrals: [] },
      totalCount: 0,
      totalBV: 0
    };
  }

  // Get user's BV data
  const user = await User.findOne({ where: { username } });
  if (!user) {
    return {
      leftSide: { count: 0, totalBV: 0, referrals: [] },
      rightSide: { count: 0, totalBV: 0, referrals: [] },
      totalCount: 0,
      totalBV: 0
    };
  }

  // Get user's BV record
  let userBV = await UserBV.findOne({ where: { userId: user.id } });
  if (!userBV) {
    userBV = await UserBV.create({
      userId: user.id,
      leftBV: 0,
      rightBV: 0,
      carryLeft: 0,
      carryRight: 0
    });
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
  const leftSideWithBV = await Promise.all(
    leftSideReferrals.map(async (referral) => {
      const nestedTree = await buildBVTree(referral.username!, maxDepth, currentDepth + 1);
      return {
        id: referral.id,
        name: referral.name,
        email: referral.email,
        username: referral.username,
        sponsorId: referral.sponsorId,
        position: referral.position,
        isActive: referral.isActive,
        joinedAt: referral.createdAt,
        bv: nestedTree
      };
    })
  );

  const rightSideWithBV = await Promise.all(
    rightSideReferrals.map(async (referral) => {
      const nestedTree = await buildBVTree(referral.username!, maxDepth, currentDepth + 1);
      return {
        id: referral.id,
        name: referral.name,
        email: referral.email,
        username: referral.username,
        sponsorId: referral.sponsorId,
        position: referral.position,
        isActive: referral.isActive,
        joinedAt: referral.createdAt,
        bv: nestedTree
      };
    })
  );

  // Calculate BV totals including nested
  const leftTotalBV = leftSideWithBV.reduce((sum, ref) => sum + (ref.bv?.totalBV || 0), 0);
  const rightTotalBV = rightSideWithBV.reduce((sum, ref) => sum + (ref.bv?.totalBV || 0), 0);

  return {
    leftSide: {
      count: leftSideWithBV.length,
      totalBV: leftTotalBV,
      referrals: leftSideWithBV
    },
    rightSide: {
      count: rightSideWithBV.length,
      totalBV: rightTotalBV,
      referrals: rightSideWithBV
    },
    totalCount: leftSideWithBV.length + rightSideWithBV.length,
    totalBV: leftTotalBV + rightTotalBV,
    myBV: {
      leftBV: Number(userBV.leftBV),
      rightBV: Number(userBV.rightBV),
      carryLeft: Number(userBV.carryLeft),
      carryRight: Number(userBV.carryRight),
      totalBV: Number(userBV.leftBV) + Number(userBV.rightBV)
    }
  };
}

// Helper function to check if current user has access to target user's data
async function checkUserAccess(currentUserId: number, targetUserId: number): Promise<boolean> {
  // User can always access their own data
  if (currentUserId === targetUserId) {
    return true;
  }

  // Get current user's username
  const currentUser = await User.findByPk(currentUserId);
  if (!currentUser || !currentUser.username) {
    return false;
  }

  // Check if target user is in current user's referral tree
  const allReferrals = await getAllReferralsInTree(currentUser.username);
  return allReferrals.some(ref => ref.id === targetUserId);
}

// Helper function to get all referrals in tree (flattened)
async function getAllReferralsInTree(username: string, visited: Set<string> = new Set()): Promise<any[]> {
  if (visited.has(username)) {
    return []; // Prevent infinite loops
  }
  visited.add(username);

  const referrals = await User.findAll({
    where: { sponsorId: username },
    attributes: ['id', 'name', 'username', 'position', 'isActive']
  });

  let allReferrals = [...referrals];

  // Recursively get referrals of referrals
  for (const referral of referrals) {
    const nestedReferrals = await getAllReferralsInTree(referral.username!, visited);
    allReferrals = allReferrals.concat(nestedReferrals);
  }

  return allReferrals;
}

// Get BV statistics for logged-in user
export const getBVStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }
    
    // Get user info
    const user = await User.findByPk(userId);
    if (!user || !user.username) {
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    // Get all referrals in tree
    const allReferrals = await getAllReferralsInTree(user.username);
    
    // Get BV data for all referrals
    const referralIds = allReferrals.map(ref => ref.id);
    const bvRecords = await UserBV.findAll({
      where: { userId: { [Op.in]: referralIds } }
    });

    // Calculate statistics
    const totalLeftBV = bvRecords.reduce((sum, bv) => sum + Number(bv.leftBV), 0);
    const totalRightBV = bvRecords.reduce((sum, bv) => sum + Number(bv.rightBV), 0);
    const totalBV = totalLeftBV + totalRightBV;

    // Get matching statistics
    const matchingPairs = bvRecords.filter(bv => 
      Number(bv.leftBV) > 0 && Number(bv.rightBV) > 0
    ).length;

    res.json({
      success: true,
      data: {
        totalReferrals: allReferrals.length,
        totalLeftBV,
        totalRightBV,
        totalBV,
        matchingPairs,
        averageBVPerUser: allReferrals.length > 0 ? totalBV / allReferrals.length : 0
      }
    });
  } catch (error: any) {
    console.error("Get BV stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// Get BV logs for logged-in user and their referrals
export const getBVLogsUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user || !user.username) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    // Get user's own BV logs
    const userBVLogs = await BVLog.findAll({
      where: { userId: userId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    // Get source user IDs from user BV logs
    const userSourceIds = userBVLogs
      .map(log => log.sourceUserId)
      .filter(id => id !== null) as number[];

    // Fetch source user data
    const userSourceUsers = userSourceIds.length > 0 ? await User.findAll({
      where: { id: { [Op.in]: userSourceIds } },
      attributes: ['id', 'name', 'username', 'email']
    }) : [];

    // Create source user lookup map
    const userSourceUserMap = new Map(userSourceUsers.map(user => [user.id, user]));

    // Get all referrals in the user's tree
    const allReferrals = await getAllReferralsInTree(user.username);
    const referralIds = allReferrals.map(ref => ref.id);

    // Get BV logs for all referrals
    const referralBVLogs = referralIds.length > 0 ? await BVLog.findAll({
      where: { userId: { [Op.in]: referralIds } },
      order: [['createdAt', 'DESC']],
      limit: 100
    }) : [];

    // Get source user IDs from referral BV logs
    const referralSourceIds = referralBVLogs
      .map(log => log.sourceUserId)
      .filter(id => id !== null) as number[];

    // Fetch source user data for referrals
    const referralSourceUsers = referralSourceIds.length > 0 ? await User.findAll({
      where: { id: { [Op.in]: referralSourceIds } },
      attributes: ['id', 'name', 'username', 'email']
    }) : [];

    // Create source user lookup map for referrals
    const referralSourceUserMap = new Map(referralSourceUsers.map(user => [user.id, user]));

    // Calculate totals
    const userTotalBV = userBVLogs.reduce((sum, log) => sum + Number(log.points), 0);
    const userMatchedBV = userBVLogs
      .filter(log => log.matched)
      .reduce((sum, log) => sum + Number(log.points), 0);
    const userUnmatchedBV = userTotalBV - userMatchedBV;

    const referralTotalBV = referralBVLogs.reduce((sum, log) => sum + Number(log.points), 0);
    const referralMatchedBV = referralBVLogs
      .filter(log => log.matched)
      .reduce((sum, log) => sum + Number(log.points), 0);
    const referralUnmatchedBV = referralTotalBV - referralMatchedBV;

    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          name: user.name,
          totalBV: userTotalBV,
          matchedBV: userMatchedBV,
          unmatchedBV: userUnmatchedBV,
          logs: userBVLogs.map(log => ({
            id: log.id,
            points: Number(log.points),
            matched: log.matched,
            sourceUserId: log.sourceUserId,
            sourceUser: log.sourceUserId ? userSourceUserMap.get(log.sourceUserId) ? {
              id: userSourceUserMap.get(log.sourceUserId)!.id,
              name: userSourceUserMap.get(log.sourceUserId)!.name,
              username: userSourceUserMap.get(log.sourceUserId)!.username,
              email: userSourceUserMap.get(log.sourceUserId)!.email
            } : null : null,
            createdAt: log.createdAt
          }))
        },
        referrals: {
          totalReferrals: allReferrals.length,
          totalBV: referralTotalBV,
          matchedBV: referralMatchedBV,
          unmatchedBV: referralUnmatchedBV,
          logs: referralBVLogs.map(log => ({
            id: log.id,
            points: Number(log.points),
            matched: log.matched,
            sourceUserId: log.sourceUserId,
            sourceUser: log.sourceUserId ? referralSourceUserMap.get(log.sourceUserId) ? {
              id: referralSourceUserMap.get(log.sourceUserId)!.id,
              name: referralSourceUserMap.get(log.sourceUserId)!.name,
              username: referralSourceUserMap.get(log.sourceUserId)!.username,
              email: referralSourceUserMap.get(log.sourceUserId)!.email
            } : null : null,
            createdAt: log.createdAt
          }))
        },
        summary: {
          totalBV: userTotalBV + referralTotalBV,
          totalMatched: userMatchedBV + referralMatchedBV,
          totalUnmatched: userUnmatchedBV + referralUnmatchedBV
        }
      }
    });
  } catch (error: any) {
    console.error("Get BV logs user error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};