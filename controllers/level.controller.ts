import type { Request, Response } from "express";
import { Level } from "../models/Level.ts";
import { toPublicUrl } from "../middlewares/upload.ts";

// GET /api/levels - Get all levels
export const getAllLevels = async (req: Request, res: Response): Promise<void> => {
  try {
    const levels = await Level.findAll({
      order: [['createdAt', 'ASC']]
    });
    
    res.json({
      success: true,
      data: levels
    });
  } catch (error: any) {
    console.error("Get levels error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/levels/active - Get only active levels
export const getActiveLevels = async (req: Request, res: Response): Promise<void> => {
  try {
    const levels = await Level.scope('active').findAll({
      order: [['createdAt', 'ASC']]
    });
    
    res.json({
      success: true,
      data: levels
    });
  } catch (error: any) {
    console.error("Get active levels error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/levels/:id - Get single level
export const getLevelById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const level = await Level.findByPk(id);
    
    if (!level) {
      res.status(404).json({ 
        success: false,
        message: "Level not found" 
      });
      return;
    }
    
    res.json({
      success: true,
      data: level
    });
  } catch (error: any) {
    console.error("Get level error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// POST /api/levels - Create new level
export const createLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    // Check for file upload errors
    if ((req as any).fileValidationError) {
      res.status(400).json({
        success: false,
        message: (req as any).fileValidationError
      });
      return;
    }

    // Validate required fields
    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Level name is required"
      });
      return;
    }

    // Check if level with same name already exists
    const existingLevel = await Level.findOne({
      where: { name: name.trim() }
    });

    if (existingLevel) {
      res.status(409).json({
        success: false,
        message: "Level with this name already exists"
      });
      return;
    }

    // Handle uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const testPdfFile = files?.testPdf?.[0];
    const certificatePngFile = files?.certificatePng?.[0];

    // Validate that at least one file is provided
    if (!testPdfFile && !certificatePngFile) {
      res.status(400).json({
        success: false,
        message: "At least one file (test PDF or certificate image) is required"
      });
      return;
    }

    const level = await Level.create({
      name: name.trim(),
      testPdf: testPdfFile ? toPublicUrl(testPdfFile.filename) : null,
      certificatePng: certificatePngFile ? toPublicUrl(certificatePngFile.filename) : null
    });
    
    res.status(201).json({
      success: true,
      data: level,
      message: "Level created successfully"
    });
  } catch (error: any) {
    console.error("Create level error:", error);
    
    // Handle duplicate name error
    if (error.name === 'SequelizeUniqueConstraintError' && error.errors?.[0]?.path === 'name') {
      res.status(409).json({
        success: false,
        message: "Level with this name already exists"
      });
      return;
    }
    
    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 10MB"
      });
      return;
    }

    if (error.message && (error.message.includes('Only PDF files are allowed') || error.message.includes('Only image files are allowed'))) {
      res.status(400).json({
        success: false,
        message: "Test file must be PDF and certificate file must be an image (PNG, JPG, JPEG, WEBP, GIF, AVIF)"
      });
      return;
    }
    
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// PUT /api/levels/:id - Update level
export const updateLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const level = await Level.findByPk(id);
    
    if (!level) {
      res.status(404).json({ 
        success: false,
        message: "Level not found" 
      });
      return;
    }

    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: "Level name cannot be empty"
        });
        return;
      }

      // Check if another level with same name exists
      const existingLevel = await Level.findOne({
        where: { 
          name: name.trim(),
          id: { [require('sequelize').Op.ne]: id }
        }
      });

      if (existingLevel) {
        res.status(409).json({
          success: false,
          message: "Level with this name already exists"
        });
        return;
      }

      level.name = name.trim();
    }

    // Update isActive if provided
    if (isActive !== undefined) {
      level.isActive = Boolean(isActive);
    }

    await level.save();
    
    res.json({
      success: true,
      data: level,
      message: "Level updated successfully"
    });
  } catch (error: any) {
    console.error("Update level error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// DELETE /api/levels/:id - Delete level (soft delete by setting isActive to false)
export const deleteLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const level = await Level.findByPk(id);
    
    if (!level) {
      res.status(404).json({ 
        success: false,
        message: "Level not found" 
      });
      return;
    }

    // Soft delete by setting isActive to false
    level.isActive = false;
    await level.save();
    
    res.json({
      success: true,
      message: "Level deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete level error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/levels/:id/videos - Get videos for a specific level
export const getVideosByLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { Video } = await import("../models/Video.ts");

    const level = await Level.findByPk(id);
    
    if (!level) {
      res.status(404).json({ 
        success: false,
        message: "Level not found" 
      });
      return;
    }

    const videos = await Video.findAll({
      where: { 
        levelId: id,
        isActive: true 
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      data: {
        level,
        videos
      }
    });
  } catch (error: any) {
    console.error("Get videos by level error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};
