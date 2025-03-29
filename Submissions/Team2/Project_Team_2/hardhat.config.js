require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  networks: {
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: [
        process.env.ADMIN_PRIVATE_KEY,
        process.env.TEST_WALLET_2_PRIVATE_KEY,
        process.env.TEST_WALLET_3_PRIVATE_KEY,
      ],
    },
  },
  solidity: "0.8.28",
};
