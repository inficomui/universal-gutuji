import express from "express";
import * as pdfController from "../controllers/pdf.controller.ts";
import { authenticateJWT } from "../middlewares/protected.ts";

const pdfRoutes = express.Router();

// PDF download routes (authenticated users only)
pdfRoutes.get("/plan-request/:planRequestId", 
  authenticateJWT, 
  pdfController.downloadPaymentSlip
);

pdfRoutes.get("/all-plan-requests", 
  authenticateJWT, 
  pdfController.downloadAllPaymentSlips
);

export default pdfRoutes;
