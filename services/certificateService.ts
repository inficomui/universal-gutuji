import sharp from 'sharp';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { CertificateRequest, CertificatePositions } from '../models/CertificateRequest.js';
import { Level } from '../models/Level.js';

export class CertificateService {
  private static readonly STORAGE_DIR = process.env.FILE_STORAGE_DIR || './storage/certificates';
  private static readonly PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

  // Ensure storage directory exists
  static async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.STORAGE_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating storage directory:', error);
      throw error;
    }
  }

  // Generate certificate image using level PNG
  static async generateCertificateImageWithLevel(
    certificateRequest: CertificateRequest,
    level: Level
  ): Promise<string> {
    try {
      await this.ensureStorageDir();

      if (!level.certificatePng) {
        throw new Error('Level does not have a certificate PNG image');
      }

      // Load the level's certificate PNG
      const levelImagePath = level.certificatePng.replace('/uploads', './uploads');
      const levelImageBuffer = await fs.readFile(levelImagePath);
      
      // Generate certificate number if not exists
      const certificateNo = certificateRequest.certificateNo || await this.generateCertificateNumber();

      // Create SVG overlay with user details
      const svgOverlay = this.createLevelSVGOverlay({
        studentName: certificateRequest.studentName,
        parentName: certificateRequest.parentName,
        levelName: certificateRequest.levelName,
        date: new Date().toLocaleDateString('en-IN'),
        certificateNo: certificateNo
      });

      // Apply text overlay to level image
      const outputBuffer = await sharp(levelImageBuffer)
        .composite([
          {
            input: Buffer.from(svgOverlay),
            top: 0,
            left: 0
          }
        ])
        .png()
        .toBuffer();

      // Save the generated certificate
      const filename = `certificate_${certificateRequest.id}_${Date.now()}.png`;
      const filePath = path.join(this.STORAGE_DIR, filename);

      await fs.writeFile(filePath, outputBuffer);

      return `/storage/certificates/${filename}`;
    } catch (error) {
      console.error('Error generating certificate image with level:', error);
      throw error;
    }
  }

  // Generate certificate image (legacy method for backward compatibility)
  static async generateCertificateImage(
    certificateRequest: CertificateRequest,
    templatePath: string,
    useDirectPositions: boolean = false
  ): Promise<string> {
    try {
      await this.ensureStorageDir();

      // Load the template image
      const templateBuffer = await fs.readFile(templatePath);
      
      // Get image metadata to get actual dimensions
      const imageMetadata = await sharp(templateBuffer).metadata();
      const imageWidth = imageMetadata.width || 800;
      const imageHeight = imageMetadata.height || 600;
      
      console.log('Image dimensions:', { width: imageWidth, height: imageHeight });
      
      // Get positions
      const positions = certificateRequest.getPositions();
      console.log('Original positions:', positions);
      
      // Use positions directly or scale them
      const finalPositions = useDirectPositions ? positions : this.scalePositionsToImage(positions, imageWidth, imageHeight);
      console.log('Final positions:', finalPositions);
      
      // Generate certificate number if not exists
      const certificateNo = certificateRequest.certificateNo || await this.generateCertificateNumber();
      
      // Create SVG overlay with text using final positions
      const svgOverlay = this.createSVGOverlay(finalPositions, imageWidth, imageHeight, {
        studentName: certificateRequest.studentName,
        parentName: certificateRequest.parentName,
        levelName: certificateRequest.levelName,
        date: new Date().toLocaleDateString('en-IN'),
        certificateNo: certificateNo
      });

      // Apply text overlay to image
      const outputBuffer = await sharp(templateBuffer)
        .composite([
          {
            input: Buffer.from(svgOverlay),
            top: 0,
            left: 0
          }
        ])
        .png()
        .toBuffer();

      // Save the generated certificate
      const filename = `certificate_${certificateRequest.id}_${Date.now()}.png`;
      const filePath = path.join(this.STORAGE_DIR, filename);
      
      await fs.writeFile(filePath, outputBuffer);
      
      return `/storage/certificates/${filename}`;
    } catch (error) {
      console.error('Error generating certificate image:', error);
      throw error;
    }
  }

  // Generate certificate PDF
  static async generateCertificatePDF(
    certificateRequest: CertificateRequest,
    imagePath: string
  ): Promise<string> {
    try {
      await this.ensureStorageDir();

      // Load the certificate image
      const imageBuffer = await fs.readFile(imagePath.replace('/storage/certificates', this.STORAGE_DIR));
      
      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([800, 600]); // A4 size
      
      // Embed the image
      const image = await pdfDoc.embedPng(imageBuffer);
      
      // Draw the image to fill the page
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: 800,
        height: 600
      });

      // Add additional text overlay if needed
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const positions = certificateRequest.getPositions();
      
      // Convert positions to PDF coordinates (PDF has origin at bottom-left)
      const pdfY = (y: number) => 600 - y;
      
      page.drawText(certificateRequest.studentName, {
        x: positions.studentName.x,
        y: pdfY(positions.studentName.y),
        size: positions.studentName.fontSize,
        font: font,
        color: rgb(0, 0, 0)
      });

      page.drawText(certificateRequest.parentName, {
        x: positions.parentName.x,
        y: pdfY(positions.parentName.y),
        size: positions.parentName.fontSize,
        font: font,
        color: rgb(0, 0, 0)
      });

      page.drawText(certificateRequest.levelName, {
        x: positions.levelName.x,
        y: pdfY(positions.levelName.y),
        size: positions.levelName.fontSize,
        font: font,
        color: rgb(0, 0, 0)
      });

      page.drawText(new Date().toLocaleDateString('en-IN'), {
        x: positions.date.x,
        y: pdfY(positions.date.y),
        size: positions.date.fontSize,
        font: font,
        color: rgb(0, 0, 0)
      });

      page.drawText(certificateRequest.certificateNo || '', {
        x: positions.certificateNo.x,
        y: pdfY(positions.certificateNo.y),
        size: positions.certificateNo.fontSize,
        font: font,
        color: rgb(0, 0, 0)
      });

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const filename = `certificate_${certificateRequest.id}_${Date.now()}.pdf`;
      const filePath = path.join(this.STORAGE_DIR, filename);
      
      await fs.writeFile(filePath, pdfBytes);
      
      return `/storage/certificates/${filename}`;
    } catch (error) {
      console.error('Error generating certificate PDF:', error);
      throw error;
    }
  }

  // Scale positions to match actual image dimensions
  private static scalePositionsToImage(
    positions: CertificatePositions, 
    imageWidth: number, 
    imageHeight: number
  ): CertificatePositions {
    // Default reference dimensions (what the frontend uses)
    const referenceWidth = 800;
    const referenceHeight = 600;
    
    // Calculate scale factors
    const scaleX = imageWidth / referenceWidth;
    const scaleY = imageHeight / referenceHeight;
    
    // Use average scale for font size to maintain readability
    const fontScale = (scaleX + scaleY) / 2;
    
    return {
      studentName: {
        x: Math.round(positions.studentName.x * scaleX),
        y: Math.round(positions.studentName.y * scaleY),
        fontSize: Math.max(12, Math.round(positions.studentName.fontSize * fontScale)),
        anchor: positions.studentName.anchor
      },
      parentName: {
        x: Math.round(positions.parentName.x * scaleX),
        y: Math.round(positions.parentName.y * scaleY),
        fontSize: Math.max(10, Math.round(positions.parentName.fontSize * fontScale)),
        anchor: positions.parentName.anchor
      },
      levelName: {
        x: Math.round(positions.levelName.x * scaleX),
        y: Math.round(positions.levelName.y * scaleY),
        fontSize: Math.max(12, Math.round(positions.levelName.fontSize * fontScale)),
        anchor: positions.levelName.anchor
      },
      date: {
        x: Math.round(positions.date.x * scaleX),
        y: Math.round(positions.date.y * scaleY),
        fontSize: Math.max(10, Math.round(positions.date.fontSize * fontScale)),
        anchor: positions.date.anchor
      },
      certificateNo: {
        x: Math.round(positions.certificateNo.x * scaleX),
        y: Math.round(positions.certificateNo.y * scaleY),
        fontSize: Math.max(8, Math.round(positions.certificateNo.fontSize * fontScale)),
        anchor: positions.certificateNo.anchor
      }
    };
  }

  // Create SVG overlay for template-based certificates
  private static createTemplateSVGOverlay(
    templateData: CertificateTemplateData,
    canvasWidth: number,
    canvasHeight: number,
    data: {
      studentName: string;
      parentName: string;
      levelName: string;
      date: string;
      certificateNo: string;
    }
  ): string {
    const elements: string[] = [];

    // Add border if enabled
    if (templateData.border.enabled) {
      const borderStyle = templateData.border.style === 'dashed' ? 'stroke-dasharray: 5,5' : 
                         templateData.border.style === 'dotted' ? 'stroke-dasharray: 2,2' : '';
      
      elements.push(`
        <rect x="${templateData.border.width/2}" 
              y="${templateData.border.width/2}" 
              width="${canvasWidth - templateData.border.width}" 
              height="${canvasHeight - templateData.border.width}" 
              fill="none" 
              stroke="${templateData.border.color}" 
              stroke-width="${templateData.border.width}"
              style="${borderStyle}" />
      `);
    }

    // Add logo if enabled
    if (templateData.logo.enabled && templateData.logo.imagePath) {
      elements.push(`
        <image x="${templateData.logo.x}" 
               y="${templateData.logo.y}" 
               width="${templateData.logo.width}" 
               height="${templateData.logo.height}" 
               href="${templateData.logo.imagePath}" />
      `);
    }

    // Add signature if enabled
    if (templateData.signature.enabled && templateData.signature.imagePath) {
      elements.push(`
        <image x="${templateData.signature.x}" 
               y="${templateData.signature.y}" 
               width="${templateData.signature.width}" 
               height="${templateData.signature.height}" 
               href="${templateData.signature.imagePath}" />
      `);
    }

    // Add all text elements
    const textElements = [
      { key: 'title', data: templateData.title.text },
      { key: 'subtitle', data: templateData.subtitle.text },
      { key: 'studentName', data: data.studentName },
      { key: 'parentName', data: data.parentName },
      { key: 'levelName', data: data.levelName },
      { key: 'date', data: data.date },
      { key: 'certificateNo', data: `Certificate No: ${data.certificateNo}` },
      { key: 'footer', data: templateData.footer.text }
    ];

    textElements.forEach(({ key, data: textData }) => {
      const config = templateData[key as keyof CertificateTemplateData] as any;
      if (config && textData) {
        const textAnchor = config.anchor === 'left' ? 'start' : 
                          config.anchor === 'right' ? 'end' : 'middle';
        
        elements.push(`
          <text x="${config.x}" 
                y="${config.y}" 
                font-family="${config.fontFamily}" 
                font-size="${config.fontSize}" 
                fill="${config.color}" 
                text-anchor="${textAnchor}">${textData}</text>
        `);
      }
    });

    const svg = `
      <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
        ${elements.join('\n')}
      </svg>
    `;
    
    return svg;
  }

  // Create simple SVG overlay for level images
  private static createLevelSVGOverlay(data: {
    studentName: string;
    parentName: string;
    levelName: string;
    date: string;
    certificateNo: string;
  }): string {
    return `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <!-- Student Name -->
        <text x="400" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#1f2937">
          ${data.studentName}
        </text>
        
        <!-- Parent Name -->
        <text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#4b5563">
          ${data.parentName}
        </text>
        
        <!-- Level Name -->
        <text x="400" y="350" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#1f2937">
          ${data.levelName}
        </text>
        
        <!-- Date -->
        <text x="400" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#6b7280">
          ${data.date}
        </text>
        
        <!-- Certificate Number -->
        <text x="400" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af">
          Certificate No: ${data.certificateNo}
        </text>
      </svg>
    `;
  }

  // Convert hex color to RGB
  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  // Create SVG overlay for text (legacy method)
  private static createSVGOverlay(
    positions: CertificatePositions,
    imageWidth: number,
    imageHeight: number,
    data: {
      studentName: string;
      parentName: string;
      levelName: string;
      date: string;
      certificateNo: string;
    }
  ): string {
    const svg = `
      <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .cert-text {
              font-family: 'Arial', sans-serif;
              font-weight: bold;
              fill: #2c3e50;
              text-anchor: middle;
            }
          </style>
        </defs>
        
        <text x="${positions.studentName.x}" y="${positions.studentName.y}" 
              font-size="${positions.studentName.fontSize}" 
              class="cert-text">${data.studentName}</text>
        
        <text x="${positions.parentName.x}" y="${positions.parentName.y}" 
              font-size="${positions.parentName.fontSize}" 
              class="cert-text">${data.parentName}</text>
        
        <text x="${positions.levelName.x}" y="${positions.levelName.y}" 
              font-size="${positions.levelName.fontSize}" 
              class="cert-text">${data.levelName}</text>
        
        <text x="${positions.date.x}" y="${positions.date.y}" 
              font-size="${positions.date.fontSize}" 
              class="cert-text">${data.date}</text>
        
        <text x="${positions.certificateNo.x}" y="${positions.certificateNo.y}" 
              font-size="${positions.certificateNo.fontSize}" 
              class="cert-text">Certificate No: ${data.certificateNo}</text>
      </svg>
    `;
    
    return svg;
  }

  // Generate unique certificate number
  private static async generateCertificateNumber(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `CERT-${timestamp}-${random}`.toUpperCase();
  }

  // Get public URL for file
  static getPublicUrl(filePath: string): string {
    if (filePath.startsWith('http')) {
      return filePath;
    }
    return `${this.PUBLIC_BASE_URL}${filePath}`;
  }

  // Clean up old files (optional utility)
  static async cleanupOldFiles(daysOld: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(this.STORAGE_DIR);
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        const filePath = path.join(this.STORAGE_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}
