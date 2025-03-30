// scripts/deploy.js
const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  // For Polygon Amoy testnet
  // QuickSwap router on Polygon Amoy
  const QUICKSWAP_ROUTER = "0xf5b509bB0909a69B1c207E495f687a596C168E12";
  // Test USDC on Polygon Amoy
  const TEST_USDC = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";
  
  console.log("Deploying RemittanceContract...");
  
  // Set appropriate gas settings for Polygon Amoy testnet
  const deploymentOptions = {
    gasPrice: ethers.parseUnits("50", "gwei"), // 50 Gwei
    gasLimit: 6000000, // Higher gas limit for complex contract
  };
  
  console.log("Using gas settings:", {
    gasPrice: `${ethers.formatUnits(deploymentOptions.gasPrice, "gwei")} Gwei`,
    gasLimit: deploymentOptions.gasLimit.toString()
  });
  
  console.log("Contract parameters:");
  console.log("Router:", QUICKSWAP_ROUTER);
  console.log("USDC:", TEST_USDC);
  
  const RemittanceContract = await hre.ethers.getContractFactory("RemittanceContract");
  const remittance = await RemittanceContract.deploy(
    QUICKSWAP_ROUTER, 
    TEST_USDC,
    deploymentOptions
  );

  await remittance.waitForDeployment();
  
  const address = await remittance.getAddress();
  console.log("RemittanceContract deployed to:", address);
  
  console.log("Deployment transaction hash:", remittance.deploymentTransaction().hash);
  
  // Log contract details for verification
  console.log("Contract configuration:");
  console.log("- Router:", QUICKSWAP_ROUTER);
  console.log("- Stablecoin:", TEST_USDC);
  
  // Wait a bit more to ensure the contract is fully deployed
  console.log("Waiting for contract to be fully confirmed...");
  await ethers.provider.waitForTransaction(remittance.deploymentTransaction().hash, 2); // Wait for 2 confirmations
  console.log("Contract deployment confirmed");
  
  // Verification command
  console.log("\nTo verify on Polygonscan, run:");
  console.log(`npx hardhat verify --network amoy ${address} "${QUICKSWAP_ROUTER}" "${TEST_USDC}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });