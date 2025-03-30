"use client";

import { useState } from "react";
import { InterfaceAbi, ethers } from "ethers";
import { getInstitution } from "../utils/contractInteractions";
import MintNFT from "./components/MintNFT";
import MintedNFTs from "./components/MintedNFT";

export default function Admin() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>("");
  const [activeTab, setActiveTab] = useState("mint");

  const [isPopupOpen, setIsPopupOpen] = useState(true);
  const [contractAddress, setContractAddress] = useState("");
  const [contractABI, setContractABI] = useState<InterfaceAbi>([]);
  const [loading, setLoading] = useState(false);
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const metamaskSigner = await provider.getSigner();

        setWalletAddress(accounts[0]);

        // Fetch institution info after wallet connects
        fetchInstitution(metamaskSigner);
      } catch (error) {
        console.error("🚨 Connection error:", error);
      }
    } else {
      alert("❌ MetaMask is not installed! Please install it.");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setInstitutionName(""); // Reset institution when disconnecting
  };

  // ✅ Function to Fetch Institution
  const fetchInstitution = async (signer: ethers.Signer) => {
    try {
      const institution = await getInstitution(signer);
      setInstitutionName(institution);
    } catch (error) {
      console.error("🚨 Error fetching institution:", error);
      setInstitutionName(null);
    }
  };

  const handlePopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractAddress || !contractABI) return;

    setLoading(true);

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
      setLoading(false);
    }
  };

  const handleABIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContractABI(JSON.parse(text));
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-white">
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

            {loading ? (
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
      <header className="flex items-center justify-between w-full h-[10%] px-16 gap-16 border-b">
        <p className="truncate text-lg max-w-[70%]">
          Wallet:{" "}
          <span className="font-semibold">
            {walletAddress ? walletAddress : "Not connected"}
            {institutionName && ` ( ${institutionName} )`}{" "}
          </span>
          {/* ✅ Show Institution */}
        </p>
        <button
          onClick={walletAddress ? disconnectWallet : connectWallet}
          className={`px-4 py-2 rounded-lg ${walletAddress ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-white"}`}
        >
          {walletAddress ? "Disconnect" : "Connect"}
        </button>
      </header>

      <main className="flex flex-col w-full h-[90%]">
        <div className="flex w-full h-[10%] border-b">
          <button
            onClick={() => setActiveTab("mint")}
            className={`flex-1 p-3 text-center font-semibold ${activeTab === "mint" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"}`}
          >
            Mint NFT
          </button>
          <button
            onClick={() => setActiveTab("minted")}
            className={`flex-1 p-3 text-center font-semibold ${activeTab === "minted" ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"}`}
          >
            Minted NFTs
          </button>
        </div>

        <div className="flex-grow p-6 overflow-y-scroll">
          {activeTab === "mint" ? (
            <MintNFT adminInstitution={institutionName ?? ""} />
          ) : (
            <MintedNFTs />
          )}
        </div>
      </main>
    </div>
  );
}
