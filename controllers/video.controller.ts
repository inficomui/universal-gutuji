import type { Request, Response } from "express";
import { Video } from "../models/Video.ts";
import path from "node:path";
import fs from "node:fs";
import QRCode from "qrcode"
// GET /api/videos - Get all videos with optional level filtering and pagination
export const getAllVideos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { levelId, page = '1', limit = '20' } = req.query;
    
    // Parse pagination parameters
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    // Validate pagination parameters
    if (isNaN(pageNum) || pageNum < 1) {
      res.status(400).json({
        success: false,
        message: "Invalid page number. Must be a positive integer."
      });
      return;
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        success: false,
        message: "Invalid limit. Must be between 1 and 100."
      });
      return;
    }
    
    const offset = (pageNum - 1) * limitNum;
    const whereClause: any = { isActive: true };
    
    // Add level filtering if levelId is provided
    if (levelId) {
      whereClause.levelId = levelId;
    }
    
    // Get total count for pagination info
    const totalCount = await Video.count({ where: whereClause });
    
    // Get paginated videos
    const videos = await Video.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset: offset
    });
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    res.json({
      success: true,
      data: videos,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      }
    });
  } catch (error: any) {
    console.error("Get videos error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};

// GET /api/videos/level/:levelId - Get videos by level with pagination
export const getVideosByLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { levelId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    
    // Parse pagination parameters
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    // Validate pagination parameters
    if (isNaN(pageNum) || pageNum < 1) {
      res.status(400).json({
        success: false,
        message: "Invalid page number. Must be a positive integer."
      });
      return;
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        success: false,
        message: "Invalid limit. Must be between 1 and 100."
      });
      return;
    }
    
    const offset = (pageNum - 1) * limitNum;
    const whereClause = { 
      levelId: levelId,
      isActive: true 
    };
    
    // Get total count for pagination info
    const totalCount = await Video.count({ where: whereClause });
    
    // Get paginated videos
    const videos = await Video.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset: offset
    });
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    res.json({
      success: true,
      data: videos,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
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
// POST /api/videos - Create new video
export const createVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, title, description, levelId } = req.body;
    
    if (!key) {  // Only require key now
      res.status(400).json({ 
        success: false,
        message: "Key is required" 
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
          videoPath = `uploads/${file.filename}`;
        } else if (file.fieldname === 'testPdf') {
          testPdfPath = `uploads/${file.filename}`;
        }
      }
    }

    // Remove this validation - video file is now optional
    // if (!videoPath) {
    //   res.status(400).json({ 
    //     success: false,
    //     message: "Video file is required" 
    //   });
    //   return;
    // }

    const video = await Video.create({
      key,
      path: videoPath || null, // Allow null path
      title: title || '', // Provide default empty string
      testPdf: testPdfPath || null,
      description: description || null,
      levelId: levelId || null,
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
    const { key, title, description, isActive, levelId } = req.body;
    
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
      levelId: levelId !== undefined ? levelId : video.levelId,
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
// controllers/videoStream.ts


export const streamVideo = async (req: Request, res: Response): Promise<void> => {
  const { filename } = req.params;
  const videoPath = path.resolve(process.cwd(), 'uploads', filename);

  if (!fs.existsSync(videoPath)) {
    res.status(404).json({ success: false, message: 'Video not found' });
    return;
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    const chunksize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });

    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'inline',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
};


export const generateVideoQRCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const video = await Video.findByPk(id);
    if (!video || !video.path) {
      res.status(404).json({ success: false, message: "Video not found or has no path" });
      return;
    }

    const filename = path.basename(video.path);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const streamUrl = `${baseUrl}/api/videos/stream/${filename}`;

    const qrCodeDataURL = await QRCode.toDataURL(streamUrl);

    res.json({
      success: true,
      data: {
        videoId: id,
        streamUrl,
        qrCode: qrCodeDataURL,
      },
    });
  } catch (error: any) {
    console.error("QR code generation error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// GET /api/videos/key/:key - Get single video by key
export const getVideoByKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const video = await Video.findOne({ 
      where: { 
        key: key,
        isActive: true 
      } 
    });
    
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
    console.error("Get video by key error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server error" 
    });
  }
};