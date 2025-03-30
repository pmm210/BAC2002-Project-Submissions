require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.28",
  networks: {
    amoy: {
      url: process.env.POLYGON_RPC_URL, 
      accounts: [process.env.PRIVATE_KEY], 
      chainId: 80002,
      gasPrice: 50000000000,
      timeout: 60000
    }
  }
};