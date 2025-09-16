import { User } from "../models/User.ts";
import { AdvancedBVMatchingService } from "./advancedBvMatchingService.ts";
import { BVMatchingService } from "./bvMatchingService.ts";

export class UserActivationService {
  /**
   * Handle user activation - distribute BV to upline and process matching
   */
  static async handleUserActivation(userId: number): Promise<void> {
    try {
      console.log(`🔄 Handling user activation for user ${userId}...`);
      
      const user = await User.findByPk(userId);
      if (!user) {
        console.log(`❌ User ${userId} not found for activation handling.`);
        return;
      }

      console.log(`👤 User details:`, {
        id: user.id,
        username: user.username,
        sponsorId: user.sponsorId,
        position: user.position,
        isActive: user.isActive
      });

      // Only distribute BV if user has a sponsor and position
      if (user.sponsorId && user.position) {
        console.log(`📈 Distributing BV for activated user ${user.username}...`);
        console.log(`   Sponsor: ${user.sponsorId}, Position: ${user.position}`);
        
        // Add 50 BV to the entire upline chain (nested bonus)
        await AdvancedBVMatchingService.addNestedBVToUpline(
          user.id, 
          50, 
          user.position as 'left' | 'right'
        );
        
        console.log(`✅ BV distributed successfully for activated user:`, {
          userId: user.id,
          username: user.username,
          sponsorId: user.sponsorId,
          position: user.position,
          note: "New user gets 0 BV, all upline parents get +50 BV each"
        });

        // Process BV matching for all upline users after distribution
        await this.processMatchingForUpline(user.id);
      } else {
        console.log(`ℹ️ User ${user.username} has no sponsor or position, skipping BV distribution`);
      }
    } catch (error) {
      console.error(`❌ Error handling user activation for user ${userId}:`, error);
    }
  }

  /**
   * Process BV matching for all upline users after new user activation
   */
  private static async processMatchingForUpline(newUserId: number): Promise<void> {
    try {
      console.log(`🔄 Processing BV matching for upline after user ${newUserId} activation...`);
      
      let currentUserId = newUserId;
      let level = 0;
      const maxLevels = 20; // Prevent infinite loops
      
      // Go up the entire referral chain and process matching for each user
      while (currentUserId && level < maxLevels) {
        const currentUser = await User.findByPk(currentUserId);
        if (!currentUser || !currentUser.sponsorId) {
          console.log(`🏁 Reached end of upline chain at level ${level}`);
          break;
        }

        const sponsor = await User.findOne({ 
          where: { username: currentUser.sponsorId } 
        });
        
        if (!sponsor) {
          console.log(`⚠️ Sponsor not found: ${currentUser.sponsorId}`);
          break;
        }

        console.log(`🎯 Processing BV matching for sponsor ${sponsor.username} (level ${level + 1})`);
        
        // Process BV matching for this sponsor
        const matchResult = await BVMatchingService.processUserBVMatching(sponsor.id);
        if (matchResult) {
          console.log(`✅ BV match processed for ${sponsor.username}:`, {
            matched: matchResult.matchedAmount,
            bonus: matchResult.bonusEarned
          });
        } else {
          console.log(`ℹ️ No BV match available for ${sponsor.username}`);
        }

        // Move up to the sponsor
        currentUserId = sponsor.id;
        level++;
      }

      console.log(`✅ BV matching processing completed for ${level} upline levels`);
      
    } catch (error) {
      console.error(`❌ Error processing BV matching for upline:`, error);
    }
  }
}
