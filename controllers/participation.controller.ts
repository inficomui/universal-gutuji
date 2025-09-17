import { Request, Response } from 'express';
import { CompetitionParticipation, ParticipationStatus } from '../models/CompetitionParticipation.js';
import { Competition } from '../models/Competition.js';
import { User } from '../models/User.js';
import { CertificateRequest, CertificateStatus } from '../models/CertificateRequest.js';
import { checkUserCertificateEligibility } from './competition.controller.js';
import { Op } from 'sequelize';

// POST /api/competitions/:id/participate - Participate in competition (User)
export const participateInCompetition = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: competitionId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    // Check if competition exists and is active
    const competition = await Competition.findByPk(competitionId);
    if (!competition || !competition.isActive) {
      res.status(404).json({ success: false, message: "Competition not found or inactive" });
      return;
    }

    // Check if competition date is in the future
    if (new Date(competition.date) <= new Date()) {
      res.status(400).json({ success: false, message: "Competition has already started or ended" });
      return;
    }

    // Check if user has any certificate
    const hasCertificate = await checkUserCertificateEligibility(userId);
    if (!hasCertificate) {
      res.status(400).json({ 
        success: false, 
        message: "Please request for a certificate first before participating in competitions" 
      });
      return;
    }

    // Check if user already participated
    const existingParticipation = await CompetitionParticipation.findOne({
      where: {
        userId: userId,
        competitionId: competitionId
      }
    });

    if (existingParticipation) {
      res.status(400).json({ success: false, message: "You have already participated in this competition" });
      return;
    }

    // Check if competition has reached max participants
    if (competition.maxParticipants && competition.currentParticipants >= competition.maxParticipants) {
      res.status(400).json({ success: false, message: "Competition is full" });
      return;
    }

    // Create participation request
    const participation = await CompetitionParticipation.create({
      userId: userId,
      competitionId: parseInt(competitionId),
      status: ParticipationStatus.PAYMENT_PENDING,
      paymentAmount: competition.price
    });

    res.status(201).json({ 
      success: true, 
      data: participation, 
      message: "Participation request created. Please complete payment." 
    });
  } catch (error: any) {
    console.error("Participate in competition error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// POST /api/participations/:id/payment - Submit payment details (User)
export const submitPaymentDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: participationId } = req.params;
    const userId = (req as any).user?.userId;
    const { paymentMethod, utrNumber, paymentScreenshot } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    if (!paymentMethod || !utrNumber) {
      res.status(400).json({ success: false, message: "Payment method and UTR number are required" });
      return;
    }

    const participation = await CompetitionParticipation.findOne({
      where: {
        id: participationId,
        userId: userId
      }
    });

    if (!participation) {
      res.status(404).json({ success: false, message: "Participation not found" });
      return;
    }

    if (participation.status !== ParticipationStatus.PAYMENT_PENDING) {
      res.status(400).json({ success: false, message: "Payment already submitted or participation not in pending status" });
      return;
    }

    await participation.update({
      paymentMethod,
      utrNumber,
      paymentScreenshot,
      status: ParticipationStatus.PENDING
    });

    res.json({ success: true, data: participation, message: "Payment details submitted successfully" });
  } catch (error: any) {
    console.error("Submit payment details error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// GET /api/participations/my - Get user's participations (User)
export const getMyParticipations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    let whereClause: any = { userId };
    
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: participations } = await CompetitionParticipation.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: offset,
      include: [
        {
          model: Competition,
          as: 'competition',
          attributes: ['id', 'title', 'date', 'address', 'image']
        }
      ]
    });

    res.json({
      success: true,
      data: participations,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
        totalItems: count,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error: any) {
    console.error("Get my participations error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// GET /api/admin/participations - Get all participations (Admin)
export const getAllParticipations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, month, year, competitionId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause: any = {};
    
    if (status) {
      whereClause.status = status;
    }

    if (competitionId) {
      whereClause.competitionId = competitionId;
    }

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      whereClause.createdAt = { [Op.between]: [startDate, endDate] };
    }

    const { count, rows: participations } = await CompetitionParticipation.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: offset,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone'],
          include: [
            {
              model: CertificateRequest,
              as: 'certificateRequests',
              attributes: ['id', 'levelName', 'status', 'issuedAt', 'certificateNo'],
              where: { status: CertificateStatus.ISSUED },
              required: false
            }
          ]
        },
        {
          model: Competition,
          as: 'competition',
          attributes: ['id', 'title', 'date', 'price']
        },
        {
          model: User,
          as: 'verifier',
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });

    res.json({
      success: true,
      data: participations,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
        totalItems: count,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error: any) {
    console.error("Get all participations error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// PUT /api/admin/participations/:id/verify-payment - Verify payment (Admin)
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.userId;
    const { status, adminNotes } = req.body;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Admin not authenticated" });
      return;
    }

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ success: false, message: "Valid status (APPROVED/REJECTED) is required" });
      return;
    }

    const participation = await CompetitionParticipation.findByPk(id, {
      include: [
        {
          model: Competition,
          as: 'competition'
        }
      ]
    });

    if (!participation) {
      res.status(404).json({ success: false, message: "Participation not found" });
      return;
    }

    if (participation.status !== ParticipationStatus.PENDING) {
      res.status(400).json({ success: false, message: "Participation is not in pending status" });
      return;
    }

    const newStatus = status === 'APPROVED' ? ParticipationStatus.APPROVED : ParticipationStatus.REJECTED;

    await participation.update({
      status: newStatus,
      adminNotes,
      verifiedAt: new Date(),
      verifiedBy: adminId
    });

    // Update competition participant count if approved
    if (newStatus === ParticipationStatus.APPROVED) {
      await participation.competition.increment('currentParticipants');
    }

    res.json({ 
      success: true, 
      data: participation, 
      message: `Participation ${status.toLowerCase()} successfully` 
    });
  } catch (error: any) {
    console.error("Verify payment error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// GET /api/participations/:id - Get participation details (User/Admin)
export const getParticipationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'admin';

    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    const participation = await CompetitionParticipation.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: Competition,
          as: 'competition',
          attributes: ['id', 'title', 'date', 'address', 'price', 'image']
        },
        {
          model: User,
          as: 'verifier',
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });

    if (!participation) {
      res.status(404).json({ success: false, message: "Participation not found" });
      return;
    }

    // Check if user can view this participation
    if (!isAdmin && participation.userId !== userId) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    res.json({ success: true, data: participation });
  } catch (error: any) {
    console.error("Get participation by ID error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};
