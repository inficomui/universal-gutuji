import { CertificateRequest, CertificateStatus } from './models/CertificateRequest.js';
import { Level } from './models/Level.js';
import { CertificateService } from './services/certificateService.js';
import { sequelize } from './utils/db.js';

async function createOptimalTestCertificate() {
  try {
    console.log('🎯 Creating optimal test certificate...');
    
    // Find Level 1
    const level = await Level.findOne({ where: { name: 'Level 1' } });
    if (!level) {
      console.error('❌ Level 1 not found.');
      return;
    }
    
    console.log('✅ Found Level 1:', level.name);
    console.log('📄 Certificate template:', level.certificatePng);
    
    // Create a new test certificate request
    const testRequest = await CertificateRequest.create({
      userId: 1,
      levelId: level.id,
      studentName: 'Priya Sharma',
      parentName: 'Rajesh Sharma',
      levelName: level.name,
      emailTo: 'priya@example.com',
      status: CertificateStatus.APPROVED,
      certificateNo: 'CERT-2025-003'
    });
    
    console.log('✅ Created test certificate request:', testRequest.id);
    
    // Optimal positioning to avoid watermark and center properly
    const optimalPositions = {
      studentName: { x: 512, y: 320, fontSize: 52, anchor: 'center' },
      parentName: { x: 512, y: 380, fontSize: 36, anchor: 'center' },
      levelName: { x: 512, y: 440, fontSize: 44, anchor: 'center' },
      date: { x: 512, y: 500, fontSize: 32, anchor: 'center' },
      certificateNo: { x: 512, y: 560, fontSize: 28, anchor: 'center' }
    };
    
    testRequest.setPositions(optimalPositions);
    await testRequest.save();
    
    console.log('✅ Set optimal positions for 1024x1024 image');
    console.log('📐 Positions:', optimalPositions);
    
    // Generate the certificate image
    const imagePath = await CertificateService.generateCertificateImage(
      testRequest,
      level.certificatePng.replace('/uploads', './uploads'),
      true // Use direct positions
    );
    
    console.log('✅ Generated certificate image:', imagePath);
    
    // Generate PDF as well
    const pdfPath = await CertificateService.generateCertificatePDF(testRequest, imagePath);
    console.log('✅ Generated certificate PDF:', pdfPath);
    
    // Update the request with file paths
    testRequest.imagePath = imagePath;
    testRequest.pdfPath = pdfPath;
    testRequest.status = CertificateStatus.ISSUED;
    testRequest.issuedAt = new Date();
    await testRequest.save();
    
    console.log('🎉 Optimal test certificate created successfully!');
    console.log('📁 Image path:', imagePath);
    console.log('📄 PDF path:', pdfPath);
    console.log('🌐 View image at:', `http://localhost:5000${imagePath}`);
    
    // Create another test with different positioning
    console.log('\n🔄 Creating professional positioning test...');
    
    const proRequest = await CertificateRequest.create({
      userId: 1,
      levelId: level.id,
      studentName: 'Amit Kumar',
      parentName: 'Sunita Kumar',
      levelName: level.name,
      emailTo: 'amit@example.com',
      status: CertificateStatus.APPROVED,
      certificateNo: 'CERT-2025-004'
    });
    
    // Professional positioning - higher up to avoid any watermarks
    const proPositions = {
      studentName: { x: 512, y: 300, fontSize: 50, anchor: 'center' },
      parentName: { x: 512, y: 360, fontSize: 34, anchor: 'center' },
      levelName: { x: 512, y: 420, fontSize: 42, anchor: 'center' },
      date: { x: 512, y: 480, fontSize: 30, anchor: 'center' },
      certificateNo: { x: 512, y: 540, fontSize: 26, anchor: 'center' }
    };
    
    proRequest.setPositions(proPositions);
    await proRequest.save();
    
    const proImagePath = await CertificateService.generateCertificateImage(
      proRequest,
      level.certificatePng.replace('/uploads', './uploads'),
      true
    );
    
    console.log('✅ Professional certificate created:', proImagePath);
    console.log('🌐 View professional at:', `http://localhost:5000${proImagePath}`);
    
  } catch (error) {
    console.error('❌ Error creating test certificate:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
createOptimalTestCertificate();
