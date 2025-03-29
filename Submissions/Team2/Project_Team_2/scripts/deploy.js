const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract with:", deployer.address);

    const ERC1400Token = await hre.ethers.getContractFactory("ERC1400Token");
    const token = await ERC1400Token.deploy("Artwork Token", "ART");

    await token.waitForDeployment();
    const contractAddress = await token.getAddress();
    console.log("ERC1400Token deployed at:", contractAddress);

    console.log(`Deployer (${deployer.address}) is automatically set as Admin.`);
}

// Run the script with error handling
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
