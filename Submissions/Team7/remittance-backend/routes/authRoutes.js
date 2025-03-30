const express = require("express");
const AuthController = require("../controllers/AuthController");

const router = express.Router();

// Add a test route to verify the API is working
router.get("/test", (req, res) => {
  res.json({ message: "Auth API is working" });
});

// Ensure the routes are correctly defined with the proper paths
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);

module.exports = router;