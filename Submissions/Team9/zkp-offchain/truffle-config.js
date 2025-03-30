require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1", // Localhost for Ganache
      port: 7545, // Ganache default RPC port
      network_id: "*", // Match any network
      gas: 672197500, // ⬆ Increase Gas Limit (default: 6721975)
      gasPrice: 20000000000, // ⬆ Increase Gas Price (20 Gwei = 20 * 10^9)
    },
  },

  // Solidity compiler version
  compilers: {
    solc: {
      version: "0.8.0", // Match your contract's Solidity version
    },
  },
};
