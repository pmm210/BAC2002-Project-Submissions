const { Wallet, Provider } = require("zksync-ethers");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
require("dotenv").config();

module.exports = async function (hre) {
  console.log("🚀 Starting verifier contract deployment...");

  // ✅ Correct Provider using zksync-ethers (Ethers v6)
  const zkSyncProvider = new Provider(hre.network.config.url);

  // ✅ Wallet connected to provider
  const wallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider);
  console.log("🔐 Wallet loaded:", await wallet.getAddress());

  // ✅ Use Deployer class
  const deployer = new Deployer(hre, wallet);
  console.log("📦 Deployer initialized");

  // ✅ Load artifact for the Verifier contract (from compilation)
  const artifact = await deployer.loadArtifact("Groth16Verifier");

  // Deploy the Verifier contract
  const contract = await deployer.deploy(artifact, []);

  const address = await contract.getAddress();
  console.log("✅ Verifier contract deployed at:", address);
};
