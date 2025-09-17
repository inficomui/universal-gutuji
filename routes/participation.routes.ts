import { Router } from 'express';
import { authenticateJWT } from '../middlewares/protected.js';
import { adminProtected } from '../middlewares/protected.js';
import {
  participateInCompetition,
  submitPaymentDetails,
  getMyParticipations,
  getAllParticipations,
  verifyPayment,
  getParticipationById
} from '../controllers/participation.controller.js';

const router = Router();

// User routes
router.post('/competitions/:id/participate', authenticateJWT, participateInCompetition);
router.post('/:id/payment', authenticateJWT, submitPaymentDetails);
router.get('/my', authenticateJWT, getMyParticipations);
router.get('/:id', authenticateJWT, getParticipationById);

// Admin routes
router.get('/admin/all', ...adminProtected, getAllParticipations);
router.put('/admin/:id/verify-payment', ...adminProtected, verifyPayment);

export default router;
