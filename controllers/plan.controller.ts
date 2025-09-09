import type { Request, Response } from "express";
import { Plan } from "../models/Plan.ts";
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../utils/db.ts";


export const getAllPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, popular, search, sortBy = 'sortOrder', sortOrder = 'ASC' } = req.query;
    
    let whereClause: any = {};
    let orderClause: any = [[sortBy as string, sortOrder as string]];

    // Filter by status
    if (status) {
      whereClause.status = status;
    }

    // Filter popular plans
    if (popular === 'true') {
      whereClause.isPopular = true;
    }

    // Search functionality
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { tags: { [Op.contains]: [search] } }
      ];
    }

    const plans = await Plan.findAll({
      where: whereClause,
      order: orderClause,
    });
// console.log("plans", plans);

    res.json({
      success: true,
      data: plans
    });
  } catch (error: any) {
    console.error("Get plans error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/plans/:id - Get single plan
export const getPlanById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const plan = await Plan.findByPk(id);
    
    if (!plan) {
      res.status(404).json({ 
        success: false,
        message: "Plan not found" 
      });
      return;
    }
    
    res.json({
      success: true,
      data: plan
    });
  } catch (error: any) {
    console.error("Get plan error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// POST /api/plans - Create new plan (Admin only)
export const createPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      name, 
      price, 
      description, 
      features = [], 
      originalPrice,
      currency = "INR",
      duration,
      maxVideos,
      maxUsers,
      isPopular = false,
      status = "draft",
      sortOrder,
      imageUrl,
      videoUrl,
      tags = []
    } = req.body;
    
    if (!name || !price || !description) {
      res.status(400).json({ 
        success: false,
        message: "Name, price, and description are required" 
      });
      return;
    }

    const newPlan = await Plan.create({
      name,
      price: parseFloat(price),
      description,
      features,
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      currency,
      duration: duration ? parseInt(duration) : null,
      maxVideos: maxVideos ? parseInt(maxVideos) : null,
      maxUsers: maxUsers ? parseInt(maxUsers) : null,
      isPopular,
      status,
      sortOrder: sortOrder ? parseInt(sortOrder) : undefined,
      imageUrl,
      videoUrl,
      tags
    });

    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: newPlan
    });
  } catch (error: any) {
    console.error("Create plan error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// PUT /api/plans/:id - Update plan (Admin only)
export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const plan = await Plan.findByPk(id);
    if (!plan) {
      res.status(404).json({ 
        success: false,
        message: "Plan not found" 
      });
      return;
    }

    // Convert string numbers to proper types
    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.originalPrice) updateData.originalPrice = parseFloat(updateData.originalPrice);
    if (updateData.duration) updateData.duration = parseInt(updateData.duration);
    if (updateData.maxVideos) updateData.maxVideos = parseInt(updateData.maxVideos);
    if (updateData.maxUsers) updateData.maxUsers = parseInt(updateData.maxUsers);
    if (updateData.sortOrder) updateData.sortOrder = parseInt(updateData.sortOrder);

    await plan.update(updateData);

    res.json({
      success: true,
      message: "Plan updated successfully",
      data: plan
    });
  } catch (error: any) {
    console.error("Update plan error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// DELETE /api/plans/:id - Delete plan (Admin only)
export const deletePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    
    const plan = await Plan.findByPk(id);
    if (!plan) {
      res.status(404).json({ 
        success: false,
        message: "Plan not found" 
      });
      return;
    }

    if (permanent === 'true') {
      // Hard delete
      await plan.destroy();
      res.json({
        success: true,
        message: "Plan permanently deleted"
      });
    } else {
      // Soft delete by setting isActive to false
      await plan.update({ isActive: false, status: 'inactive' });
      res.json({
        success: true,
        message: "Plan deleted successfully"
      });
    }
  } catch (error: any) {
    console.error("Delete plan error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// PATCH /api/plans/:id/toggle-status - Toggle plan status (Admin only)
export const togglePlanStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const plan = await Plan.findByPk(id);
    if (!plan) {
      res.status(404).json({ 
        success: false,
        message: "Plan not found" 
      });
      return;
    }

    await plan.update({ 
      status,
      isActive: status === 'active'
    });

    res.json({
      success: true,
      message: `Plan status updated to ${status}`,
      data: plan
    });
  } catch (error: any) {
    console.error("Toggle plan status error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// PATCH /api/plans/:id/toggle-popular - Toggle popular status (Admin only)
export const togglePlanPopular = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const plan = await Plan.findByPk(id);
    if (!plan) {
      res.status(404).json({ 
        success: false,
        message: "Plan not found" 
      });
      return;
    }

    await plan.update({ 
      isPopular: !plan.isPopular
    });

    res.json({
      success: true,
      message: `Plan popular status ${plan.isPopular ? 'enabled' : 'disabled'}`,
      data: plan
    });
  } catch (error: any) {
    console.error("Toggle plan popular error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/plans/stats - Get plan statistics (Admin only)
export const getPlanStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalPlans = await Plan.count();
    const activePlans = await Plan.count({ where: { status: 'active', isActive: true } });
    const draftPlans = await Plan.count({ where: { status: 'draft' } });
    const popularPlans = await Plan.count({ where: { isPopular: true, isActive: true } });
    
    const avgPriceResult = await sequelize.query(
      'SELECT AVG(price) as avgPrice FROM plans WHERE "isActive" = true',
      { type: QueryTypes.SELECT }
    ) as any[];

    const averagePrice = avgPriceResult.length > 0 ? parseFloat(avgPriceResult[0].avgPrice) || 0 : 0;

    res.json({
      success: true,
      data: {
        total: totalPlans,
        active: activePlans,
        draft: draftPlans,
        popular: popularPlans,
        averagePrice
      }
    });
  } catch (error: any) {
    console.error("Get plan stats error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};
