import type { Request, Response } from "express";
import { Video } from "../models/Video.ts";
import path from "node:path";
import fs from "node:fs";

// GET /api/videos - Get all videos
export const getAllVideos = async (req: Request, res: Response): Promise<void> => {
  try {
    const videos = await Video.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      data: videos
    });
  } catch (error: any) {
    console.error("Get videos error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/videos/:id - Get single video
export const getVideoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const video = await Video.findByPk(id);
    
    if (!video) {
      res.status(404).json({ 
        success: false,
        message: "Video not found" 
      });
      return;
    }
    
    res.json({
      success: true,
      data: video
    });
  } catch (error: any) {
    console.error("Get video error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// POST /api/videos - Create new video
export const createVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, title, description } = req.body;
    
    if (!key || !title) {
      res.status(400).json({ 
        success: false,
        message: "Key and title are required" 
      });
      return;
    }

    // Check if video key already exists
    const existingVideo = await Video.findOne({ where: { key } });
    if (existingVideo) {
      res.status(400).json({ 
        success: false,
        message: "Video with this key already exists" 
      });
      return;
    }

    // Handle file uploads
    let videoPath = '';
    let testPdfPath = '';

    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      
      for (const file of files) {
        if (file.fieldname === 'video') {
          videoPath = `/api/uploads/${file.filename}`;
        } else if (file.fieldname === 'testPdf') {
          testPdfPath = `/api/uploads/${file.filename}`;
        }
      }
    }

    if (!videoPath) {
      res.status(400).json({ 
        success: false,
        message: "Video file is required" 
      });
      return;
    }

    const video = await Video.create({
      key,
      path: videoPath,
      title,
      testPdf: testPdfPath || null,
      description: description || null,
    });

    res.status(201).json({
      success: true,
      message: "Video created successfully",
      data: video
    });
  } catch (error: any) {
    console.error("Create video error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// PUT /api/videos/:id - Update video
export const updateVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { key, title, description, isActive } = req.body;
    
    const video = await Video.findByPk(id);
    if (!video) {
      res.status(404).json({ 
        success: false,
        message: "Video not found" 
      });
      return;
    }

    // Check if new key conflicts with existing videos
    if (key && key !== video.key) {
      const existingVideo = await Video.findOne({ where: { key } });
      if (existingVideo) {
        res.status(400).json({ 
          success: false,
          message: "Video with this key already exists" 
        });
        return;
      }
    }

    // Handle file uploads
    let videoPath = video.path;
    let testPdfPath = video.testPdf;

    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      
      for (const file of files) {
        if (file.fieldname === 'video') {
          // Delete old video file
          if (video.path) {
            const oldPath = path.join(process.cwd(), 'uploads', path.basename(video.path));
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          videoPath = `/api/uploads/${file.filename}`;
        } else if (file.fieldname === 'testPdf') {
          // Delete old PDF file
          if (video.testPdf) {
            const oldPath = path.join(process.cwd(), 'uploads', path.basename(video.testPdf));
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          testPdfPath = `/api/uploads/${file.filename}`;
        }
      }
    }

    await video.update({
      key: key || video.key,
      title: title || video.title,
      description: description !== undefined ? description : video.description,
      isActive: isActive !== undefined ? isActive : video.isActive,
      path: videoPath,
      testPdf: testPdfPath,
    });

    res.json({
      success: true,
      message: "Video updated successfully",
      data: video
    });
  } catch (error: any) {
    console.error("Update video error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// DELETE /api/videos/:id - Delete video (soft delete)
export const deleteVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const video = await Video.findByPk(id);
    if (!video) {
      res.status(404).json({ 
        success: false,
        message: "Video not found" 
      });
      return;
    }

    // Soft delete by setting isActive to false
    await video.update({ isActive: false });

    res.json({
      success: true,
      message: "Video deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete video error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/videos/:id/stream - Stream video file
export const streamVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const video = await Video.findByPk(id);
    if (!video) {
      res.status(404).json({ 
        success: false,
        message: "Video not found" 
      });
      return;
    }

    const videoPath = path.join(process.cwd(), 'uploads', path.basename(video.path));
    
    if (!fs.existsSync(videoPath)) {
      res.status(404).json({ 
        success: false,
        message: "Video file not found" 
      });
      return;
    }

    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Stream the video file
    const videoStream = fs.createReadStream(videoPath);
    videoStream.pipe(res);
  } catch (error: any) {
    console.error("Stream video error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};
