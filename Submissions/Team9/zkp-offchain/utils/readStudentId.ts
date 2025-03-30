// ca and abi of 
import { ethers } from "ethers";
import NFTABI from "@/contracts/StudentNFTABI.json"; // ABI for your NFT contract

const NFT_CONTRACT_ADDRESS = "YOUR_STUDENT_NFT_ADDRESS";

export default async function readStudentId(userAddress: string): Promise<string | null> {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFTABI, provider);

    const tokenId = await contract.tokenOfOwnerByIndex(userAddress, 0); // Assumes ERC-721 Enumerable
    const studentId = await contract.getStudentId(tokenId); // Replace with actual method

    return studentId.toString();
  } catch (err) {
    console.error("Failed to fetch studentId:", err);
    return null;
  }
}