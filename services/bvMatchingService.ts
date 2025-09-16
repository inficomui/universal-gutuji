import { UserBV } from "../models/UserBv.ts";
import { User } from "../models/User.ts";
import { Plan } from "../models/Plan.ts";
import { sequelize } from "../utils/db.ts";
import { Transaction, Op } from "sequelize";
const { PlanRequest } = await import("../models/PlanRequest.ts");

export interface BVMatchResult {
  userId: number;
  username: string;
  matchedAmount: number;
  bonusEarned: number;
  leftBVBefore: number;
  rightBVBefore: number;
  leftBVAfter: number;
  rightBVAfter: number;
  carryLeftAfter: number;
  carryRightAfter: number;
  lifetimeLeftBV: number;
  lifetimeRightBV: number;
}

export interface BVMatchingStats {
  totalMatches: number;
  totalBonusEarned: number;
  usersProcessed: number;
  matches: BVMatchResult[];
}

export class BVMatchingService {

  /**
   * Process BV matching for a specific user
   */
  static async processUserBVMatching(userId: number, transaction?: Transaction): Promise<BVMatchResult | null> {
    const t = transaction || await sequelize.transaction();
    
    try {
      const userBV = await UserBV.findOne({
        where: { userId },
        transaction: t
      });

      if (!userBV) {
        console.log(`No BV record found for user ${userId}`);
        return null;
      }

      const carryLeft = Number(userBV.carryLeft);
      const carryRight = Number(userBV.carryRight);

      // Find the minimum amount that can be matched (only from carry)
      const matchedAmount = Math.min(carryLeft, carryRight);

      if (matchedAmount <= 0) {
        console.log(`No BV to match for user ${userId} (carryLeft: ${carryLeft}, carryRight: ${carryRight})`);
        return null;
      }

      // Calculate bonus based on plan's bvValue
      const bonusEarned = await this.calculateBonusFromPlan(userId, matchedAmount, t);
console.log("bonusEarned", bonusEarned);

      // Get user info
      const user = await User.findByPk(userId, { transaction: t });
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Calculate new values after matching (only subtract from carry)
      const newCarryLeft = carryLeft - matchedAmount;
      const newCarryRight = carryRight - matchedAmount;

      // Update the user's BV record (only update carry fields)
      await userBV.update({
        carryLeft: newCarryLeft,
        carryRight: newCarryRight
        // leftBV and rightBV (lifetime) remain unchanged
      }, { transaction: t });

      // Update user's income and totalMatched
      const currentIncome = Number(user.totalIncome) || 0;
      const currentMatched = Number(user.totalMatched) || 0;
      
      console.log(`💰 Updating user ${user.username} income:`, {
        currentIncome,
        bonusEarned,
        newIncome: currentIncome + bonusEarned,
        currentMatched,
        newMatched: currentMatched + 1
      });
      
      await user.update({
        totalIncome: currentIncome + bonusEarned,
        totalMatched: currentMatched + 1
      }, { transaction: t });

      const result: BVMatchResult = {
        userId,
        username: user.username!,
        matchedAmount,
        bonusEarned,
        leftBVBefore: Number(userBV.leftBV),      // Lifetime left BV
        rightBVBefore: Number(userBV.rightBV),    // Lifetime right BV
        leftBVAfter: Number(userBV.leftBV),       // Lifetime left BV (unchanged)
        rightBVAfter: Number(userBV.rightBV),     // Lifetime right BV (unchanged)
        carryLeftAfter: newCarryLeft,
        carryRightAfter: newCarryRight,
        lifetimeLeftBV: Number(userBV.leftBV),    // Same as leftBV
        lifetimeRightBV: Number(userBV.rightBV)   // Same as rightBV
      };

      console.log(`✅ BV Match processed for ${user.username}:`, {
        matched: matchedAmount,
        bonus: bonusEarned,
        lifetimeLeftBV: Number(userBV.leftBV),    // Never changes
        lifetimeRightBV: Number(userBV.rightBV),  // Never changes
        carryLeft: `${carryLeft} → ${newCarryLeft}`,
        carryRight: `${carryRight} → ${newCarryRight}`
      });

      if (!transaction) await t.commit();
      return result;

    } catch (error) {
      if (!transaction) await t.rollback();
      throw error;
    }
  }

  /**
   * Process BV matching for all users
   */
  static async processAllUsersBVMatching(): Promise<BVMatchingStats> {
    const transaction = await sequelize.transaction();
    
    try {
      const allUsers = await User.findAll({
        where: { role: 'user' },
        transaction
      });

      const matches: BVMatchResult[] = [];
      let totalBonusEarned = 0;

      for (const user of allUsers) {
        // Check if user has BV record
        const userBV = await UserBV.findOne({
          where: { userId: user.id },
          transaction
        });

        if (userBV) {
          const matchResult = await this.processUserBVMatching(user.id, transaction);
          if (matchResult) {
            matches.push(matchResult);
            totalBonusEarned += matchResult.bonusEarned;
          }
        }
      }

      await transaction.commit();

      return {
        totalMatches: matches.length,
        totalBonusEarned,
        usersProcessed: allUsers.length,
        matches
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Add BV to user (both lifetime and carry)
   */
  static async addBVToUser(
    userId: number, 
    bvAmount: number, 
    side: 'left' | 'right',
    transaction?: Transaction
  ): Promise<void> {
    const t = transaction || await sequelize.transaction();
    
    try {
      let userBV = await UserBV.findOne({
        where: { userId },
        transaction: t
      });

      if (!userBV) {
        // Create new BV record
        userBV = await UserBV.create({
          userId,
          leftBV: side === 'left' ? bvAmount : 0,      // Lifetime left BV
          rightBV: side === 'right' ? bvAmount : 0,    // Lifetime right BV
          carryLeft: side === 'left' ? bvAmount : 0,   // Current left BV for matching
          carryRight: side === 'right' ? bvAmount : 0  // Current right BV for matching
        }, { transaction: t });
      } else {
        // Update existing BV record
        const currentLeftBV = Number(userBV.leftBV);
        const currentRightBV = Number(userBV.rightBV);
        const currentCarryLeft = Number(userBV.carryLeft);
        const currentCarryRight = Number(userBV.carryRight);

        const updates: any = {};
        
        if (side === 'left') {
          // Add to lifetime left BV (never decreases)
          updates.leftBV = currentLeftBV + bvAmount;
          // Add to carry left BV (for matching)
          updates.carryLeft = currentCarryLeft + bvAmount;
        } else {
          // Add to lifetime right BV (never decreases)
          updates.rightBV = currentRightBV + bvAmount;
          // Add to carry right BV (for matching)
          updates.carryRight = currentCarryRight + bvAmount;
        }

        await userBV.update(updates, { transaction: t });
      }

      console.log(`📈 Added ${bvAmount} BV to ${side} side for user ${userId} (lifetime + carry)`);

      if (!transaction) await t.commit();

    } catch (error) {
      if (!transaction) await t.rollback();
      throw error;
    }
  }

  /**
   * Get user's BV summary with lifetime and current totals
   */
  static async getUserBVSummary(userId: number): Promise<{
    current: { leftBV: number; rightBV: number; carryLeft: number; carryRight: number };
    lifetime: { leftBV: number; rightBV: number };
    total: { leftBV: number; rightBV: number };
  } | null> {
    const userBV = await UserBV.findOne({ where: { userId } });
    
    if (!userBV) return null;

    const leftBV = Number(userBV.leftBV);      // Lifetime left BV (never decreases)
    const rightBV = Number(userBV.rightBV);    // Lifetime right BV (never decreases)
    const carryLeft = Number(userBV.carryLeft);   // Current left BV for matching
    const carryRight = Number(userBV.carryRight); // Current right BV for matching

    return {
      current: { leftBV: carryLeft, rightBV: carryRight, carryLeft, carryRight },
      lifetime: { leftBV, rightBV },
      total: { 
        leftBV: leftBV,    // Lifetime total
        rightBV: rightBV   // Lifetime total
      }
    };
  }

  /**
   * Calculate bonus based on plan's bvValue
   */
  private static async calculateBonusFromPlan(
    userId: number, 
    matchedAmount: number, 
    transaction: Transaction
  ): Promise<number> {
    try {
      // Get user's approved plan
      const user = await User.findByPk(userId, { transaction });
      if (!user) return 0;

      // Get the user's approved plan request to find their specific plan
     
      const planRequest = await PlanRequest.findOne({
        where: { 
          userId: userId
        },
        order: [['createdAt', 'DESC']],
        transaction
      });

      console.log(`🔍 Plan request lookup for user ${userId}:`, {
        found: !!planRequest,
        planRequestId: planRequest?.id,
        planId: planRequest?.planId,
        status: planRequest?.status
      });

      if (!planRequest || !planRequest.planId) {
        console.log(`❌ No plan request found for user ${userId}`);
        return 0;
      }

      // Get the plan directly using planId
      const plan = await Plan.findByPk(planRequest.planId, { transaction });
      
      console.log(`📋 Plan details for user ${userId}:`, {
        planFound: !!plan,
        planId: plan?.id,
        planName: plan?.name,
        planBvValue: plan?.bvValue,
        planStatus: plan?.status,
        planIsActive: plan?.isActive
      });

      if (!plan || !plan.bvValue) {
        console.log(`❌ No plan with bvValue found for user ${userId}`);
        return 0;
      }

      // Calculate bonus: (matchedAmount / 50) * plan.bvValue
      // Assuming 50 BV is the base unit for bonus calculation
      const bonusMultiplier = Math.floor(matchedAmount / 50);
      const bonusEarned = bonusMultiplier * plan.bvValue;

      console.log(`💰 Bonus calculation for user ${userId}:`, {
        matchedAmount,
        planId: plan.id,
        planName: plan.name,
        planBvValue: plan.bvValue,
        bonusMultiplier,
        bonusEarned
      });

      return bonusEarned;

    } catch (error) {
      console.error(`Error calculating bonus from plan for user ${userId}:`, error);
      return 0; // Return 0 if there's an error
    }
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
}