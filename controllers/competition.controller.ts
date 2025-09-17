import { Request, Response } from 'express';
import { Competition } from '../models/Competition.js';
import { CompetitionParticipation, ParticipationStatus } from '../models/CompetitionParticipation.js';
import { CertificateRequest, CertificateStatus } from '../models/CertificateRequest.js';
import { User } from '../models/User.js';
import { Op } from 'sequelize';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads/competitions';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `competition-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// GET /api/competitions - Get all active competitions (Public)
export const getAllCompetitions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status = 'upcoming' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause: any = { isActive: true };
    
    if (status === 'upcoming') {
      whereClause.date = { [Op.gte]: new Date() };
    } else if (status === 'past') {
      whereClause.date = { [Op.lt]: new Date() };
    }

    const { count, rows: competitions } = await Competition.findAndCountAll({
      where: whereClause,
      order: [['date', 'ASC']],
      limit: Number(limit),
      offset: offset,
      include: [
        {
          model: CompetitionParticipation,
          as: 'participations',
          attributes: ['id', 'status'],
          where: { status: ParticipationStatus.APPROVED },
          required: false
        }
      ]
    });

    // Add participant count to each competition
    const competitionsWithCount = competitions.map(competition => {
      const competitionData = competition.toJSON() as any;
      competitionData.participantCount = competitionData.participations?.length || 0;
      delete competitionData.participations;
      return competitionData;
    });

    res.json({
      success: true,
      data: competitionsWithCount,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
        totalItems: count,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error: any) {
    console.error("Get competitions error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// GET /api/competitions/:id - Get competition by ID (Public)
export const getCompetitionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const competition = await Competition.findByPk(id, {
      include: [
        {
          model: CompetitionParticipation,
          as: 'participations',
          attributes: ['id', 'status'],
          where: { status: ParticipationStatus.APPROVED },
          required: false
        }
      ]
    });

    if (!competition) {
      res.status(404).json({ success: false, message: "Competition not found" });
      return;
    }

    const competitionData = competition.toJSON() as any;
    competitionData.participantCount = competitionData.participations?.length || 0;
    delete competitionData.participations;

    res.json({ success: true, data: competitionData });
  } catch (error: any) {
    console.error("Get competition by ID error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// POST /api/admin/competitions - Create competition (Admin)
export const createCompetition = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, price, address, gmapLocation, date, maxParticipants } = req.body;
    const imageFile = req.file;

    if (!title || !price || !address || !date) {
      res.status(400).json({ success: false, message: "Title, price, address, and date are required" });
      return;
    }

    if (!imageFile) {
      res.status(400).json({ success: false, message: "Competition image is required" });
      return;
    }

    const competition = await Competition.create({
      title,
      description,
      price: parseFloat(price),
      address,
      image: `/uploads/competitions/${imageFile.filename}`,
      gmapLocation,
      date: new Date(date),
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      currentParticipants: 0
    });

    res.status(201).json({ success: true, data: competition, message: "Competition created successfully" });
  } catch (error: any) {
    console.error("Create competition error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// PUT /api/admin/competitions/:id - Update competition (Admin)
export const updateCompetition = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, price, address, gmapLocation, date, maxParticipants, isActive } = req.body;
    const imageFile = req.file;

    const competition = await Competition.findByPk(id);
    if (!competition) {
      res.status(404).json({ success: false, message: "Competition not found" });
      return;
    }

    // Prepare update data
    const updateData: any = {
      title: title || competition.title,
      description: description !== undefined ? description : competition.description,
      price: price ? parseFloat(price) : competition.price,
      address: address || competition.address,
      gmapLocation: gmapLocation !== undefined ? gmapLocation : competition.gmapLocation,
      date: date ? new Date(date) : competition.date,
      maxParticipants: maxParticipants !== undefined ? (maxParticipants ? parseInt(maxParticipants) : null) : competition.maxParticipants,
      isActive: isActive !== undefined ? isActive : competition.isActive
    };

    // Handle image update
    if (imageFile) {
      // Delete old image if it exists
      if (competition.image) {
        try {
          const oldImagePath = competition.image.replace('/uploads', './uploads');
          await fs.unlink(oldImagePath);
        } catch (error) {
          console.warn('Could not delete old image:', error);
        }
      }
      updateData.image = `/uploads/competitions/${imageFile.filename}`;
    }

    await competition.update(updateData);

    res.json({ success: true, data: competition, message: "Competition updated successfully" });
  } catch (error: any) {
    console.error("Update competition error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// DELETE /api/admin/competitions/:id - Delete competition (Admin)
export const deleteCompetition = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const competition = await Competition.findByPk(id);
    if (!competition) {
      res.status(404).json({ success: false, message: "Competition not found" });
      return;
    }

    // Check if there are any participations
    const participationCount = await CompetitionParticipation.count({
      where: { competitionId: id }
    });

    if (participationCount > 0) {
      res.status(400).json({ 
        success: false, 
        message: "Cannot delete competition with existing participations. Deactivate instead." 
      });
      return;
    }

    // Delete image file if it exists
    if (competition.image) {
      try {
        const imagePath = competition.image.replace('/uploads', './uploads');
        await fs.unlink(imagePath);
      } catch (error) {
        console.warn('Could not delete competition image:', error);
      }
    }

    await competition.destroy();
    res.json({ success: true, message: "Competition deleted successfully" });
  } catch (error: any) {
    console.error("Delete competition error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// GET /api/admin/competitions - Get all competitions for admin (Admin)
export const getAllCompetitionsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status = 'all', month, year } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause: any = {};
    
    if (status === 'active') {
      whereClause.isActive = true;
    } else if (status === 'inactive') {
      whereClause.isActive = false;
    }

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      whereClause.date = { [Op.between]: [startDate, endDate] };
    }

    const { count, rows: competitions } = await Competition.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: offset,
      include: [
        {
          model: CompetitionParticipation,
          as: 'participations',
          attributes: ['id', 'status'],
          required: false
        }
      ]
    });

    // Add participant count to each competition
    const competitionsWithCount = competitions.map(competition => {
      const competitionData = competition.toJSON() as any;
      competitionData.participantCount = competitionData.participations?.length || 0;
      competitionData.approvedCount = competitionData.participations?.filter((p: any) => p.status === ParticipationStatus.APPROVED).length || 0;
      delete competitionData.participations;
      return competitionData;
    });

    res.json({
      success: true,
      data: competitionsWithCount,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
        totalItems: count,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error: any) {
    console.error("Get admin competitions error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// Check if user has any certificate
export const checkUserCertificateEligibility = async (userId: number): Promise<boolean> => {
  try {
    const certificateCount = await CertificateRequest.count({
      where: {
        userId: userId,
        status: CertificateStatus.ISSUED
      }
    });
    return certificateCount > 0;
  } catch (error) {
    console.error("Check certificate eligibility error:", error);
    return false;
  }
};
