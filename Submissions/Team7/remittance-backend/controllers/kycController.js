const KYCModel = require('../models/KYC');
const path = require('path');
const fs = require('fs');

const KYCController = {
  /**
   * Get user's KYC verification status
   */
  async getKYCStatus(req, res) {
    try {
      const userId = req.user.id;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const kycStatus = await KYCModel.getKYCStatusByUserId(userId);
      res.json(kycStatus);
    } catch (error) {
      console.error("Error getting KYC status:", error);
      res.status(500).json({ error: "Failed to get KYC status" });
    }
  },
  
  /**
   * Submit KYC document for verification
   */
  async submitKYCDocument(req, res) {
    try {
      const userId = req.user.id;
      const { documentType } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      if (!documentType) {
        return res.status(400).json({ error: "Document type is required" });
      }
      
      // Update KYC status (mark this step as completed)
      const updatedStatus = await KYCModel.completeStep(userId, "document_upload");
      
      res.json({
        message: "Document uploaded successfully",
        documentType,
        fileName: req.file.filename,
        kycStatus: updatedStatus
      });
    } catch (error) {
      console.error("Error submitting KYC document:", error);
      res.status(500).json({ error: "Failed to submit document for verification" });
    }
  },
  
  /**
   * Complete a KYC verification step
   */
  async completeKYCStep(req, res) {
    try {
      const userId = req.user.id;
      const { stepName } = req.body;
      
      if (!stepName) {
        return res.status(400).json({ error: "Step name is required" });
      }
      
      const validSteps = ["basic_info", "personal_details", "address_verification", "document_verification"];
      if (!validSteps.includes(stepName)) {
        return res.status(400).json({ error: "Invalid step name" });
      }
      
      const updatedStatus = await KYCModel.completeStep(userId, stepName);
      
      // Send WebSocket notification
      const io = req.app.get("io");
      if (io) {
        io.sendRealTimeUpdate(userId, "kycStepComplete", {
          step: stepName,
          kycStatus: updatedStatus
        });
      }
      
      res.json({
        message: `${stepName} step completed successfully`,
        kycStatus: updatedStatus
      });
    } catch (error) {
      console.error("Error completing KYC step:", error);
      res.status(500).json({ error: "Failed to complete KYC step" });
    }
  }
};

module.exports = KYCController;