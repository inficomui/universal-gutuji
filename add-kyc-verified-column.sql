-- Add kycVerified column to users table
ALTER TABLE users 
ADD COLUMN kycVerified BOOLEAN NOT NULL DEFAULT FALSE AFTER totalMatched;

-- Create kycs table
CREATE TABLE IF NOT EXISTS kycs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  panNumber VARCHAR(20) NULL UNIQUE,
  aadhaarNumber VARCHAR(12) NULL UNIQUE,
  accountNumber VARCHAR(20) NOT NULL,
  ifscCode VARCHAR(11) NOT NULL,
  bankName VARCHAR(100) NOT NULL,
  accountHolderName VARCHAR(100) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  rejectionReason TEXT NULL,
  processedBy INT UNSIGNED NULL,
  processedAt DATETIME NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (processedBy) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  
  INDEX idx_kyc_user_id (userId),
  INDEX idx_kyc_status (status),
  INDEX idx_kyc_processed_by (processedBy)
);

-- Add validation constraint to ensure at least one KYC document
ALTER TABLE kycs 
ADD CONSTRAINT chk_kyc_document 
CHECK (panNumber IS NOT NULL OR aadhaarNumber IS NOT NULL);




