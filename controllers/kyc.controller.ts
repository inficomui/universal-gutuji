import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { Kyc } from "../models/Kyc.ts";
import { Op } from "sequelize";
import { toPublicUrl } from "../middlewares/upload.ts";

// Submit KYC request
export const submitKycRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    // Check for file upload errors
    if ((req as any).fileValidationError) {
      res.status(400).json({ 
        success: false,
        message: (req as any).fileValidationError 
      });
      return;
    }

    const { 
      panNumber, 
      aadhaarNumber, 
      accountNumber, 
      ifscCode, 
      bankName, 
      accountHolderName,
      address,
      pincode
    } = req.body;

    // Handle uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const parentImageFile = files?.parentImage?.[0];
    const childImageFile = files?.childImage?.[0];

    // Validate required fields
    if (!accountNumber || !ifscCode || !bankName || !accountHolderName) {
      res.status(400).json({ 
        success: false,
        message: "Account number, IFSC code, bank name, and account holder name are required" 
      });
      return;
    }

    // Validate at least one KYC document
    if (!panNumber && !aadhaarNumber) {
      res.status(400).json({ 
        success: false,
        message: "Either PAN number or Aadhaar number must be provided" 
      });
      return;
    }

    // Validate pincode format if provided
    if (pincode && !/^[0-9]{6}$/.test(pincode)) {
      res.status(400).json({ 
        success: false,
        message: "Pincode must be a 6-digit number" 
      });
      return;
    }

    // Validate that at least one image is provided
    if (!parentImageFile && !childImageFile) {
      res.status(400).json({ 
        success: false,
        message: "At least one image (parent or child) must be uploaded" 
      });
      return;
    }

    // Check if user already has a pending or approved KYC
    const existingKyc = await Kyc.findOne({
      where: { 
        userId,
        status: { [Op.in]: ['pending', 'approved'] }
      }
    });

    if (existingKyc) {
      res.status(400).json({ 
        success: false,
        message: "You already have a KYC request that is pending or approved" 
      });
      return;
    }

    // Create KYC request
    const kycRequest = await Kyc.create({
      userId,
      panNumber: panNumber || null,
      aadhaarNumber: aadhaarNumber || null,
      accountNumber,
      ifscCode,
      bankName,
      accountHolderName,
      address: address || null,
      pincode: pincode || null,
      parentImage: parentImageFile ? toPublicUrl(parentImageFile.filename) : null,
      childImage: childImageFile ? toPublicUrl(childImageFile.filename) : null,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: "KYC request submitted successfully",
      data: {
        id: kycRequest.id,
        status: kycRequest.status,
        submittedAt: kycRequest.createdAt
      }
    });
  } catch (error: any) {
    console.error("Submit KYC request error:", error);
    
    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ 
        success: false,
        message: "File size too large. Maximum size is 10MB" 
      });
      return;
    }
    
    if (error.message && error.message.includes('Only image files are allowed')) {
      res.status(400).json({ 
        success: false,
        message: "Only image files (PNG, JPG, JPEG, WEBP, GIF, AVIF) are allowed" 
      });
      return;
    }
    
    // Handle unique constraint errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path;
      if (field === 'panNumber') {
        res.status(400).json({ 
          success: false,
          message: "PAN number is already registered with another account" 
        });
        return;
      }
      if (field === 'aadhaarNumber') {
        res.status(400).json({ 
          success: false,
          message: "Aadhaar number is already registered with another account" 
        });
        return;
      }
    }

    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get user's KYC status
export const getMyKycStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const kyc = await Kyc.findOne({
      where: { userId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'processedByUser',
          attributes: ['id', 'name', 'username']
        }
      ]
    });

    if (!kyc) {
      res.json({
        success: true,
        data: {
          hasKyc: false,
          status: null,
          message: "No KYC request found"
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        hasKyc: true,
        id: kyc.id,
        status: kyc.status,
        panNumber: kyc.panNumber ? `${kyc.panNumber.substring(0, 2)}****${kyc.panNumber.substring(6)}` : null,
        aadhaarNumber: kyc.aadhaarNumber ? `${kyc.aadhaarNumber.substring(0, 4)}****${kyc.aadhaarNumber.substring(8)}` : null,
        accountNumber: `${kyc.accountNumber.substring(0, 4)}****${kyc.accountNumber.substring(kyc.accountNumber.length - 4)}`,
        ifscCode: kyc.ifscCode,
        bankName: kyc.bankName,
        accountHolderName: kyc.accountHolderName,
        address: kyc.address,
        pincode: kyc.pincode,
        parentImage: kyc.parentImage,
        childImage: kyc.childImage,
        rejectionReason: kyc.rejectionReason,
        processedBy: kyc.processedByUser ? {
          id: kyc.processedByUser.id,
          name: kyc.processedByUser.name,
          username: kyc.processedByUser.username
        } : null,
        processedAt: kyc.processedAt,
        submittedAt: kyc.createdAt,
        updatedAt: kyc.updatedAt
      }
    });
  } catch (error: any) {
    console.error("Get my KYC status error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get all KYC requests (Admin only)
export const getAllKycRequests = async (req: Request, res: Response): Promise<void> => {
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

    const { count, rows: kycs } = await Kyc.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username', 'kycVerified'],
          where: searchClause
        },
        {
          model: User,
          as: 'processedByUser',
          attributes: ['id', 'name', 'username']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: {
        kycs: kycs.map(kyc => ({
          id: kyc.id,
          status: kyc.status,
          user: {
            id: (kyc as any).user.id,
            name: (kyc as any).user.name,
            email: (kyc as any).user.email,
            username: (kyc as any).user.username,
            kycVerified: (kyc as any).user.kycVerified
          },
          panNumber: kyc.panNumber ? `${kyc.panNumber.substring(0, 2)}****${kyc.panNumber.substring(6)}` : null,
          aadhaarNumber: kyc.aadhaarNumber ? `${kyc.aadhaarNumber.substring(0, 4)}****${kyc.aadhaarNumber.substring(8)}` : null,
          accountNumber: `${kyc.accountNumber.substring(0, 4)}****${kyc.accountNumber.substring(kyc.accountNumber.length - 4)}`,
          ifscCode: kyc.ifscCode,
          bankName: kyc.bankName,
          accountHolderName: kyc.accountHolderName,
          address: kyc.address,
          pincode: kyc.pincode,
          parentImage: kyc.parentImage,
          childImage: kyc.childImage,
          rejectionReason: kyc.rejectionReason,
          processedBy: (kyc as any).processedByUser ? {
            id: (kyc as any).processedByUser.id,
            name: (kyc as any).processedByUser.name,
            username: (kyc as any).processedByUser.username
          } : null,
          processedAt: kyc.processedAt,
          submittedAt: kyc.createdAt,
          updatedAt: kyc.updatedAt
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
    console.error("Get all KYC requests error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Approve KYC request (Admin only)
export const approveKycRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { kycId } = req.params;
    const adminId = (req as any).user?.userId;

    const kyc = await Kyc.findByPk(kycId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        }
      ]
    });

    if (!kyc) {
      res.status(404).json({ 
        success: false,
        message: "KYC request not found" 
      });
      return;
    }

    if (kyc.status !== 'pending') {
      res.status(400).json({ 
        success: false,
        message: "KYC request is not pending" 
      });
      return;
    }

    // Update KYC status
    await kyc.update({
      status: 'approved',
      processedBy: adminId,
      processedAt: new Date()
    });

    // Update user's KYC verification status
    await User.update(
      { kycVerified: true },
      { where: { id: kyc.userId } }
    );

    res.json({
      success: true,
      message: "KYC request approved successfully",
      data: {
        kycId: kyc.id,
        userId: kyc.userId,
        userName: (kyc as any).user.name,
        status: 'approved',
        processedAt: kyc.processedAt
      }
    });
  } catch (error: any) {
    console.error("Approve KYC request error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Reject KYC request (Admin only)
export const rejectKycRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { kycId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = (req as any).user?.userId;

    if (!rejectionReason) {
      res.status(400).json({ 
        success: false,
        message: "Rejection reason is required" 
      });
      return;
    }

    const kyc = await Kyc.findByPk(kycId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        }
      ]
    });

    if (!kyc) {
      res.status(404).json({ 
        success: false,
        message: "KYC request not found" 
      });
      return;
    }

    if (kyc.status !== 'pending') {
      res.status(400).json({ 
        success: false,
        message: "KYC request is not pending" 
      });
      return;
    }

    // Update KYC status
    await kyc.update({
      status: 'rejected',
      rejectionReason,
      processedBy: adminId,
      processedAt: new Date()
    });

    res.json({
      success: true,
      message: "KYC request rejected successfully",
      data: {
        kycId: kyc.id,
        userId: kyc.userId,
        userName: (kyc as any).user.name,
        status: 'rejected',
        rejectionReason,
        processedAt: kyc.processedAt
      }
    });
  } catch (error: any) {
    console.error("Reject KYC request error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// Get KYC request details (Admin only)
export const getKycRequestDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { kycId } = req.params;

    const kyc = await Kyc.findByPk(kycId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username', 'kycVerified', 'createdAt']
        },
        {
          model: User,
          as: 'processedByUser',
          attributes: ['id', 'name', 'username']
        }
      ]
    });

    if (!kyc) {
      res.status(404).json({ 
        success: false,
        message: "KYC request not found" 
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: kyc.id,
        status: kyc.status,
        user: {
          id: (kyc as any).user.id,
          name: (kyc as any).user.name,
          email: (kyc as any).user.email,
          username: (kyc as any).user.username,
          kycVerified: (kyc as any).user.kycVerified,
          joinedAt: (kyc as any).user.createdAt
        },
        panNumber: kyc.panNumber,
        aadhaarNumber: kyc.aadhaarNumber,
        accountNumber: kyc.accountNumber,
        ifscCode: kyc.ifscCode,
        bankName: kyc.bankName,
        accountHolderName: kyc.accountHolderName,
        address: kyc.address,
        pincode: kyc.pincode,
        parentImage: kyc.parentImage,
        childImage: kyc.childImage,
        rejectionReason: kyc.rejectionReason,
        processedBy: (kyc as any).processedByUser ? {
          id: (kyc as any).processedByUser.id,
          name: (kyc as any).processedByUser.name,
          username: (kyc as any).processedByUser.username
        } : null,
        processedAt: kyc.processedAt,
        submittedAt: kyc.createdAt,
        updatedAt: kyc.updatedAt
      }
    });
  } catch (error: any) {
    console.error("Get KYC request details error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

