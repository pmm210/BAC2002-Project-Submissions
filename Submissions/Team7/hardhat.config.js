require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: "0.8.20",
  networks: {
    // Infura configuration for Polygon Amoy
    amoy: {
      url: process.env.RPC_URL || "https://rpc-amoy.polygon.technology/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002, // Polygon Amoy Testnet Chain ID
      gasPrice: 30000000000, // 30 Gwei
      gasMultiplier: 1.5,
      timeout: 120000 // Increased timeout
    },
    // Public RPC as fallback
    amoyPublic: {
      url: process.env.PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
      gasPrice: 30000000000, // 30 Gwei
      gasMultiplier: 1.5,
      timeout: 120000
    }
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || ""
    }
  }
};