import { User } from '../models/User.ts';
import { UserBV } from '../models/UserBv.ts';
import { BVLog } from '../models/BvLogs.ts';
import { Plan } from '../models/Plan.ts';
import { PlanRequest } from '../models/PlanRequest.ts';
import { sequelize } from '../utils/db.ts';
import { Transaction, Op } from 'sequelize';

export interface BVMatchResult {
  success: boolean;
  message: string;
  matches: BVMatch[];
  totalBonusEarned: number;
}

export interface BVMatch {
  userId: number;
  userName: string;
  matchedBv: number;
  bonusEarned: number;
  leftBvBefore: number;
  rightBvBefore: number;
  leftBvAfter: number;
  rightBvAfter: number;
  level: number;
}

export class AdvancedBVMatchingService {
  private static readonly DEFAULT_BV_PER_REFERRAL = 50;
  private static readonly MAX_MATCHING_LEVELS = 10; // Prevent infinite loops

  /**
   * Process BV matching when a plan request is approved
   */
  static async processBVMatching(userId: number, planId: number): Promise<BVMatchResult> {
    const transaction = await sequelize.transaction();
    
    try {
      // Get the user and their plan
      const user = await User.findByPk(userId, { transaction });
      const plan = await Plan.findByPk(planId, { transaction });
      
      if (!user || !plan) {
        await transaction.rollback();
        return {
          success: false,
          message: 'User or plan not found',
          matches: [],
          totalBonusEarned: 0
        };
      }

      const planBv = Number(plan.bvValue) || 0;
      
      // Add BV to user's BV record
      await this.addBVToUser(userId, planBv, transaction);
      
      // Process matching up the referral tree
      const matchResult = await this.processMatchingUpTreeInternal(userId, planBv, transaction);
      
      await transaction.commit();
      
      return {
        success: true,
        message: `BV matching processed. ${matchResult.matches.length} matches found.`,
        matches: matchResult.matches,
        totalBonusEarned: matchResult.totalBonusEarned
      };
    } catch (error) {
      await transaction.rollback();
      console.error('BV matching error:', error);
      return {
        success: false,
        message: 'Error processing BV matching',
        matches: [],
        totalBonusEarned: 0
      };
    }
  }

  /**
   * Add BV to sponsor when a new user registers
   */
  static async addBVToSponsor(sponsorUsername: string, bvAmount: number): Promise<void> {
    const transaction = await sequelize.transaction();
    
    try {
      // Find the sponsor by username
      const sponsor = await User.findOne({ 
        where: { username: sponsorUsername }, 
        transaction 
      });
      
      if (!sponsor) {
        throw new Error(`Sponsor with username ${sponsorUsername} not found`);
      }

      // Get or create sponsor's BV record
      let sponsorBV = await UserBV.findOne({ 
        where: { userId: sponsor.id }, 
        transaction 
      });
      
      if (!sponsorBV) {
        sponsorBV = await UserBV.create({
          userId: sponsor.id,
          leftBV: 0,
          rightBV: 0,
          carryLeft: 0,
          carryRight: 0
        }, { transaction });
      }

      // Add BV to the appropriate side based on the new user's position
      // We need to find the new user to determine their position
      const newUser = await User.findOne({
        where: { sponsorId: sponsorUsername },
        order: [['createdAt', 'DESC']],
        transaction
      });

      if (newUser && newUser.position) {
        if (newUser.position === 'left') {
          await sponsorBV.update({
            leftBV: Number(sponsorBV.leftBV) + bvAmount
          }, { transaction });
        } else if (newUser.position === 'right') {
          await sponsorBV.update({
            rightBV: Number(sponsorBV.rightBV) + bvAmount
          }, { transaction });
        }

        // Log the BV addition
        await BVLog.create({
          userId: sponsor.id,
          sourceUserId: newUser.id,
          points: bvAmount,
          matched: false
        }, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Add BV to sponsor with explicit position information
   */
  static async addBVToSponsorWithPosition(
    sponsorUsername: string, 
    bvAmount: number, 
    position: 'left' | 'right'
  ): Promise<void> {
    const transaction = await sequelize.transaction();
    
    try {
      console.log(`🔧 Adding ${bvAmount} BV to ${sponsorUsername} on ${position} side`);
      
      // Find the sponsor by username
      const sponsor = await User.findOne({ 
        where: { username: sponsorUsername }, 
        transaction 
      });
      
      if (!sponsor) {
        throw new Error(`Sponsor with username ${sponsorUsername} not found`);
      }

      console.log(`✅ Found sponsor: ${sponsor.name} (ID: ${sponsor.id})`);

      // Get or create sponsor's BV record
      let sponsorBV = await UserBV.findOne({ 
        where: { userId: sponsor.id }, 
        transaction 
      });
      
      if (!sponsorBV) {
        console.log(`📝 Creating new BV record for sponsor ${sponsor.id}`);
        sponsorBV = await UserBV.create({
          userId: sponsor.id,
          leftBV: 0,
          rightBV: 0,
          carryLeft: 0,
          carryRight: 0
        }, { transaction });
      } else {
        console.log(`📊 Current BV - Left: ${sponsorBV.leftBV}, Right: ${sponsorBV.rightBV}`);
      }

      // Add BV to the appropriate side based on position
      if (position === 'left') {
        const newLeftBV = Number(sponsorBV.leftBV) + bvAmount;
        console.log(`⬅️ Adding ${bvAmount} to left side: ${sponsorBV.leftBV} + ${bvAmount} = ${newLeftBV}`);
        await sponsorBV.update({
          leftBV: newLeftBV
        }, { transaction });
      } else if (position === 'right') {
        const newRightBV = Number(sponsorBV.rightBV) + bvAmount;
        console.log(`➡️ Adding ${bvAmount} to right side: ${sponsorBV.rightBV} + ${bvAmount} = ${newRightBV}`);
        await sponsorBV.update({
          rightBV: newRightBV
        }, { transaction });
      }

      // Find the new user to get their ID for logging
      const newUser = await User.findOne({
        where: { sponsorId: sponsorUsername, position },
        order: [['createdAt', 'DESC']],
        transaction
      });

      if (newUser) {
        console.log(`👤 Found new user for logging: ${newUser.name} (ID: ${newUser.id})`);
        // Log the BV addition
        await BVLog.create({
          userId: sponsor.id,
          sourceUserId: newUser.id,
          points: bvAmount,
          matched: false
        }, { transaction });
        console.log(`📝 Created BV log entry`);
      } else {
        console.log(`⚠️ Could not find new user for logging`);
      }

      await transaction.commit();
      console.log(`✅ BV addition completed successfully`);
    } catch (error) {
      await transaction.rollback();
      console.error(`❌ BV addition failed:`, error);
      throw error;
    }
  }

  /**
   * Add nested BV to entire upline chain (NEW METHOD)
   */
  static async addNestedBVToUpline(
    newUserId: number,
    bvAmount: number,
    position: 'left' | 'right'
  ): Promise<void> {
    const transaction = await sequelize.transaction();
    
    try {
      console.log(`🌳 Starting nested BV distribution for user ${newUserId}`);
      
      let currentUserId = newUserId;
      let level = 0;
      const maxLevels = 20; // Prevent infinite loops
      
      // Go up the entire referral chain
      while (currentUserId && level < maxLevels) {
        const currentUser = await User.findByPk(currentUserId, { transaction });
        if (!currentUser || !currentUser.sponsorId) {
          console.log(`🏁 Reached end of upline chain at level ${level}`);
          break;
        }

        const sponsor = await User.findOne({ 
          where: { username: currentUser.sponsorId }, 
          transaction 
        });
        
        if (!sponsor) {
          console.log(`⚠️ Sponsor not found: ${currentUser.sponsorId}`);
          break;
        }

        console.log(`📈 Level ${level + 1}: Adding ${bvAmount} BV to ${sponsor.name} (${sponsor.username})`);

        // Get or create sponsor's BV record
        let sponsorBV = await UserBV.findOne({ 
          where: { userId: sponsor.id }, 
          transaction 
        });
        
        if (!sponsorBV) {
          sponsorBV = await UserBV.create({
            userId: sponsor.id,
            leftBV: 0,
            rightBV: 0,
            carryLeft: 0,
            carryRight: 0
          }, { transaction });
        }

        // Add BV to the side where the new user is joining (same side for all upline)
        if (position === 'left') {
          const newLeftBV = Number(sponsorBV.leftBV) + bvAmount;
          const newCarryLeft = Number(sponsorBV.carryLeft) + bvAmount;
          await sponsorBV.update({
            leftBV: newLeftBV,      // Lifetime left BV (never decreases)
            carryLeft: newCarryLeft // Current left BV for matching
          }, { transaction });
          console.log(`⬅️ Added ${bvAmount} to LEFT side for ALL upline: ${sponsorBV.leftBV} → ${newLeftBV} (lifetime), ${sponsorBV.carryLeft} → ${newCarryLeft} (carry)`);
        } else if (position === 'right') {
          const newRightBV = Number(sponsorBV.rightBV) + bvAmount;
          const newCarryRight = Number(sponsorBV.carryRight) + bvAmount;
          await sponsorBV.update({
            rightBV: newRightBV,      // Lifetime right BV (never decreases)
            carryRight: newCarryRight // Current right BV for matching
          }, { transaction });
          console.log(`➡️ Added ${bvAmount} to RIGHT side for ALL upline: ${sponsorBV.rightBV} → ${newRightBV} (lifetime), ${sponsorBV.carryRight} → ${newCarryRight} (carry)`);
        }

        // Log the BV addition
        await BVLog.create({
          userId: sponsor.id,
          sourceUserId: newUserId,
          points: bvAmount,
          matched: false
        }, { transaction });

        // Move up to the next sponsor
        currentUserId = sponsor.id;
        level++;
      }

      await transaction.commit();
      console.log(`✅ Nested BV distribution completed for ${level} levels`);
    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Nested BV distribution failed:`, error);
      throw error;
    }
  }

  /**
   * Add BV to user's record
   */
  private static async addBVToUser(userId: number, bvAmount: number, transaction: Transaction): Promise<void> {
    // Get or create user's BV record
    let userBV = await UserBV.findOne({ where: { userId }, transaction });
    
    if (!userBV) {
      userBV = await UserBV.create({
        userId,
        leftBV: 0,
        rightBV: 0,
        carryLeft: 0,
        carryRight: 0
      }, { transaction });
    }

    // Add BV to the appropriate side based on user's position
    const user = await User.findByPk(userId, { transaction });
    if (!user || !user.sponsorId) return;

    const sponsor = await User.findOne({ where: { username: user.sponsorId }, transaction });
    if (!sponsor) return;

    // Find which side this user is on
    const leftReferral = await User.findOne({ 
      where: { sponsorId: sponsor.username, position: 'left' }, 
      transaction 
    });
    
    if (leftReferral && leftReferral.id === userId) {
      // User is on left side
      await userBV.update({
        leftBV: Number(userBV.leftBV) + bvAmount
      }, { transaction });
    } else {
      // User is on right side
      await userBV.update({
        rightBV: Number(userBV.rightBV) + bvAmount
      }, { transaction });
    }

    // Log the BV addition
    await BVLog.create({
      userId: sponsor.id,
      sourceUserId: userId,
      points: bvAmount,
      matched: false
    }, { transaction });
  }

  /**
   * Process BV matching up the tree (public method for registration)
   */
  static async processMatchingUpTree(
    userId: number, 
    bvAmount: number
  ): Promise<{ matches: BVMatch[]; totalBonusEarned: number }> {
    const transaction = await sequelize.transaction();
    
    try {
      const result = await this.processMatchingUpTreeInternal(userId, bvAmount, transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Process matching up the referral tree (internal method)
   */
  private static async processMatchingUpTreeInternal(
    userId: number, 
    bvAmount: number, 
    transaction: Transaction
  ): Promise<{ matches: BVMatch[]; totalBonusEarned: number }> {
    const matches: BVMatch[] = [];
    let totalBonusEarned = 0;
    let currentUserId = userId;
    let level = 0;

    // Go up the tree to find sponsors and process matches
    while (currentUserId && level < this.MAX_MATCHING_LEVELS) {
      const currentUser = await User.findByPk(currentUserId, { transaction });
      if (!currentUser || !currentUser.sponsorId) break;

      const sponsor = await User.findOne({ 
        where: { username: currentUser.sponsorId }, 
        transaction 
      });
      
      if (!sponsor) break;

      // Process match for this sponsor
      const matchResult = await this.processMatchForSponsor(sponsor.id, transaction);
      
      if (matchResult) {
        matches.push(matchResult);
        totalBonusEarned += matchResult.bonusEarned;
      }

      // Move up to the sponsor
      currentUserId = sponsor.id;
      level++;
    }

    return { matches, totalBonusEarned };
  }

  /**
   * Process match for a specific sponsor
   */
  private static async processMatchForSponsor(
    sponsorId: number, 
    transaction: Transaction
  ): Promise<BVMatch | null> {
    // Get sponsor's BV record
    let sponsorBV = await UserBV.findOne({ where: { userId: sponsorId }, transaction });
    
    if (!sponsorBV) {
      sponsorBV = await UserBV.create({
        userId: sponsorId,
        leftBV: 0,
        rightBV: 0,
        carryLeft: 0,
        carryRight: 0
      }, { transaction });
    }

    const leftBv = Number(sponsorBV.leftBV);
    const rightBv = Number(sponsorBV.rightBV);

    // Check if there's a match (both sides have BV)
    if (leftBv <= 0 || rightBv <= 0) {
      return null;
    }

    // Calculate matchable BV (minimum of both sides)
    const matchableBv = Math.min(leftBv, rightBv);
    
    if (matchableBv <= 0) {
      return null;
    }

    // Get sponsor's plan to determine bonus
    const sponsor = await User.findByPk(sponsorId, { transaction });
    if (!sponsor) return null;

    // Find sponsor's plan request
    const planRequest = await PlanRequest.findOne({
      where: { userId: sponsorId, status: 'approved' },
      include: [{ model: Plan, as: 'plan' }],
      order: [['createdAt', 'DESC']],
      transaction
    });

    const bonusAmount = planRequest ? Number((planRequest as any).plan?.bvValue) || 0 : 0;

    // Update sponsor's BV (deduct matched amount)
    const newLeftBv = leftBv - matchableBv;
    const newRightBv = rightBv - matchableBv;

    await sponsorBV.update({
      leftBV: newLeftBv,
      rightBV: newRightBv
    }, { transaction });

    // Mark BV logs as matched
    await this.markBVLogsAsMatched(sponsorId, matchableBv, transaction);

    // Add bonus to sponsor's total income and increment match count
    await this.addBonusToUser(sponsorId, bonusAmount, transaction);

    return {
      userId: sponsorId,
      userName: sponsor.name,
      matchedBv: matchableBv,
      bonusEarned: bonusAmount,
      leftBvBefore: leftBv,
      rightBvBefore: rightBv,
      leftBvAfter: newLeftBv,
      rightBvAfter: newRightBv,
      level: 0 // This would be calculated based on tree level
    };
  }

  /**
   * Mark BV logs as matched
   */
  private static async markBVLogsAsMatched(
    userId: number, 
    matchedAmount: number, 
    transaction: Transaction
  ): Promise<void> {
    // Get unmatched BV logs for this user
    const unmatchedLogs = await BVLog.findAll({
      where: { userId, matched: false },
      order: [['createdAt', 'ASC']],
      transaction
    });

    let remainingAmount = matchedAmount;
    
    for (const log of unmatchedLogs) {
      if (remainingAmount <= 0) break;
      
      const logAmount = Number(log.points);
      const toMatch = Math.min(logAmount, remainingAmount);
      
      await log.update({ matched: true }, { transaction });
      remainingAmount -= toMatch;
    }
  }

  /**
   * Add bonus to user's total income and increment match count
   */
  private static async addBonusToUser(
    userId: number, 
    bonusAmount: number, 
    transaction: Transaction
  ): Promise<void> {
    if (bonusAmount <= 0) return;

    const user = await User.findByPk(userId, { transaction });
    if (!user) return;

    // Add bonus to total income and increment match count
    const currentIncome = Number(user.totalIncome) || 0;
    const currentMatched = Number(user.totalMatched) || 0;

    await user.update({
      totalIncome: currentIncome + bonusAmount,
      totalMatched: currentMatched + 1
    }, { transaction });

    console.log(`💰 Added bonus ${bonusAmount} to user ${user.name} (ID: ${userId}). New total income: ${currentIncome + bonusAmount}, Total matches: ${currentMatched + 1}`);
  }

  /**
   * Get user's BV summary
   */
  static async getUserBVSummary(userId: number): Promise<{
    leftBV: number;
    rightBV: number;
    carryLeft: number;
    carryRight: number;
    totalBV: number;
    canMatch: boolean;
    matchableAmount: number;
  }> {
    const userBV = await UserBV.findOne({ where: { userId } });
    
    if (!userBV) {
      return {
        leftBV: 0,
        rightBV: 0,
        carryLeft: 0,
        carryRight: 0,
        totalBV: 0,
        canMatch: false,
        matchableAmount: 0
      };
    }

    const leftBV = Number(userBV.leftBV);
    const rightBV = Number(userBV.rightBV);
    const carryLeft = Number(userBV.carryLeft);
    const carryRight = Number(userBV.carryRight);
    const totalBV = leftBV + rightBV + carryLeft + carryRight;
    const canMatch = leftBV > 0 && rightBV > 0;
    const matchableAmount = canMatch ? Math.min(leftBV, rightBV) : 0;

    return {
      leftBV,
      rightBV,
      carryLeft,
      carryRight,
      totalBV,
      canMatch,
      matchableAmount
    };
  }

  /**
   * Get user's referral tree BV summary
   */
  static async getUserReferralTreeBV(userId: number): Promise<{
    leftSide: {
      totalBV: number;
      referralCount: number;
      referrals: Array<{ id: number; name: string; bv: number; position: string }>;
    };
    rightSide: {
      totalBV: number;
      referralCount: number;
      referrals: Array<{ id: number; name: string; bv: number; position: string }>;
    };
  }> {
    const user = await User.findByPk(userId);
    if (!user || !user.username) {
      return {
        leftSide: { totalBV: 0, referralCount: 0, referrals: [] },
        rightSide: { totalBV: 0, referralCount: 0, referrals: [] }
      };
    }

    // Get left side referrals
    const leftReferrals = await User.findAll({
      where: { sponsorId: user.username, position: 'left' }
    });

    // Get right side referrals
    const rightReferrals = await User.findAll({
      where: { sponsorId: user.username, position: 'right' }
    });

    // Get BV data for left side referrals
    const leftReferralIds = leftReferrals.map(ref => ref.id);
    const leftBVData = leftReferralIds.length > 0 ? await UserBV.findAll({
      where: { userId: { [Op.in]: leftReferralIds } }
    }) : [];

    // Get BV data for right side referrals
    const rightReferralIds = rightReferrals.map(ref => ref.id);
    const rightBVData = rightReferralIds.length > 0 ? await UserBV.findAll({
      where: { userId: { [Op.in]: rightReferralIds } }
    }) : [];

    // Create BV lookup maps
    const leftBVMap = new Map(leftBVData.map(bv => [bv.userId, bv]));
    const rightBVMap = new Map(rightBVData.map(bv => [bv.userId, bv]));

    const leftSide = {
      totalBV: leftReferrals.reduce((sum, ref) => {
        const bv = leftBVMap.get(ref.id);
        const totalBv = bv ? Number(bv.leftBV) + Number(bv.rightBV) : 0;
        return sum + totalBv;
      }, 0),
      referralCount: leftReferrals.length,
      referrals: leftReferrals.map(ref => {
        const bv = leftBVMap.get(ref.id);
        const totalBv = bv ? Number(bv.leftBV) + Number(bv.rightBV) : 0;
        return {
          id: ref.id,
          name: ref.name,
          bv: totalBv,
          position: ref.position || 'left'
        };
      })
    };

    const rightSide = {
      totalBV: rightReferrals.reduce((sum, ref) => {
        const bv = rightBVMap.get(ref.id);
        const totalBv = bv ? Number(bv.leftBV) + Number(bv.rightBV) : 0;
        return sum + totalBv;
      }, 0),
      referralCount: rightReferrals.length,
      referrals: rightReferrals.map(ref => {
        const bv = rightBVMap.get(ref.id);
        const totalBv = bv ? Number(bv.leftBV) + Number(bv.rightBV) : 0;
        return {
          id: ref.id,
          name: ref.name,
          bv: totalBv,
          position: ref.position || 'right'
        };
      })
    };

    return { leftSide, rightSide };
  }

  /**
   * Force process matches for a specific user (admin function)
   */
  static async forceProcessMatches(userId: number): Promise<BVMatchResult> {
    const transaction = await sequelize.transaction();
    
    try {
      const matchResult = await this.processMatchingUpTreeInternal(userId, 0, transaction);
      
      await transaction.commit();
      
      return {
        success: true,
        message: `Forced matching processed. ${matchResult.matches.length} matches found.`,
        matches: matchResult.matches,
        totalBonusEarned: matchResult.totalBonusEarned
      };
    } catch (error) {
      await transaction.rollback();
      console.error('Force process matches error:', error);
      return {
        success: false,
        message: 'Error processing forced matches',
        matches: [],
        totalBonusEarned: 0
      };
    }
  }
}
