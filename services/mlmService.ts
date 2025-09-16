import { User } from '../models/User.ts';
import { Plan } from '../models/Plan.ts';
import { PlanRequest } from '../models/PlanRequest.ts';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../utils/db.ts';

export interface MLMRegistrationResult {
  success: boolean;
  message: string;
  user?: {
    id: number;
    name: string;
    email: string;
    sponsorId: string;
    sponsorUserId?: number;
    position?: 'left' | 'right';
  };
  error?: string;
}

export interface TreePosition {
  userId: number;
  name: string;
  email: string;
  sponsorId: string;
  position: 'left' | 'right' | 'root';
  level: number;
  leftCount: number;
  rightCount: number;
  children?: TreePosition[];
}


export class MLMService {
  /**
   * Register a new user in the MLM system
   */
  static async registerUser(
    userData: {
      name: string;
      email: string;
      password: string;
      sponsorId?: string;
      position?: 'left' | 'right';
    }
  ): Promise<MLMRegistrationResult> {
    const transaction = await sequelize.transaction();
    
    try {
      const { name, email, password, sponsorId, position } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        await transaction.rollback();
        return {
          success: false,
          message: 'User already exists with this email'
        };
      }

      let sponsorUserId: number | null = null;
      let finalPosition: 'left' | 'right' | null = null;

      // If sponsorId is provided, find the sponsor and determine position
      if (sponsorId) {
        const sponsor = await User.findOne({ where: { sponsorId } });
        if (!sponsor) {
          await transaction.rollback();
          return {
            success: false,
            message: 'Invalid sponsor ID'
          };
        }

        sponsorUserId = sponsor.id;

        // If position is specified, check if it's available
        if (position) {
          const isPositionAvailable = await this.isPositionAvailable(sponsorUserId, position);
          if (!isPositionAvailable) {
            await transaction.rollback();
            return {
              success: false,
              message: `${position} position is already occupied under this sponsor`
            };
          }
          finalPosition = position;
        } else {
          // Auto-assign position (left first, then right)
          if (await this.isPositionAvailable(sponsorUserId, 'left')) {
            finalPosition = 'left';
          } else if (await this.isPositionAvailable(sponsorUserId, 'right')) {
            finalPosition = 'right';
          } else {
            await transaction.rollback();
            return {
              success: false,
              message: 'No available positions under this sponsor'
            };
          }
        }
      }

      // Generate unique sponsor ID for the new user
      let newSponsorId: string;
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 10) {
        newSponsorId = this.generateSponsorId();
        const existingSponsorId = await User.findOne({ where: { sponsorId: newSponsorId } });
        if (!existingSponsorId) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        await transaction.rollback();
        return {
          success: false,
          message: 'Failed to generate unique sponsor ID'
        };
      }

      // Create the user
      const user = await User.create({
        name,
        email,
        password,
        sponsorId: newSponsorId!,
        isActive: true
      }, { transaction });

      // Update sponsor's referral if applicable
      if (sponsorUserId && finalPosition) {
        const updateData = finalPosition === 'left' 
          ? { leftReferralId: user.id }
          : { rightReferralId: user.id };
        
        await User.update(updateData, {
          where: { id: sponsorUserId },
          transaction
        });
      }

      await transaction.commit();

      return {
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          sponsorId: user.sponsorId!,
          sponsorUserId: sponsorUserId || undefined,
          position: finalPosition || undefined
        }
      };

    } catch (error: any) {
      await transaction.rollback();
      console.error('MLM registration error:', error);
      return {
        success: false,
        message: 'Registration failed',
        error: error.message
      };
    }
  }

  /**
   * Check if a position is available under a sponsor
   */
  static async isPositionAvailable(sponsorUserId: number, position: 'left' | 'right'): Promise<boolean> {
    const sponsor = await User.findByPk(sponsorUserId);
    if (!sponsor) return false;

    const field = position === 'left' ? 'leftReferralId' : 'rightReferralId';
    return sponsor[field] === null;
  }

  /**
   * Get user's binary tree structure
   */
  static async getUserTree(userId: number, maxLevels: number = 5): Promise<TreePosition | null> {
    const user = await User.findByPk(userId);
    if (!user) return null;

    const tree = await this.buildTreeStructure(userId, 0, maxLevels);
    return tree;
  }

  /**
   * Build tree structure recursively
   */
  private static async buildTreeStructure(
    userId: number, 
    level: number, 
    maxLevels: number
  ): Promise<TreePosition> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');


    // Get children if not at max level
    let children: TreePosition[] = [];
    if (level < maxLevels) {
      const leftChild = user.leftReferralId;
      const rightChild = user.rightReferralId;

      if (leftChild) {
        children.push(await this.buildTreeStructure(leftChild, level + 1, maxLevels));
      }
      if (rightChild) {
        children.push(await this.buildTreeStructure(rightChild, level + 1, maxLevels));
      }
    }

    // Count total descendants
    const leftCount = await this.countDescendants(userId, 'left');
    const rightCount = await this.countDescendants(userId, 'right');

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      sponsorId: user.sponsorId || '',
      position: level === 0 ? 'root' : (await this.getUserPosition(userId)) || 'left',
      level,
      leftCount,
      rightCount,
      children: children.length > 0 ? children : undefined
    };
  }

  /**
   * Get user's position relative to their sponsor
   */
  static async getUserPosition(userId: number): Promise<'left' | 'right' | null> {
    const user = await User.findByPk(userId);
    if (!user) return null;

    // Find sponsor
    const sponsor = await User.findOne({
      where: {
        [Op.or]: [
          { leftReferralId: userId },
          { rightReferralId: userId }
        ]
      }
    });

    if (!sponsor) return null;

    return sponsor.leftReferralId === userId ? 'left' : 'right';
  }

  /**
   * Count descendants on a specific side
   */
  static async countDescendants(userId: number, side: 'left' | 'right'): Promise<number> {
    const referralField = side === 'left' ? 'leftReferralId' : 'rightReferralId';
    
    const count = await User.count({
      where: {
        [Op.or]: [
          { [referralField]: userId },
          // Add recursive counting for deeper levels
          { 
            [Op.and]: [
              { [referralField]: { [Op.ne]: null } },
              { [referralField]: { [Op.in]: await this.getAllDescendantIds(userId, referralField) } }
            ]
          }
        ]
      }
    });

    return count;
  }

  /**
   * Get all descendant IDs recursively
   */
  private static async getAllDescendantIds(userId: number, referralField: string): Promise<number[]> {
    const descendants: number[] = [];
    const queue = [userId];

    while (queue.length > 0) {
      const currentUserId = queue.shift()!;
      
      const directDescendants = await User.findAll({
        where: { [referralField]: currentUserId },
        attributes: ['id']
      });

      for (const descendant of directDescendants) {
        descendants.push(descendant.id);
        queue.push(descendant.id);
      }
    }

    return descendants;
  }



  /**
   * Generate unique sponsor ID
   */
  static generateSponsorId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get user's downline statistics
   */
  static async getUserDownlineStats(userId: number): Promise<{
    totalDownline: number;
    leftDownline: number;
    rightDownline: number;
    levels: Array<{
      level: number;
      leftCount: number;
      rightCount: number;
      totalCount: number;
    }>;
  }> {
    const leftCount = await this.countDescendants(userId, 'left');
    const rightCount = await this.countDescendants(userId, 'right');

    // Get level-wise statistics
    const levels = [];
    for (let level = 1; level <= 10; level++) {
      const levelStats = await this.getLevelStats(userId, level);
      if (levelStats.totalCount > 0) {
        levels.push(levelStats);
      }
    }

    return {
      totalDownline: leftCount + rightCount,
      leftDownline: leftCount,
      rightDownline: rightCount,
      levels
    };
  }

  /**
   * Get statistics for a specific level
   */
  private static async getLevelStats(userId: number, level: number): Promise<{
    level: number;
    leftCount: number;
    rightCount: number;
    totalCount: number;
  }> {
    // This would require more complex queries to get level-wise counts
    // For now, returning basic structure
    return {
      level,
      leftCount: 0,
      rightCount: 0,
      totalCount: 0
    };
  }
}
