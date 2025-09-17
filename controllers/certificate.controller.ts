import { Request, Response } from 'express';
import { CertificateRequest, CertificateStatus } from '../models/CertificateRequest.js';
import { Level } from '../models/Level.js';
import { User } from '../models/User.js';
import { CertificateService } from '../services/certificateService.js';
import { EmailService } from '../services/emailService.js';
import { Op } from 'sequelize';

// POST /api/certificates/request - Request certificate
export const requestCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }
    
    const { levelId, studentName, parentName, emailTo } = req.body;

    // Validation
    if (!levelId || !studentName || !parentName || !emailTo) {
      res.status(400).json({
        success: false,
        message: "All fields are required: levelId, studentName, parentName, emailTo"
      });
      return;
    }

    // Check if level exists and is active
    const level = await Level.findByPk(levelId);
    if (!level || !level.isActive) {
      res.status(404).json({
        success: false,
        message: "Level not found or inactive"
      });
      return;
    }

    // Check if user already has a pending/approved request for this level
    const existingRequest = await CertificateRequest.findOne({
      where: {
        userId,
        levelId,
        status: {
          [Op.in]: [CertificateStatus.PENDING, CertificateStatus.APPROVED, CertificateStatus.ISSUED]
        }
      }
    });

    if (existingRequest) {
      res.status(409).json({
        success: false,
        message: "You already have a certificate request for this level"
      });
      return;
    }

    // Create certificate request
    const certificateRequest = await CertificateRequest.create({
      userId,
      levelId,
      studentName,
      parentName,
      levelName: level.name,
      emailTo,
      status: CertificateStatus.PENDING
    });

    // Send notification to admin
    try {
      await EmailService.sendAdminNotification(
        studentName,
        level.name,
        certificateRequest.certificateNo || 'PENDING',
        (req as any).user.email
      );
    } catch (emailError) {
      console.warn('Failed to send admin notification:', emailError);
    }

    res.status(201).json({
      success: true,
      data: certificateRequest,
      message: "Certificate request submitted successfully"
    });
  } catch (error: any) {
    console.error("Request certificate error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// GET /api/certificates/my-requests - Get user's certificate requests
export const getMyCertificateRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Request user:', (req as any).user);
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      console.log('No userId found in request');
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    const { page = 1, limit = 10, status } = req.query;

    const whereClause: any = { userId };
    if (status) {
      whereClause.status = status;
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: requests } = await CertificateRequest.findAndCountAll({
      where: whereClause,
      // Temporarily remove includes due to association issues
      // include: [
      //   {
      //     model: Level,
      //     as: 'level',
      //     attributes: ['id', 'name', 'isActive']
      //   }
      // ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(count / Number(limit))
        }
      }
    });
  } catch (error: any) {
    console.error("Get my certificate requests error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// GET /api/certificates/:id - Get certificate request details
export const getCertificateRequestDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    const request = await CertificateRequest.findOne({
      where: {
        id,
        userId
      }
      // Temporarily remove includes due to association issues
      // include: [
      //   {
      //     model: Level,
      //     as: 'level',
      //     attributes: ['id', 'name', 'isActive', 'certificatePng']
      //   }
      // ]
    });

    if (!request) {
      res.status(404).json({
        success: false,
        message: "Certificate request not found"
      });
      return;
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error: any) {
    console.error("Get certificate request details error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// GET /api/admin/certificates - Get all certificate requests (Admin)
export const getAllCertificateRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }
    if (search) {
      whereClause[Op.or] = [
        { studentName: { [Op.like]: `%${search}%` } },
        { parentName: { [Op.like]: `%${search}%` } },
        { levelName: { [Op.like]: `%${search}%` } },
        { certificateNo: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: requests } = await CertificateRequest.findAndCountAll({
      where: whereClause,
      // Temporarily remove includes due to association issues
      // include: [
      //   {
      //     model: User,
      //     as: 'user',
      //     attributes: ['id', 'name', 'email', 'username']
      //   },
      //   {
      //     model: Level,
      //     as: 'level',
      //     attributes: ['id', 'name', 'isActive']
      //   }
      // ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(count / Number(limit))
        }
      }
    });
  } catch (error: any) {
    console.error("Get all certificate requests error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// PUT /api/admin/certificates/:id/positions - Update certificate positions (Admin)
export const updateCertificatePositions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { positions } = req.body;

    if (!positions) {
      res.status(400).json({
        success: false,
        message: "Positions are required"
      });
      return;
    }

    const request = await CertificateRequest.findByPk(id);
    if (!request) {
      res.status(404).json({
        success: false,
        message: "Certificate request not found"
      });
      return;
    }

    // Update positions
    request.setPositions(positions);
    await request.save();

    res.json({
      success: true,
      data: request.getPositions(),
      message: "Positions updated successfully"
    });
  } catch (error: any) {
    console.error("Update certificate positions error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// PUT /api/admin/certificates/:id/approve - Approve certificate request (Admin)
export const approveCertificateRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { positions } = req.body; // Optional custom positions

    const request = await CertificateRequest.findByPk(id);
    // Temporarily remove includes due to association issues
    // include: [
    //   {
    //     model: Level,
    //     as: 'level',
    //     attributes: ['id', 'name', 'certificatePng']
    //   }
    // ]

    if (!request) {
      res.status(404).json({
        success: false,
        message: "Certificate request not found"
      });
      return;
    }

    if (request.status !== CertificateStatus.PENDING) {
      res.status(400).json({
        success: false,
        message: "Certificate request is not pending"
      });
      return;
    }

    // Update positions if provided
    if (positions) {
      request.setPositions(positions);
      await request.save(); // Save positions immediately
    }

    // Update status to approved
    request.status = CertificateStatus.APPROVED;
    await request.save();

    res.json({
      success: true,
      data: request,
      message: "Certificate request approved successfully"
    });
  } catch (error: any) {
    console.error("Approve certificate request error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// PUT /api/admin/certificates/:id/reject - Reject certificate request (Admin)
export const rejectCertificateRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await CertificateRequest.findByPk(id);

    if (!request) {
      res.status(404).json({
        success: false,
        message: "Certificate request not found"
      });
      return;
    }

    if (request.status !== CertificateStatus.PENDING) {
      res.status(400).json({
        success: false,
        message: "Certificate request is not pending"
      });
      return;
    }

    // Update status to rejected
    request.status = CertificateStatus.REJECTED;
    if (reason) {
      request.errorMessage = reason;
    }
    await request.save();

    res.json({
      success: true,
      data: request,
      message: "Certificate request rejected successfully"
    });
  } catch (error: any) {
    console.error("Reject certificate request error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// POST /api/admin/certificates/:id/generate-with-level - Generate certificate with level image (Admin)
export const generateCertificateWithLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { generatePdf = true } = req.body;

    const request = await CertificateRequest.findByPk(id, {
      include: [{ model: Level, as: 'level' }]
    });
    
    if (!request) {
      res.status(404).json({
        success: false,
        message: "Certificate request not found"
      });
      return;
    }

    if (request.status !== CertificateStatus.APPROVED) {
      res.status(400).json({
        success: false,
        message: "Certificate request must be approved before generation"
      });
      return;
    }

    if (!request.level) {
      res.status(404).json({
        success: false,
        message: "Level not found for this certificate request"
      });
      return;
    }

    if (!request.level.certificatePng) {
      res.status(400).json({
        success: false,
        message: "Level does not have a certificate PNG image"
      });
      return;
    }

    try {
      // Generate certificate image with level PNG
      const imagePath = await CertificateService.generateCertificateImageWithLevel(
        request,
        request.level
      );

      request.imagePath = imagePath;
      request.status = CertificateStatus.ISSUED;
      request.issuedAt = new Date();

      // Generate PDF if requested
      if (generatePdf) {
        const pdfPath = await CertificateService.generateCertificatePDF(request, imagePath);
        request.pdfPath = pdfPath;
      }

      await request.save();

      // Send email to student
      try {
        await EmailService.sendCertificateEmail(
          request.emailTo,
          request.studentName,
          request.levelName,
          request.certificateNo || 'N/A',
          request.imagePath || undefined,
          request.pdfPath || undefined
        );
      } catch (emailError) {
        console.warn('Failed to send certificate email:', emailError);
      }

      res.json({
        success: true,
        data: request,
        message: "Certificate generated and sent successfully"
      });
    } catch (generationError) {
      // Mark as failed
      request.status = CertificateStatus.FAILED;
      request.errorMessage = generationError instanceof Error ? generationError.message : 'Unknown error';
      await request.save();

      res.status(500).json({
        success: false,
        message: "Certificate generation failed",
        error: request.errorMessage
      });
    }
  } catch (error: any) {
    console.error("Generate certificate with level error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// POST /api/admin/certificates/:id/generate - Generate certificate (Admin)
export const generateCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { generatePdf = true, positions, useDirectPositions = false } = req.body;

    const request = await CertificateRequest.findByPk(id);
    // Temporarily remove includes due to association issues
    // include: [
    //   {
    //     model: Level,
    //     as: 'level',
    //     attributes: ['id', 'name', 'certificatePng']
    //   }
    // ]

    if (!request) {
      res.status(404).json({
        success: false,
        message: "Certificate request not found"
      });
      return;
    }

    if (request.status !== CertificateStatus.APPROVED) {
      res.status(400).json({
        success: false,
        message: "Certificate request must be approved before generation"
      });
      return;
    }

    // Get level details separately for now
    const level = await Level.findByPk(request.levelId);
    if (!level?.certificatePng) {
      res.status(400).json({
        success: false,
        message: "Level does not have a certificate template"
      });
      return;
    }

    // Update positions if provided in request body
    if (positions) {
      // Validate positions structure
      const requiredFields = ['studentName', 'parentName', 'levelName', 'date', 'certificateNo'];
      const isValidPositions = requiredFields.every(field => 
        positions[field] && 
        typeof positions[field].x === 'number' && 
        typeof positions[field].y === 'number' &&
        typeof positions[field].fontSize === 'number' &&
        ['left', 'center', 'right'].includes(positions[field].anchor)
      );

      if (!isValidPositions) {
        res.status(400).json({
          success: false,
          message: "Invalid positions format. Each position must have x, y, fontSize, and anchor properties."
        });
        return;
      }

      console.log('Setting positions from request body:', positions);
      request.setPositions(positions);
      await request.save();
    }

    try {
      // Generate certificate image with custom positions
      const imagePath = await CertificateService.generateCertificateImage(
        request,
        level.certificatePng.replace('/uploads', './uploads'),
        useDirectPositions
      );

      request.imagePath = imagePath;
      request.status = CertificateStatus.ISSUED;
      request.issuedAt = new Date();

      // Generate PDF if requested
      if (generatePdf) {
        const pdfPath = await CertificateService.generateCertificatePDF(request, imagePath);
        request.pdfPath = pdfPath;
      }

      await request.save();

      // Send email to student
      try {
        await EmailService.sendCertificateEmail(
          request.emailTo,
          request.studentName,
          request.levelName,
          request.certificateNo || 'N/A',
          request.imagePath || undefined,
          request.pdfPath || undefined
        );
      } catch (emailError) {
        console.warn('Failed to send certificate email:', emailError);
      }

      res.json({
        success: true,
        data: request,
        message: "Certificate generated and sent successfully"
      });
    } catch (generationError) {
      // Mark as failed
      request.status = CertificateStatus.FAILED;
      request.errorMessage = generationError instanceof Error ? generationError.message : 'Unknown error';
      await request.save();

      res.status(500).json({
        success: false,
        message: "Certificate generation failed",
        error: request.errorMessage
      });
    }
  } catch (error: any) {
    console.error("Generate certificate error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// GET /api/certificates/:id/positions - Get certificate positions
export const getCertificatePositions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const request = await CertificateRequest.findByPk(id);
    if (!request) {
      res.status(404).json({
        success: false,
        message: "Certificate request not found"
      });
      return;
    }

    const positions = request.getPositions();
    res.json({
      success: true,
      data: positions
    });
  } catch (error: any) {
    console.error("Get certificate positions error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// GET /api/certificates/:id/image-dimensions - Get certificate template image dimensions
export const getCertificateImageDimensions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const request = await CertificateRequest.findByPk(id);
    if (!request) {
      res.status(404).json({
        success: false,
        message: "Certificate request not found"
      });
      return;
    }

    // Get level details
    const level = await Level.findByPk(request.levelId);
    if (!level?.certificatePng) {
      res.status(404).json({
        success: false,
        message: "Level does not have a certificate template"
      });
      return;
    }

    // Get image dimensions
    const sharp = require('sharp');
    const imagePath = level.certificatePng.replace('/uploads', './uploads');
    const metadata = await sharp(imagePath).metadata();

    res.json({
      success: true,
      data: {
        width: metadata.width,
        height: metadata.height,
        referenceWidth: 800, // Frontend reference width
        referenceHeight: 600 // Frontend reference height
      }
    });
  } catch (error: any) {
    console.error("Get certificate image dimensions error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// GET /api/certificates/:id/download - Download certificate
export const downloadCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const format = Array.isArray(req.query.format) ? req.query.format[0] : req.query.format || 'image';
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    const request = await CertificateRequest.findOne({
      where: {
        id,
        userId,
        status: CertificateStatus.ISSUED
      }
    });

    if (!request) {
      res.status(404).json({
        success: false,
        message: "Certificate not found or not issued"
      });
      return;
    }

    const filePath = format === 'pdf' ? request.pdfPath : request.imagePath;
    
    if (!filePath) {
      res.status(404).json({
        success: false,
        message: `${String(format).toUpperCase()} format not available for this certificate`
      });
      return;
    }

    // Redirect to the file URL
    const publicUrl = CertificateService.getPublicUrl(filePath);
    res.redirect(publicUrl);
  } catch (error: any) {
    console.error("Download certificate error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};
