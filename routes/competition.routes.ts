import { Router } from 'express';
import { authenticateJWT } from '../middlewares/protected.js';
import { adminProtected } from '../middlewares/protected.js';
import {
  getAllCompetitions,
  getCompetitionById,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  getAllCompetitionsAdmin,
  upload
} from '../controllers/competition.controller.js';

const router = Router();

// Public routes
router.get('/', getAllCompetitions);
router.get('/:id', getCompetitionById);

// Admin routes
router.get('/admin/all', ...adminProtected, getAllCompetitionsAdmin);
router.post('/admin', ...adminProtected, upload.single('image'), createCompetition);
router.put('/admin/:id', ...adminProtected, upload.single('image'), updateCompetition);
router.delete('/admin/:id', ...adminProtected, deleteCompetition);

export default router;
