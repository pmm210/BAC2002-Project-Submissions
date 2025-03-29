const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC1400Token Smart Contract", function () {
    let ERC1400Token, contract, owner, investor1, investor2, admin;

    beforeEach(async function () {
        [owner, investor1, investor2, admin] = await ethers.getSigners();

        // Deploy the ERC1400Token contract
        const ERC1400 = await ethers.getContractFactory("ERC1400Token");
        contract = await ERC1400.deploy("ArtworkToken", "ART");
    });

    it("Should deploy the contract successfully", async function () {
        expect(contract.address).to.not.equal(0);
    });

    it("Should allow admin to verify KYC for an investor", async function () {
        await contract.verifyKYC(investor1.address);
        expect(await contract.isKYCVerified(investor1.address)).to.be.true;
    });

    it("Should prevent unverified users from receiving tokens", async function () {
        await contract.verifyKYC(investor1.address);  // 
        await contract.createPartition("Mona Lisa", 100000, investor1.address);

        await expect(
            contract.connect(investor1).transferWithinPartition(investor2.address, "Mona Lisa", 5000)
        ).to.be.revertedWith("Recipient not KYC verified"); // 

    });

    it("Should allow a verified user to receive tokens", async function () {
        await contract.verifyKYC(investor1.address);
        await contract.verifyKYC(investor2.address);
        await contract.createPartition("Mona Lisa", 100000, investor1.address);

        await contract.connect(investor1).transferWithinPartition(investor2.address, "Mona Lisa", 5000);

        expect(await contract.getPartitionBalance(investor2.address, "Mona Lisa")).to.equal(5000);
    });

    it("Should allow admin to burn tokens when user owns 100%", async function () {
        await contract.verifyKYC(investor1.address);
        await contract.createPartition("Mona Lisa", 100000, investor1.address);

        await contract.burnArtworkTokensFrom(investor1.address, "Mona Lisa");

        expect(await contract.getPartitionBalance(investor1.address, "Mona Lisa")).to.equal(0);
    });

});
