"use client";

import { useState } from "react";
import { ethers } from "ethers";

export default function Admin() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setWalletAddress(accounts[0]);
      } catch (error) {
        console.error("Connection error:", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null); // Clears wallet address
  };

  return (
    <div
      id="device-setter"
      className="flex flex-col h-screen w-screen bg-white"
      style={{ boxShadow: "0 0 0 1px black" }}
    >
      <header
        className="flex items-center justify-between w-full h-[10%] px-16 gap-16"
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
          onClick={walletAddress ? disconnectWallet : connectWallet}
          className={`px-4 py-2 rounded-lg ${
            walletAddress
              ? "bg-[#FF9E9E] hover:bg-red-500 text-white"
              : "bg-[#9EFFA5] hover:bg-green-500 text-white"
          }`}
        >
          {walletAddress ? "Disconnect" : "Connect"}
        </button>
      </header>
      <main className="flex flex-col items-center justify-center w-full flex-grow p-8"></main>
      <footer></footer>
    </div>
  );
}
