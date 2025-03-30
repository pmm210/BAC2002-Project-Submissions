const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const jwtSecret = process.env.JWT_SECRET;

const AuthController = {
  async register(req, res) {
    try {
      const { username, email, password } = req.body;
      console.log("Register request:", { username, email });

      // Validate input
      if (!username || !email || !password) {
        return res.status(400).json({ 
          status: 400,
          message: "Registration failed",
          error: "All fields are required" 
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          status: 400,
          message: "Registration failed",
          error: "Password must be at least 6 characters long"
        });
      }

      // Check if email already exists (only email needs to be unique)
      const existingUserByEmail = await User.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ 
          status: 400,
          message: "Registration failed",
          error: "Email already in use"
        });
      }

      // Username doesn't need to be unique - no check required

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user with correct parameter order (email, username, hashedPassword)
      const user = await User.createUser(email, username, hashedPassword);
      console.log("User created:", user);

      // Return success response without token (user must login separately)
      res.status(201).json({
        status: 201,
        message: "Registration successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (err) {
      console.error("Register error:", err);
      
      // Handle specific errors
      if (err.message === "Email already exists") {
        return res.status(400).json({
          status: 400,
          message: "Registration failed",
          error: "Email already in use"
        });
      }
      
      // If this is a database constraint error for username, provide a specific message
      if (err.code === '23505' && err.constraint === 'users_username_key') {
        return res.status(400).json({
          status: 400,
          message: "Registration failed",
          error: "There is a database constraint on usernames. Please contact the administrator."
        });
      }
      
      res.status(500).json({ 
        status: 500,
        message: "Registration failed", 
        error: err.message || "Server error during registration"
      });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      console.log("Login attempt for email:", email);

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ 
          status: 400,
          message: "Login failed",
          error: "Email and password are required"
        });
      }

      // Check if user exists
      const user = await User.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ 
          status: 400,
          message: "Login failed",
          error: "Invalid credentials"
        });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ 
          status: 400,
          message: "Login failed",
          error: "Invalid credentials"
        });
      }

      console.log("Login successful for user:", user.username);

      // Generate JWT token with username explicitly included
      const tokenPayload = { 
        id: user.id, 
        username: user.username,
        email: user.email 
      };
      
      console.log("Token payload:", tokenPayload);
      
      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "7d" });

      // Log the decoded token to verify
      const decoded = jwt.verify(token, jwtSecret);
      console.log("Decoded token:", decoded);

      res.json({
        status: 200,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ 
        status: 500,
        message: "Login failed",
        error: err.message || "Server error during login"
      });
    }
  }
};

module.exports = AuthController;