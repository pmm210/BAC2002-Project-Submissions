"use client";

import { useState } from "react";
import { ethers } from "ethers";

export default function Home() {
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
      <main className="flex flex-col items-center justify-center w-full flex-grow p-8">
        <div className="flex flex-col justify-center items-center w-full h-full text-center border-2 border-dashed border-gray-500 rounded-xl">
          <svg
            width="128"
            height="129"
            viewBox="0 0 128 129"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g clipPath="url(#clip0_1_89)">
              <path
                d="M114.728 29.132C111.952 25.348 108.08 20.916 103.832 16.668C99.584 12.42 95.152 8.548 91.368 5.772C84.92 1.044 81.792 0.5 80 0.5H18C12.488 0.5 8 4.988 8 10.5V118.5C8 124.012 12.488 128.5 18 128.5H110C115.512 128.5 120 124.012 120 118.5V40.5C120 38.708 119.456 35.58 114.728 29.132ZM98.168 22.332C102.008 26.172 105.016 29.628 107.24 32.5H87.992V13.26C90.864 15.484 94.336 18.492 98.168 22.332ZM112 118.5C112 119.588 111.088 120.5 110 120.5H18C17.4715 120.494 16.9664 120.281 16.5927 119.907C16.2189 119.534 16.0062 119.028 16 118.5V10.5C16 9.42 16.92 8.5 18 8.5H80V36.5C80 37.5609 80.4214 38.5783 81.1716 39.3284C81.9217 40.0786 82.9391 40.5 84 40.5H112V118.5Z"
                fill="black"
              />
            </g>
            <defs>
              <clipPath id="clip0_1_89">
                <rect
                  width="128"
                  height="128"
                  fill="white"
                  transform="translate(0 0.5)"
                />
              </clipPath>
            </defs>
          </svg>
          <p className="mt-2 text-gray-500 italic">Nothing to see here.</p>
        </div>{" "}
      </main>
      <footer></footer>
    </div>
  );
}
