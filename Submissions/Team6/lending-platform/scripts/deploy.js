const hre = require("hardhat");

async function main() {
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy LendingForwarder (no constructor parameters needed)
  const Forwarder = await hre.ethers.getContractFactory("LendingForwarder");
  const forwarder = await Forwarder.deploy(); // Remove any parameter here
  await forwarder.waitForDeployment();
  const forwarderAddress = await forwarder.getAddress();
  console.log("Forwarder deployed to:", forwarderAddress);

  // For LendingPlatform, update the constructor parameters if required.
  // For example, if LendingPlatform now expects the trusted forwarder and a Chainlink price feed address:
  // Replace `priceFeedAddress` with the actual Chainlink aggregator address on BSC Testnet.
  const priceFeedAddress = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526"; // Address
  const LendingPlatform = await hre.ethers.getContractFactory("LendingPlatform");
  const lendingPlatform = await LendingPlatform.deploy(forwarderAddress, priceFeedAddress);
  await lendingPlatform.waitForDeployment();
  const lendingAddress = await lendingPlatform.getAddress();
  console.log("LendingPlatform deployed to:", lendingAddress);
}

main().catch(console.error);
