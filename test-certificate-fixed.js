import { CertificateRequest, CertificateStatus } from './models/CertificateRequest.js';
import { Level } from './models/Level.js';
import { CertificateService } from './services/certificateService.js';
import { sequelize } from './utils/db.js';

async function createFixedTestCertificate() {
  try {
    console.log('🎯 Creating fixed test certificate...');
    
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
      studentName: 'Alice Johnson',
      parentName: 'Robert Johnson',
      levelName: level.name,
      emailTo: 'alice@example.com',
      status: CertificateStatus.APPROVED,
      certificateNo: 'CERT-2025-001'
    });
    
    console.log('✅ Created test certificate request:', testRequest.id);
    
    // Better positioned text for 1024x1024 image
    const customPositions = {
      studentName: { x: 512, y: 400, fontSize: 48, anchor: 'center' },
      parentName: { x: 512, y: 450, fontSize: 32, anchor: 'center' },
      levelName: { x: 512, y: 500, fontSize: 40, anchor: 'center' },
      date: { x: 512, y: 550, fontSize: 28, anchor: 'center' },
      certificateNo: { x: 512, y: 600, fontSize: 24, anchor: 'center' }
    };
    
    testRequest.setPositions(customPositions);
    await testRequest.save();
    
    console.log('✅ Set improved positions for 1024x1024 image');
    console.log('📐 Positions:', customPositions);
    
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
    
    console.log('🎉 Fixed test certificate created successfully!');
    console.log('📁 Image path:', imagePath);
    console.log('📄 PDF path:', pdfPath);
    console.log('🌐 View image at:', `http://localhost:5000${imagePath}`);
    
    // Also create a test with different positions for comparison
    console.log('\n🔄 Creating alternative positioning test...');
    
    const altRequest = await CertificateRequest.create({
      userId: 1,
      levelId: level.id,
      studentName: 'Michael Smith',
      parentName: 'Sarah Smith',
      levelName: level.name,
      emailTo: 'michael@example.com',
      status: CertificateStatus.APPROVED,
      certificateNo: 'CERT-2025-002'
    });
    
    // Alternative positioning - more towards center
    const altPositions = {
      studentName: { x: 512, y: 350, fontSize: 44, anchor: 'center' },
      parentName: { x: 512, y: 400, fontSize: 30, anchor: 'center' },
      levelName: { x: 512, y: 450, fontSize: 36, anchor: 'center' },
      date: { x: 512, y: 500, fontSize: 26, anchor: 'center' },
      certificateNo: { x: 512, y: 550, fontSize: 22, anchor: 'center' }
    };
    
    altRequest.setPositions(altPositions);
    await altRequest.save();
    
    const altImagePath = await CertificateService.generateCertificateImage(
      altRequest,
      level.certificatePng.replace('/uploads', './uploads'),
      true
    );
    
    console.log('✅ Alternative certificate created:', altImagePath);
    console.log('🌐 View alternative at:', `http://localhost:5000${altImagePath}`);
    
  } catch (error) {
    console.error('❌ Error creating test certificate:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
createFixedTestCertificate();
