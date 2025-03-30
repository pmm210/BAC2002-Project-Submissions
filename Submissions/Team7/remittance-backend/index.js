require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const kycRoutes = require("./routes/KYCRoutes");
const KYCModel = require('./models/KYC');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const kycUploadsDir = path.join(uploadsDir, 'kyc');
if (!fs.existsSync(kycUploadsDir)) {
  fs.mkdirSync(kycUploadsDir, { recursive: true });
}

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "*", // Use environment variable or allow all
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// WebSocket setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "*", // Same as Express CORS setup
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  },
  pingTimeout: 60000, // Timeout for connection pings
  pingInterval: 25000  // How often to check connection
});

// WebSocket user tracking
io.users = {};
io.socketToUser = {};

// Function to send real-time updates with error handling
function sendRealTimeUpdate(userId, eventType, data) {
  try {
    if (io.users[userId]) {
      io.to(io.users[userId]).emit(eventType, data);
      console.log(`Sent ${eventType} to user ${userId}`);
      return true;
    }
    console.log(`User ${userId} not connected, can't send ${eventType}`);
    return false;
  } catch (error) {
    console.error(`Error sending real-time update to user ${userId}:`, error);
    return false;
  }
}

// Attach the function to the `io` instance for global access
io.sendRealTimeUpdate = sendRealTimeUpdate;

// KYC Status Polling - Check for status changes
const kycStatusCache = {};

// Function to check KYC status and notify user on changes
async function checkAndNotifyKYCStatus(userId) {
  try {
    if (!userId) return;
    
    const currentStatus = await KYCModel.getKYCStatusByUserId(userId);
    const cachedStatus = kycStatusCache[userId];
    
    // If this is the first time we're checking, just cache and return
    if (!cachedStatus) {
      kycStatusCache[userId] = currentStatus;
      return;
    }
    
    // If verification state has changed
    if (cachedStatus.verified !== currentStatus.verified) {
      console.log(`KYC status changed for user ${userId}: verified=${currentStatus.verified}`);
      
      // Send notification if verified changed to true
      if (currentStatus.verified === true) {
        const notificationData = {
          type: 'kyc_verification_success',
          message: 'Your identity verification has been approved! You can now make transactions.',
          timestamp: new Date().toISOString()
        };
        
        sendRealTimeUpdate(userId, 'kycStatusUpdate', {
          status: currentStatus,
          notification: notificationData
        });
        
        console.log(`Sent KYC verification success notification to user ${userId}`);
      }
    }
    
    // Update the cache
    kycStatusCache[userId] = currentStatus;
    
  } catch (error) {
    console.error(`Error in checkAndNotifyKYCStatus for user ${userId}:`, error);
  }
}

// WebSocket connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Register user
  socket.on("register", async (userId) => {
    if (!userId) {
      console.warn("Register event received without userId");
      return;
    }
    
    // Clean up existing registrations
    if (io.users[userId] && io.users[userId] !== socket.id) {
      const oldSocketId = io.users[userId];
      delete io.socketToUser[oldSocketId];
      console.log(`User ${userId} disconnected from old socket ${oldSocketId}`);
    }
    
    // Set up new mappings
    io.users[userId] = socket.id;
    io.socketToUser[socket.id] = userId;
    
    console.log(`✅ User ${userId} registered with WebSocket ID: ${socket.id}`);
    
    // Confirm registration to client
    socket.emit("registered", { userId, socketId: socket.id });
    
    // Immediately check current KYC status
    await checkAndNotifyKYCStatus(userId);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const userId = io.socketToUser[socket.id];
    
    if (userId) {
      if (io.users[userId] === socket.id) {
        delete io.users[userId];
      }
      delete io.socketToUser[socket.id];
      console.log(`User ${userId} disconnected from socket ${socket.id}`);
    } else {
      console.log(`Unregistered socket disconnected: ${socket.id}`);
    }
  });

  // Handle unregister event
  socket.on("unregister", () => {
    const userId = io.socketToUser[socket.id];
    
    if (userId) {
      if (io.users[userId] === socket.id) {
        delete io.users[userId];
      }
      delete io.socketToUser[socket.id];
      console.log(`User ${userId} unregistered from socket ${socket.id}`);
    }
  });

  // Handle socket errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Setup periodic KYC status check for all connected users
const KYC_POLLING_INTERVAL = 30000; // 30 seconds
setInterval(() => {
  try {
    // For each connected user, check if their KYC status has changed
    Object.keys(io.users).forEach(userId => {
      checkAndNotifyKYCStatus(userId);
    });
  } catch (error) {
    console.error('Error in KYC status polling:', error);
  }
}, KYC_POLLING_INTERVAL);

// Attach the WebSocket instance to the Express app for use in controllers
app.set("io", io);

// API Routes
// Base API route
app.get("/api", (req, res) => {
  res.json({ message: "API is running" });
});

// Auth routes - make sure these are correctly mounted
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/kyc", kycRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Remittance API is running!");
});

// Catch-all route for 404s
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ 
    error: "Internal server error", 
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message 
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("API endpoints:");
  console.log(`- Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`- Transactions API: http://localhost:${PORT}/api/transactions`);
  console.log(`- KYC API: http://localhost:${PORT}/api/kyc`);
  console.log("WebSocket server is running on the same port.");
});

// Handle graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('Received shutdown signal');
  
  // Close the HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close any database connections
    try {
      console.log('Database connections closed');
      process.exit(0);
    } catch (err) {
      console.error('Error closing database connections:', err);
      process.exit(1);
    }
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}