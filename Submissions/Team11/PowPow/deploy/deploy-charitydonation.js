const { Wallet, Provider } = require("zksync-ethers");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
require("dotenv").config();

module.exports = async function (hre) {
  console.log("🚀 Starting CharityDonation contract deployment...");

  // ✅ Initialize zkSync provider
  const zkSyncProvider = new Provider(hre.network.config.url);

  // ✅ Initialize Wallet
  const wallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider);
  console.log("🔐 Wallet loaded:", await wallet.getAddress());

  // ✅ Initialize Deployer
  const deployer = new Deployer(hre, wallet);
  console.log("📦 Deployer initialized");

  // ✅ Load artifact for the CharityDonation contract
  const artifact = await deployer.loadArtifact("CharityDonation");

  // Replace with actual contract addresses
  const STABLECOIN_ADDRESS = process.env.STABLECOIN_ADDRESS;
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS;

  console.log("Deploying contract...");

  // ✅ Deploy contract with new constructor arguments
  const charityDonation = await deployer.deploy(artifact, [
    STABLECOIN_ADDRESS, // Stablecoin token address
    VERIFIER_ADDRESS, // Verifier contract address
  ]);

  const contractAddress = await charityDonation.getAddress();
  console.log("✅ CharityDonation contract deployed at:", contractAddress);
};
