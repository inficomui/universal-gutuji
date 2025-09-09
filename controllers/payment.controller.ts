import type { Request, Response } from "express";
import { Payment } from "../models/Payment.ts";
import { Plan } from "../models/Plan.ts";
import { User } from "../models/User.ts";
import { Op } from "sequelize";

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId, utrNumber, paymentMethod = "UPI" } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    if (!planId || !utrNumber) {
      res.status(400).json({
        success: false,
        message: "Plan ID and UTR number are required"
      });
      return;
    }

    // Check if plan exists
    const plan = await Plan.findByPk(planId);
    if (!plan) {
      res.status(404).json({
        success: false,
        message: "Plan not found"
      });
      return;
    }

    // Check if user already has a pending payment for this plan
    const existingPayment = await Payment.findOne({
      where: {
        userId,
        planId,
        status: "pending"
      }
    });

    if (existingPayment) {
      res.status(400).json({
        success: false,
        message: "You already have a pending payment for this plan"
      });
      return;
    }

    // Check if user already has an approved payment for this plan
    const approvedPayment = await Payment.findOne({
      where: {
        userId,
        planId,
        status: "approved"
      }
    });

    if (approvedPayment) {
      res.status(400).json({
        success: false,
        message: "You already have an approved payment for this plan"
      });
      return;
    }

    // Create payment record
    const payment = await Payment.create({
      userId,
      planId,
      amount: plan.price,
      currency: plan.currency,
      utrNumber: utrNumber.toUpperCase(),
      paymentMethod,
      status: "pending"
    });

    // Include plan details in response
    const paymentWithPlan = await Payment.findByPk(payment.id, {
      include: [
        {
          model: Plan,
          as: 'plan'
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: "Payment submitted successfully. Please wait for admin verification.",
      data: paymentWithPlan
    });
  } catch (error: any) {
    console.error("Create payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const getUserPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { status, page = 1, limit = 10 } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    const whereClause: any = { userId };
    if (status) {
      whereClause.status = status;
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Plan,
          as: 'plan'
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset
    });

    res.json({
      success: true,
      data: payments,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error: any) {
    console.error("Get user payments error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const getAllPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, userId, planId, page = 1, limit = 20 } = req.query;

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }
    if (userId) {
      whereClause.userId = userId;
    }
    if (planId) {
      whereClause.planId = planId;
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Plan,
          as: 'plan'
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset
    });

    res.json({
      success: true,
      data: payments,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error: any) {
    console.error("Get all payments error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const { status, adminNotes } = req.body;

    if (!paymentId || !status) {
      res.status(400).json({
        success: false,
        message: "Payment ID and status are required"
      });
      return;
    }

    const validStatuses = ['pending', 'verified', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(', ')
      });
      return;
    }

    const payment = await Payment.findByPk(paymentId, {
      include: [
        {
          model: Plan,
          as: 'plan'
        },
        {
          model: User,
          as: 'user'
        }
      ]
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        message: "Payment not found"
      });
      return;
    }

    // Update payment status
    await payment.update({
      status,
      adminNotes: adminNotes || payment.adminNotes
    });

    // If payment is approved, activate the user
    if (status === 'approved') {
      await User.update(
        { isActive: true },
        { where: { id: payment.userId } }
      );
    }

    // Get updated payment with relations
    const updatedPayment = await Payment.findByPk(paymentId, {
      include: [
        {
          model: Plan,
          as: 'plan'
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'isActive']
        }
      ]
    });

    res.json({
      success: true,
      message: `Payment ${status} successfully`,
      data: updatedPayment
    });
  } catch (error: any) {
    console.error("Update payment status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const getPaymentStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalPayments = await Payment.count();
    const pendingPayments = await Payment.count({ where: { status: 'pending' } });
    const verifiedPayments = await Payment.count({ where: { status: 'verified' } });
    const approvedPayments = await Payment.count({ where: { status: 'approved' } });
    const rejectedPayments = await Payment.count({ where: { status: 'rejected' } });

    // Calculate total revenue
    const revenueResult = await Payment.sum('amount', {
      where: { status: 'approved' }
    });

    const totalRevenue = revenueResult || 0;

    res.json({
      success: true,
      data: {
        total: totalPayments,
        pending: pendingPayments,
        verified: verifiedPayments,
        approved: approvedPayments,
        rejected: rejectedPayments,
        totalRevenue
      }
    });
  } catch (error: any) {
    console.error("Get payment stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};


