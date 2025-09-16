import { sequelize } from '../utils/db.ts';
import { AdminConfig } from '../models/AdminConfig.ts';

const seedAdminConfig = async () => {
  try {
    console.log('🌱 Seeding admin configuration...');

    // Default UPI configuration
    const upiConfig = {
      upiId: "admin@paytm",
      upiName: "Universal Guruji",
      bankName: "State Bank of India",
      accountNumber: "****1234",
      ifscCode: "SBIN0001234",
      phoneNumber: "+91 9876543210",
      email: "admin@universalguruji.com"
    };

    // Create or update UPI config
    const [upiConfigRecord, created] = await AdminConfig.findOrCreate({
      where: { key: 'upi-config', category: 'payment' },
      defaults: {
        key: 'upi-config',
        value: JSON.stringify(upiConfig),
        description: 'Admin UPI payment configuration',
        category: 'payment'
      }
    });

    if (!created) {
      await upiConfigRecord.update({
        value: JSON.stringify(upiConfig),
        description: 'Admin UPI payment configuration'
      });
      console.log('✅ Updated existing UPI configuration');
    } else {
      console.log('✅ Created new UPI configuration');
    }

    // Additional system configurations
    const systemConfigs = [
      {
        key: 'site-name',
        value: 'Universal Guruji',
        description: 'Website name',
        category: 'system'
      },
      {
        key: 'site-description',
        value: 'Universal Guruji MLM Platform',
        description: 'Website description',
        category: 'system'
      },
      {
        key: 'contact-email',
        value: 'support@universalguruji.com',
        description: 'Support email address',
        category: 'email'
      },
      {
        key: 'payment-timeout',
        value: '24',
        description: 'Payment verification timeout in hours',
        category: 'payment'
      },
      {
        key: 'sponsor-bonus',
        value: '500',
        description: 'Sponsor bonus amount in rupees when referred user buys a plan',
        category: 'payment'
      }
    ];

    for (const config of systemConfigs) {
      const [record, created] = await AdminConfig.findOrCreate({
        where: { key: config.key, category: config.category },
        defaults: config
      });

      if (!created) {
        await record.update(config);
        console.log(`✅ Updated ${config.key} configuration`);
      } else {
        console.log(`✅ Created ${config.key} configuration`);
      }
    }

    console.log('🎉 Admin configuration seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin configuration:', error);
    process.exit(1);
  }
};

// Run the seeder
seedAdminConfig();
