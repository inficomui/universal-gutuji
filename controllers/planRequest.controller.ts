import type { Request, Response } from "express";
import { PlanRequest } from "../models/PlanRequest.ts";
import { Plan } from "../models/Plan.ts";
import { User } from "../models/User.ts";
import { Op } from "sequelize";

// GET /api/plan-requests - Get all plan requests (Admin only)
export const getAllPlanRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, userId, planId, page = 1, limit = 10 } = req.query;
    
    let whereClause: any = {};
    const offset = (Number(page) - 1) * Number(limit);

    // Filter by status
    if (status) {
      whereClause.status = status;
    }

    // Filter by user ID
    if (userId) {
      whereClause.userId = userId;
    }

    // Filter by plan ID
    if (planId) {
      whereClause.planId = planId;
    }

    const { count, rows: requests } = await PlanRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'isActive']
        },
        {
          model: Plan,
          as: 'plan',
          attributes: ['id', 'name', 'price', 'currency', 'description']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'email']
        }
      ],
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: requests,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error: any) {
    console.error("Get plan requests error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/plan-requests/user/:userId - Get user's plan requests
export const getUserPlanRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    
    let whereClause: any = { userId: parseInt(userId) };
    
    if (status) {
      whereClause.status = status;
    }

    const requests = await PlanRequest.findAll({
      where: whereClause,
      include: [
        {
          model: Plan,
          as: 'plan',
          attributes: ['id', 'name', 'price', 'currency', 'description', 'features']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: requests
    });
  } catch (error: any) {
    console.error("Get user plan requests error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// POST /api/plan-requests - Create new plan request
export const createPlanRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      planId, 
      paymentMethod, 
      paymentReference, 
      notes 
    } = req.body;
    
    const userId = (req as any).user?.id; // From JWT middleware
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    if (!planId) {
      res.status(400).json({ 
        success: false,
        message: "Plan ID is required" 
      });
      return;
    }

    // Get plan details
    const plan = await Plan.findByPk(planId);
    if (!plan) {
      res.status(404).json({ 
        success: false,
        message: "Plan not found" 
      });
      return;
    }

    // Check if user already has a pending request for this plan
    const existingRequest = await PlanRequest.findOne({
      where: {
        userId,
        planId,
        status: 'pending'
      }
    });

    if (existingRequest) {
      res.status(400).json({ 
        success: false,
        message: "You already have a pending request for this plan" 
      });
      return;
    }

    const newRequest = await PlanRequest.create({
      userId,
      planId,
      amount: plan.price,
      currency: plan.currency,
      paymentMethod,
      paymentReference,
      notes,
      status: 'pending'
    });

    // Fetch the created request with relations
    const requestWithDetails = await PlanRequest.findByPk(newRequest.id, {
      include: [
        {
          model: Plan,
          as: 'plan',
          attributes: ['id', 'name', 'price', 'currency', 'description']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: "Plan request created successfully",
      data: requestWithDetails
    });
  } catch (error: any) {
    console.error("Create plan request error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// PUT /api/plan-requests/:id/approve - Approve plan request (Admin only)
export const approvePlanRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.id;
    
    const request = await PlanRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'isActive']
        },
        {
          model: Plan,
          as: 'plan',
          attributes: ['id', 'name', 'price', 'currency']
        }
      ]
    });

    if (!request) {
      res.status(404).json({ 
        success: false,
        message: "Plan request not found" 
      });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ 
        success: false,
        message: "Only pending requests can be approved" 
      });
      return;
    }

    // Update request status
    await request.update({
      status: 'approved',
      approvedBy: adminId,
      approvedAt: new Date()
    });

    // Activate user account
    const user = await User.findByPk(request.userId);
    if (user) {
      await user.update({ isActive: true });
    }

    res.json({
      success: true,
      message: "Plan request approved successfully",
      data: request
    });
  } catch (error: any) {
    console.error("Approve plan request error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// PUT /api/plan-requests/:id/reject - Reject plan request (Admin only)
export const rejectPlanRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminId = (req as any).user?.id;
    
    const request = await PlanRequest.findByPk(id);

    if (!request) {
      res.status(404).json({ 
        success: false,
        message: "Plan request not found" 
      });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ 
        success: false,
        message: "Only pending requests can be rejected" 
      });
      return;
    }

    await request.update({
      status: 'rejected',
      approvedBy: adminId,
      approvedAt: new Date(),
      rejectionReason
    });

    res.json({
      success: true,
      message: "Plan request rejected successfully",
      data: request
    });
  } catch (error: any) {
    console.error("Reject plan request error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// DELETE /api/plan-requests/:id - Cancel plan request (User only)
export const cancelPlanRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const request = await PlanRequest.findByPk(id);

    if (!request) {
      res.status(404).json({ 
        success: false,
        message: "Plan request not found" 
      });
      return;
    }

    if (request.userId !== userId) {
      res.status(403).json({ 
        success: false,
        message: "You can only cancel your own requests" 
      });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ 
        success: false,
        message: "Only pending requests can be cancelled" 
      });
      return;
    }

    await request.update({
      status: 'cancelled'
    });

    res.json({
      success: true,
      message: "Plan request cancelled successfully"
    });
  } catch (error: any) {
    console.error("Cancel plan request error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/plan-requests/stats - Get plan request statistics (Admin only)
export const getPlanRequestStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalRequests = await PlanRequest.count();
    const pendingRequests = await PlanRequest.count({ where: { status: 'pending' } });
    const approvedRequests = await PlanRequest.count({ where: { status: 'approved' } });
    const rejectedRequests = await PlanRequest.count({ where: { status: 'rejected' } });
    
    res.json({
      success: true,
      data: {
        total: totalRequests,
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests
      }
    });
  } catch (error: any) {
    console.error("Get plan request stats error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

