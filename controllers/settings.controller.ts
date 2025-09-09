import type { Request, Response } from "express";
import { AdminConfig } from "../models/AdminConfig.ts";

// Default UPI Configuration
const DEFAULT_UPI_CONFIG = {
  upiId: "admin@paytm",
  upiName: "Universal Guruji",
  bankName: "State Bank of India",
  accountNumber: "****1234",
  ifscCode: "SBIN0001234",
  phoneNumber: "+91 9876543210",
  email: "admin@universalguruji.com"
};

export const getAdminUPIConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get UPI configuration from database
    const upiConfig = await AdminConfig.findOne({
      where: { key: 'upi-config', category: 'payment' }
    });

    let configData = DEFAULT_UPI_CONFIG;
    
    if (upiConfig) {
      try {
        configData = JSON.parse(upiConfig.value);
      } catch (parseError) {
        console.warn("Failed to parse UPI config from database, using defaults");
      }
    } else {
      // Create default UPI config in database if it doesn't exist
      await AdminConfig.create({
        key: 'upi-config',
        value: JSON.stringify(DEFAULT_UPI_CONFIG),
        description: 'Admin UPI payment configuration',
        category: 'payment'
      });
    }

    res.json({
      success: true,
      data: {
        ...configData,
        instructions: [
          "Send the exact amount to the UPI ID mentioned above",
          "After successful payment, you will receive a UTR (Transaction Reference) number",
          "Enter the UTR number in the form below",
          "Your payment will be verified within 24 hours",
          "Once approved, your plan will be activated automatically"
        ]
      }
    });
  } catch (error: any) {
    console.error("Get admin UPI config error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const updateAdminUPIConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { upiId, upiName, bankName, accountNumber, ifscCode, phoneNumber, email } = req.body;

    if (!upiId || !upiName) {
      res.status(400).json({
        success: false,
        message: "UPI ID and UPI Name are required"
      });
      return;
    }

    // Prepare the updated configuration
    const updatedConfig = {
      upiId,
      upiName,
      bankName: bankName || DEFAULT_UPI_CONFIG.bankName,
      accountNumber: accountNumber || DEFAULT_UPI_CONFIG.accountNumber,
      ifscCode: ifscCode || DEFAULT_UPI_CONFIG.ifscCode,
      phoneNumber: phoneNumber || DEFAULT_UPI_CONFIG.phoneNumber,
      email: email || DEFAULT_UPI_CONFIG.email
    };

    // Find existing UPI config or create new one
    const [upiConfig, created] = await AdminConfig.findOrCreate({
      where: { key: 'upi-config', category: 'payment' },
      defaults: {
        key: 'upi-config',
        value: JSON.stringify(updatedConfig),
        description: 'Admin UPI payment configuration',
        category: 'payment'
      }
    });

    if (!created) {
      // Update existing config
      await upiConfig.update({
        value: JSON.stringify(updatedConfig),
        description: 'Admin UPI payment configuration'
      });
    }

    res.json({
      success: true,
      message: "UPI configuration updated successfully",
      data: updatedConfig
    });
  } catch (error: any) {
    console.error("Update admin UPI config error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const getAllAdminConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    
    const whereClause: any = {};
    if (category) {
      whereClause.category = category;
    }

    const configs = await AdminConfig.findAll({
      where: whereClause,
      order: [['category', 'ASC'], ['key', 'ASC']]
    });

    res.json({
      success: true,
      data: configs
    });
  } catch (error: any) {
    console.error("Get all admin configs error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const updateAdminConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value, description, category = 'general' } = req.body;

    if (!key || value === undefined) {
      res.status(400).json({
        success: false,
        message: "Key and value are required"
      });
      return;
    }

    const [config, created] = await AdminConfig.findOrCreate({
      where: { key, category },
      defaults: {
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        description: description || null,
        category
      }
    });

    if (!created) {
      await config.update({
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        description: description || config.description
      });
    }

    res.json({
      success: true,
      message: `Configuration ${created ? 'created' : 'updated'} successfully`,
      data: config
    });
  } catch (error: any) {
    console.error("Update admin config error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const deleteAdminConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, category } = req.params;

    const config = await AdminConfig.findOne({
      where: { key, category }
    });

    if (!config) {
      res.status(404).json({
        success: false,
        message: "Configuration not found"
      });
      return;
    }

    await config.destroy();

    res.json({
      success: true,
      message: "Configuration deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete admin config error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};
