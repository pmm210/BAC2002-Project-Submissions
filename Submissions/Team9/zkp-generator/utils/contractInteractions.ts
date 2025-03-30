import { InterfaceAbi, ethers } from "ethers";

let SoulboundABI: InterfaceAbi | [] = [];
let contractAddress: string | null = null; // Store the contract address after first fetch

// ✅ Function to Fetch Contract Address Securely
const fetchContractAddress = async () => {
  if (!contractAddress) {
    // ✅ First try localStorage (user input popup)
    const stored = localStorage.getItem("contractAddress");
    if (stored) {
      contractAddress = stored;
    } else {
      // ✅ Fallback to API if not in localStorage
      try {
        const response = await fetch("/api/get-contract-address");
        const data = await response.json();
        contractAddress = data.contractAddress;
      } catch (error) {
        console.error("❌ Error fetching contract address:", error);
        throw error;
      }
    }

    if (!contractAddress) {
      throw new Error("❌ Contract address is missing.");
    }
  }

  return contractAddress;
};

const fetchABI = async () => {
  if (!SoulboundABI || SoulboundABI.length === 0) {
    const storedABI = localStorage.getItem("contractABI");
    if (!storedABI) throw new Error("❌ ABI not found in localStorage");
    SoulboundABI = JSON.parse(storedABI);
  }
  return SoulboundABI;
};

// ✅ Function to Get Provider (MetaMask or Ganache)
const getProvider = () => {
  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum); // MetaMask Provider
  } else {
    return new ethers.JsonRpcProvider("http://127.0.0.1:7545"); // Ganache Fallback
  }
};

// ✅ Function to Get Smart Contract Instance
const getContract = async (signer?: ethers.Signer) => {
  const provider = getProvider();
  const contractAddr = await fetchContractAddress(); // Ensure contract address is fetched
  const contractABI = await fetchABI();

  return new ethers.Contract(
    contractAddr,
    contractABI, // Ensure ABI is correctly structured
    signer || (await provider.getSigner()) // Await provider if MetaMask is used
  );
};

// ============================================================= //
// ========== [1] Fetch All Tokens Received by User ============ //
// ============================================================= //
export const getAllReceivedTokens = async (signer: ethers.Signer) => {
  try {
    const contract = await getContract(signer);
    const tokens = await contract.getAllReceivedTokenDetails();

    return tokens.map((token: any) => ({
      owner: token.owner,
      tokenId: token.tokenId.toString(),
      slot: token.slot.toString(),
      revoked: token.revoked,
      metadataURI: token.metadataURI,
    }));
  } catch (error) {
    console.error("❌ Error fetching user institutions:", error);
    return null;
  }
};
