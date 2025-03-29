const hre = require("hardhat");

async function main() {
  // Get the contract factory
  const FlightDelayInsurance = await hre.ethers.getContractFactory("FlightDelayInsurance");
  
  // Deploy the contract (this is the correct way with newer versions)
  const flightDelayInsurance = await FlightDelayInsurance.deploy();
  
  // Wait for deployment to finish
  await flightDelayInsurance.waitForDeployment();
  
  // Get the deployed contract address
  const address = await flightDelayInsurance.getAddress();
  
  console.log("FlightDelayInsurance deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
  