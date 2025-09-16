import { type Request, type Response } from "express";
import { PlanRequest } from "../models/PlanRequest.ts";
import { Plan } from "../models/Plan.ts";
import { User } from "../models/User.ts";
import { Op } from "sequelize";

/**
 * Get logged-in user's plan requests
 */
export const getMyPlanRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    console.log("user id ", userId);
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const { status } = req.query;

    let whereClause: any = { userId };
    if (status) {
      whereClause.status = status;
    }

    const planRequests = await PlanRequest.findAll({
      where: whereClause,
      include: [
        {
          model: Plan,
          as: 'plan',
          attributes: ['id', 'name', 'price', 'currency', 'description', 'bvValue']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: planRequests
    });
  } catch (error: any) {
    console.error("Get my plan requests error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

/**
 * Get logged-in user's approved plans (active plans)
 */
export const getMyActivePlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const activePlans = await PlanRequest.findAll({
      where: { 
        userId,
        status: 'approved'
      },
      include: [
        {
          model: Plan,
          as: 'plan',
          attributes: ['id', 'name', 'price', 'currency', 'description', 'bvValue']
        }
      ],
      order: [['approvedAt', 'DESC']]
    });

    res.json({
      success: true,
      data: activePlans
    });
  } catch (error: any) {
    console.error("Get my active plans error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

/**
 * Get logged-in user's plan statistics
 */
export const getMyPlanStats = async (req: Request, res: Response): Promise<void> => {
  // try {
  //   const userId = (req as any).user?.userId;
    
  //   if (!userId) {
  //     res.status(401).json({ 
  //       success: false,
  //       message: "User not authenticated" 
  //     });
  //     return;
  //   }

  //   // Get all plan requests for the user
  //   const allRequests = await PlanRequest.findAll({
  //     where: { userId },
  //     include: [
  //       {
  //         model: Plan,
  //         as: 'plan',
  //         attributes: ['id', 'name', 'price', 'bvValue']
  //       }
  //     ]
  //   });

  //   // Calculate statistics
  //   const stats = {
  //     totalRequests: allRequests.length,
  //     pendingRequests: allRequests.filter(req => req.status === 'pending').length,
  //     approvedRequests: allRequests.filter(req => req.status === 'approved').length,
  //     rejectedRequests: allRequests.filter(req => req.status === 'rejected').length,
  //     cancelledRequests: allRequests.filter(req => req.status === 'cancelled').length,
  //     totalAmountSpent: allRequests
  //       .filter(req => req.status === 'approved')
  //       .reduce((sum, req) => sum + parseFloat(req.amount.toString()), 0),
  //     totalBVValue: allRequests
  //       .filter(req => req.status === 'approved')
  //       .reduce((sum, req) => sum + parseFloat((req.plan as any)?.bvValue?.toString() || '0'), 0),
  //     recentRequests: allRequests.slice(0, 5).map(req => ({
  //       id: req.id,
  //       planName: (req.plan as any)?.name,
  //       status: req.status,
  //       amount: req.amount,
  //       currency: req.currency,
  //       createdAt: req.createdAt
  //     }))
  //   };

  //   res.json({
  //     success: true,
  //     data: stats
  //   });
  // } catch (error: any) {
  //   console.error("Get my plan stats error:", error);
  //   res.status(500).json({ 
  //     success: false,
  //     message: error.message || "Server error" 
  //   });
  // }
};

/**
 * Create a new plan request for logged-in user
 */
export const createMyPlanRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const { planId, paymentMethod, paymentReference, amount, currency = 'INR', notes } = req.body;

    if (!planId || !amount) {
      res.status(400).json({ 
        success: false,
        message: "Plan ID and amount are required" 
      });
      return;
    }

    // Verify plan exists
    const plan = await Plan.findByPk(planId);
    if (!plan) {
      res.status(404).json({ 
        success: false,
        message: "Plan not found" 
      });
      return;
    }

    const newRequest = await PlanRequest.create({
      userId,
      planId,
      amount: parseFloat(amount),
      paymentMethod,
      paymentReference,
      currency,
      notes,
      status: 'pending'
    });

    // Include plan details in response
    const requestWithPlan = await PlanRequest.findByPk(newRequest.id, {
      include: [
        {
          model: Plan,
          as: 'plan',
          attributes: ['id', 'name', 'price', 'currency', 'description', 'bvValue']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: "Plan request created successfully",
      data: requestWithPlan
    });
  } catch (error: any) {
    console.error("Create my plan request error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

/**
 * Cancel a plan request (only if pending)
 */
export const cancelMyPlanRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { requestId } = req.params;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
      return;
    }

    const request = await PlanRequest.findOne({
      where: { 
        id: requestId,
        userId // Ensure user can only cancel their own requests
      }
    });

    if (!request) {
      res.status(404).json({ 
        success: false,
        message: "Plan request not found or you don't have permission to cancel it" 
      });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ 
        success: false,
        message: `Cannot cancel plan request. Current status: ${request.status}` 
      });
      return;
    }

    await request.update({
      status: 'cancelled'
    });

    res.json({
      success: true,
      message: "Plan request cancelled successfully",
      data: request
    });
  } catch (error: any) {
    console.error("Cancel my plan request error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};
