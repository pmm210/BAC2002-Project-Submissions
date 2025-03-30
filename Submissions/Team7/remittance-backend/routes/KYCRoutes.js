const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const KYCModel = require('../models/KYC');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// Set up storage for KYC documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user?.id;
    const userDir = path.join(__dirname, '..', 'uploads', 'kyc', userId.toString());
    
    // Create user directory if it doesn't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const documentType = req.body.documentType || 'document';
    const timestamp = Date.now();
    const fileExt = path.extname(file.originalname).toLowerCase();
    cb(null, `${documentType}_${timestamp}${fileExt}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow only certain file types
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.pdf'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Error handler middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum file size is 5MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Apply middleware to all routes
router.use(verifyToken);

// Get KYC status
router.get('/status', async (req, res) => {
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
});

// Submit document for verification
router.post('/upload-document', upload.single('document'), handleMulterError, async (req, res) => {
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
});

// Complete a verification step
router.post('/complete-step', async (req, res) => {
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
});

module.exports = router;