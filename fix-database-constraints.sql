-- Fix database constraints for referral system
-- This script removes the incorrect unique constraint on sponsorId
-- and allows multiple users to have the same sponsor and position

-- Drop the incorrect unique constraint on sponsorId alone
ALTER TABLE `users` DROP INDEX `uniq_users_sponsor_id`;

-- Drop any existing unique constraint on sponsorId + position (if it exists)
ALTER TABLE `users` DROP INDEX `uniq_users_sponsor_position`;

-- Add non-unique indexes for performance (allows multiple users per sponsor/position)
ALTER TABLE `users` ADD INDEX `idx_users_sponsor_id` (`sponsorId`);
ALTER TABLE `users` ADD INDEX `idx_users_position` (`position`);
ALTER TABLE `users` ADD INDEX `idx_users_sponsor_position` (`sponsorId`, `position`);

-- Verify the constraints
SHOW INDEX FROM `users` WHERE Key_name LIKE '%sponsor%';
