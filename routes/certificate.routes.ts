import { Router } from 'express';
import { authenticateJWT } from '../middlewares/protected.js';
import { adminProtected } from '../middlewares/protected.js';
import {
  requestCertificate,
  getMyCertificateRequests,
  getCertificateRequestDetails,
  downloadCertificate,
  getCertificatePositions,
  getCertificateImageDimensions
} from '../controllers/certificate.controller.js';
import {
  getAllCertificateRequests,
  approveCertificateRequest,
  rejectCertificateRequest,
  generateCertificate,
  generateCertificateWithLevel,
  updateCertificatePositions
} from '../controllers/certificate.controller.js';

const router = Router();

// User routes
router.post('/request', authenticateJWT, requestCertificate);
router.get('/my-requests', authenticateJWT, getMyCertificateRequests);
router.get('/:id', authenticateJWT, getCertificateRequestDetails);
router.get('/:id/positions', authenticateJWT, getCertificatePositions);
router.get('/:id/image-dimensions', authenticateJWT, getCertificateImageDimensions);
router.get('/:id/download', authenticateJWT, downloadCertificate);

// Admin routes
router.get('/admin/all', ...adminProtected, getAllCertificateRequests);
router.put('/admin/:id/approve', ...adminProtected, approveCertificateRequest);
router.put('/admin/:id/reject', ...adminProtected, rejectCertificateRequest);
router.put('/admin/:id/positions', ...adminProtected, updateCertificatePositions);
router.post('/admin/:id/generate', ...adminProtected, generateCertificate);
router.post('/admin/:id/generate-with-level', ...adminProtected, generateCertificateWithLevel);

export default router;
