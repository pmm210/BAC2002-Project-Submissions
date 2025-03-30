"use client";
import { useState } from "react";
import { InterfaceAbi, ethers } from "ethers";
import { getAllReceivedTokens } from "../utils/contractInteractions";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

// ✅ Define NFT Metadata Type
type NFTMetadata = {
  name: string;
  id_masked: string;
  id_hashed: string;
  institution: string;
  position: string;
  image: string;
};

// ✅ Define NFT Type
interface NFT {
  walletAddress: string;
  metadata: NFTMetadata | null;
  metadataURI: string;
  tokenId: string;
  revoked: boolean;
}

export default function User() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userNFTs, setUserNFTs] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [isPopupOpen, setIsPopupOpen] = useState(true);
  const [contractAddress, setContractAddress] = useState("");
  const [contractABI, setContractABI] = useState<InterfaceAbi>([]);
  const [landLoading, setLandLoading] = useState(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setWalletAddress(accounts[0]);
      } catch (error) {
        console.error("🚨 Connection error:", error);
      }
    } else {
      alert("❌ MetaMask is not installed! Please install it.");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null); // Clears wallet address
    setUserNFTs([]);
  };

  // ✅ Fetch user NFTs from smart contract
  const fetchNFTs = async () => {
    try {
      if (!window.ethereum) {
        alert("❌ MetaMask is required to fetch NFTs.");
        return;
      }

      setLoading(true);

      // ✅ Connect to MetaMask
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // ✅ Fetch all issued NFTs from smart contract
      const tokens = await getAllReceivedTokens(signer);

      // 🔍 Check for null or empty tokens
      if (!tokens || tokens.length === 0) {
        alert("ℹ️ No NFTs found for this wallet.");
        setUserNFTs([]); // Ensure state is updated to reflect no NFTs
        return;
      }

      // ✅ Create dictionary with metadata set to null initially
      const tokenDataList: NFT[] = tokens.map(
        (token: {
          owner: string;
          metadataURI: string;
          tokenId: string;
          revoked: boolean;
        }) => ({
          walletAddress: token.owner,
          metadata: null, // Will be filled after fetching metadata
          metadataURI: token.metadataURI, // Store metadata URI for fetching later
          tokenId: token.tokenId,
          revoked: token.revoked,
        })
      );

      // ✅ Extract IPFS Hashes from metadataURIs
      const ipfsHashes = tokens.map(
        (token: {
          owner: string;
          metadataURI: string;
          tokenId: string;
          revoked: boolean;
        }) => token.metadataURI.replace("ipfs://", "")
      );

      const response = await fetch("/api/read-pinata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipfsHashes }),
      });

      const metadataList = await response.json();

      const updatedTokenDataList: NFT[] = tokenDataList.map(
        (tokenData, index) => ({
          ...tokenData,
          metadata: metadataList[index] || null, // Assign metadata if available
        })
      );

      setUserNFTs(updatedTokenDataList);
    } catch (error) {
      console.error("🚨 Error fetching NFTs:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = () => {
    setQrValue("This is a QR code"); // Placeholder content for now
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  // ✅ Navigation Functions
  const nextCard = () => {
    if (userNFTs.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % userNFTs.length);
    }
  };

  const prevCard = () => {
    if (userNFTs.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + userNFTs.length) % userNFTs.length);
    }
  };

  const handlePopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractAddress || !contractABI) return;

    setLandLoading(true);

    try {
      // ⏳ Ensure at least 3 seconds of loading
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 3000)), // 3s wait
        (async () => {
          localStorage.setItem("contractAddress", contractAddress);
          localStorage.setItem("contractABI", JSON.stringify(contractABI));
        })(),
      ]);
      setIsPopupOpen(false);
    } catch (err) {
      console.error("Error loading contract:", err);
    } finally {
      setLandLoading(false);
    }
  };

  const handleABIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContractABI(JSON.parse(text));
  };

  return (
    <div className="flex flex-col w-screen h-screen sm:w-[440px] bg-white overflow-hidden border">
      {/* ✅ Fullscreen Popup */}
      {isPopupOpen && (
        <div className="absolute flex flex-col inset-0 z-50 bg-[#fef1ea] flex items-center justify-start">
          <img src="/logo.png" />
          <form
            onSubmit={handlePopupSubmit}
            className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full space-y-4"
          >
            <h2 className="text-2xl font-bold text-center">
              Load Smart Contract
            </h2>

            <input
              type="text"
              placeholder="Enter Contract Address"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />

            <input
              type="file"
              accept=".json"
              onChange={handleABIUpload}
              className="w-full p-2 border rounded"
              required
            />

            {landLoading ? (
              <div className="w-full text-center py-2 font-semibold text-blue-600 animate-pulse">
                🌀 Hang tight! We&apos;re almost there...
              </div>
            ) : (
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
              >
                Submit
              </button>
            )}
          </form>
        </div>
      )}

      {/* ✅ Main App Content */}
      <header className="flex items-center justify-between w-full h-[10%] p-4 border-b">
        <p className="truncate text-lg max-w-[60%]">
          Wallet:{" "}
          <span className="font-semibold">
            {walletAddress || "Not connected"}
          </span>
        </p>
        <button
          onClick={walletAddress ? disconnectWallet : connectWallet}
          className={`px-4 py-2 rounded-lg transition-colors ${
            walletAddress ? "bg-red-500" : "bg-green-500"
          } text-white`}
        >
          {walletAddress ? "Disconnect" : "Connect"}
        </button>
      </header>

      <main className="flex flex-col items-center justify-center w-full flex-grow relative p-8">
        <button
          className="px-4 py-2 mb-4 bg-gray-600 text-white rounded-lg hover:bg-gray-800"
          onClick={fetchNFTs}
        >
          Refresh Data
        </button>
        {loading ? (
          <p>Loading User Data...</p>
        ) : userNFTs.length > 0 ? (
          <div className="relative w-full h-full overflow-x-hidden">
            <motion.div
              className="flex h-auto"
              animate={{ x: `-${currentIndex * 100}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {userNFTs.map((nft, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center min-w-full"
                >
                  <img
                    src={nft.metadata?.image}
                    alt={nft.metadata?.name}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <div className="flex flex-col items-center w-[80%] mt-4 p-4 bg-white rounded-lg shadow-md">
                    <div className="flex justify-between w-full">
                      <span>Institution:</span>{" "}
                      <span className="w-[50%] text-left">
                        {nft.metadata?.institution}
                      </span>
                    </div>
                    <div className="flex justify-between w-full">
                      <span>Position:</span>{" "}
                      <span className="w-[50%] text-left">
                        {nft.metadata?.position}
                      </span>
                    </div>
                    <div className="flex justify-between w-full">
                      <span>Name:</span>{" "}
                      <span className="w-[50%] text-left">
                        {nft.metadata?.name}
                      </span>
                    </div>
                    <div className="flex justify-between w-full">
                      <span>ID (Hashed):</span>{" "}
                      <span className="w-[50%] text-left truncate">
                        {nft.metadata?.id_hashed}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
            <div className="flex items-center justify-between w-full mt-4">
              {userNFTs.length > 1 && (
                <button
                  className="w-[20%] aspect-square bg-gray-800 text-2xl text-white rounded-full shadow-md hover:bg-gray-700"
                  onClick={prevCard}
                >
                  ◀
                </button>
              )}

              {userNFTs.length > 1 && (
                <button
                  className="w-[20%] aspect-square bg-gray-800 text-2xl text-white rounded-full shadow-md hover:bg-gray-700"
                  onClick={nextCard}
                >
                  ▶
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-red-500">No registered institutions found.</p>
        )}
      </main>
      <footer className="flex items-center justify-center w-full h-[10%] p-4 border-b">
        <button
          className="px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-blue-800"
          onClick={generateQRCode}
        >
          Generate QR Code
        </button>
      </footer>
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="flex flex-col items-center bg-white p-6 rounded-lg shadow-lg w-[60%] md:w-[20%]">
            <QRCodeSVG value={qrValue || ""} size={200} />
            <button
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg"
              onClick={closeModal}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
