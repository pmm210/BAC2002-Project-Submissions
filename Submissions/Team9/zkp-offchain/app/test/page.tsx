"use client";
require("dotenv").config();
import { useState } from "react";
import { ethers } from "ethers";
import { getUser } from "../../utils/testContractInteractions";
import IdentityCard from "../component/identityCard";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [proof, setProof] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const connectGanache = async () => {
    try {
      // Fetch private key from API
      const response = await fetch("/api/get-user-pk");
      const data = await response.json();
      const privateKey = data.privateKey;

      if (!privateKey) {
        throw new Error("❌ Private key not found.");
      }

      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");
      const wallet = new ethers.Wallet(privateKey, provider);

      setWalletAddress(wallet.address);
      fetchUserData(wallet.address);
    } catch (error) {
      console.error("🚨 Connection error:", error);
    }
  };

  // ✅ Fetch user details from smart contract
  const fetchUserData = async (address) => {
    setLoading(true);
    const data = await getUser(address);
    setUserInfo(data);
    setLoading(false);
  };

  const disconnectGanache = () => {
    setWalletAddress(null); // Clears wallet address
    setUserInfo(null);
  };

  // ✅ Generate ZKP Proof and open modal
  const handleGenerateProof = async () => {
    if (!userInfo) {
      alert("No user data available.");
      return;
    }

    // Generate proof
    const zkpData = await generateZKP(userInfo.name, "2302993", userInfo.title);
    const proofString = JSON.stringify(zkpData);

    setProof(proofString);
    setIsModalOpen(true);
  };

  return (
    <div
      id="device-setter"
      className="flex flex-col sm:h-screen sm:w-[calc(100vh*(440/956))] min-w-[440px] bg-white"
      style={{ boxShadow: "0 0 0 1px black" }}
    >
      <header
        className="flex items-center justify-between w-full h-[10%] p-4 gap-4"
        style={{ boxShadow: "0 0 0 1px black" }}
      >
        {/* Wallet Connection Section */}
        <p className="truncate text-lg max-w-[70%]">
          Wallet:{" "}
          <span className="font-semibold">
            {walletAddress ? walletAddress : "Not connected"}
          </span>
        </p>
        <button
          onClick={walletAddress ? disconnectGanache : connectGanache}
          className={`px-4 py-2 rounded-lg ${
            walletAddress
              ? "bg-[#FF9E9E] hover:bg-red-500 text-white"
              : "bg-[#9EFFA5] hover:bg-green-500 text-white"
          }`}
        >
          {walletAddress ? "Disconnect" : "Connect"}
        </button>
      </header>
      {/* 🔹 Main Content Section */}
      <main className="flex flex-col items-center justify-start w-full flex-grow p-8">
        {loading ? (
          <p>Loading User Data...</p>
        ) : userInfo && userInfo.isRegistered ? (
          <IdentityCard
            name={userInfo.name}
            id="2302993"
            title={userInfo.title}
            organization="SIT"
            phone_number={userInfo.phoneNumber}
            email={userInfo.email}
            color_1="#231F20"
            color_2="#ED1C24"
          />
        ) : (
          <p className="text-red-500">User not registered.</p>
        )}
      </main>
      <footer className="flex items-center justify-center w-full h-[10%] p-4 border-t">
        <button
          onClick={handleGenerateProof}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-800"
        >
          Generate Proof
        </button>
      </footer>
      {/* 🔹 Modal for QR Code */}
      {isModalOpen && proof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80 text-center">
            <h2 className="text-lg font-semibold mb-2">ZKP Proof</h2>
            <QRCode value={proof} size={200} />
            <p className="text-sm text-gray-500 mt-2">Scan to verify</p>
            <button
              onClick={() => setIsModalOpen(false)}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
