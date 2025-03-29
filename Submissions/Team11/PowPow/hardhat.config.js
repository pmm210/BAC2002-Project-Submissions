require("dotenv").config();
require("@matterlabs/hardhat-zksync"); // ✅ Plugin for newer zksync-ethers
require("@matterlabs/hardhat-zksync-deploy");

module.exports = {
  zksolc: {
    version: "1.3.13",
    compilerSource: "binary",
    settings: {},
  },
  defaultNetwork: "zkSyncSepolia",
  networks: {
    zkSyncSepolia: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "https://eth-sepolia.public.blastapi.io",
      zksync: true,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  solidity: {
    version: "0.8.20",
  },
};
