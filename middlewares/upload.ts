import type { Request } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Where to store files on disk
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure the folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Create a safe, unique filename
function makeFilename(originalName: string) {
  const ext = path.extname(originalName).toLowerCase();
  const base = path
    .basename(originalName, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // slugify
    .replace(/(^-|-$)/g, '');
  const rand = crypto.randomBytes(6).toString('hex');
  return `${base}-${Date.now()}-${rand}${ext}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, makeFilename(file.originalname)),
});

const allowedImages = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const allowedVideos = new Set([
  'video/mp4',
  'video/avi',
  'video/mov',
  'video/wmv',
  'video/flv',
  'video/webm',
]);

const allowedDocuments = new Set([
  'application/pdf',
]);

const imageFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void =
  (_req, file, cb) => {
    if (allowedImages.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed!'));
  };

const videoFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void =
  (_req, file, cb) => {
    if (allowedVideos.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only video files are allowed!'));
  };

const documentFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void =
  (_req, file, cb) => {
    if (allowedDocuments.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF files are allowed!'));
  };

const mixedFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void =
  (_req, file, cb) => {
    if (allowedImages.has(file.mimetype) || 
        allowedVideos.has(file.mimetype) || 
        allowedDocuments.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image, video, and PDF files are allowed!'));
    }
  };

// Multer instances for different file types
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const uploadVideo = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for videos
  fileFilter: videoFilter,
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for PDFs
  fileFilter: documentFilter,
});

export const uploadMixed = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: mixedFilter,
});

// Helper to get a public URL path you can save in DB
export const toPublicUrl = (filename: string) => `/uploads/${filename}`;
