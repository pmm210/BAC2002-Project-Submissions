import { useState } from "react";
import html2canvas from "html2canvas";
import { issueSoulboundToken } from "../../utils/contractInteractions"; // ✅ Import minting function
import { ethers } from "ethers";

// ✅ Determine gradient colors based on institution
const getGradientColors = (institution: string) => {
  switch (institution.toUpperCase()) {
    case "SIT":
      return ["#231F20", "#ED1C24"];
    case "NUS":
      return ["#003D7C", "#EF7B00"];
    case "UOB":
      return ["#005EB8", "#ED1C24"];
    case "OCBC":
      return ["#E30713", "#FFFFFF"];
    case "BYTEDANCE":
      return ["#325AB4", "#78E6DC"];
    case "YOUTRIP":
      return ["#6D36AB", "#31E8D5"];
    default:
      return ["#000000", "#FFFFFF"];
  }
};

// ✅ Determine valid positions based on institution
const getValidPositions = (institution: string) => {
  const positions: Record<string, string[]> = {
    SIT: ["STUDENT", "PROFESSOR"],
    NUS: ["STUDENT", "PROFESSOR"],
    UOB: ["INTERN", "EMPLOYEE"],
    OCBC: ["INTERN", "EMPLOYEE"],
    ByteDance: ["INTERN", "EMPLOYEE"],
    YouTrip: ["INTERN", "EMPLOYEE"],
  };
  return positions[institution.toUpperCase()] || ["Unknown"];
};

// ✅ Function to mask ID display
const maskID = (id: string) => {
  if (id.length < 3) return id;
  return `${id[0]}****${id[id.length - 1]}`;
};

export default function MintNFT({
  adminInstitution,
}: {
  adminInstitution: string;
}) {
  const [walletAddress, setWalletAddress] = useState(""); // ✅ New: Wallet Address
  const [position, setPosition] = useState("STUDENT");
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [minting, setMinting] = useState(false); // ✅ New: Minting state

  const [color1, color2] = getGradientColors(adminInstitution);

  // ✅ Function to Capture & Upload Image to Pinata
  const captureAndUploadToPinata = async () => {
    const cardElement = document.getElementById("identity-card");
    if (!cardElement) return;

    try {
      const canvas = await html2canvas(cardElement);
      canvas.toBlob(async (blob) => {
        if (!blob) return console.error("Error converting canvas to Blob");

        const formData = new FormData();
        formData.append("file", blob, "identity_card.png");
        formData.append("institution", adminInstitution);
        formData.append("position", position);
        formData.append("name", name);
        formData.append("idNumber", idNumber);

        // ✅ Step 1: Upload image to Pinata
        const response = await fetch("/api/upload-pinata", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (data.gatewayImageURI && data.gatewayMetadataURI) {
          await mintNFT(data.ipfsMetadataURI);
        } else {
          console.error("🚨 Error: No metadata or image URL returned");
        }
      }, "image/png");
    } catch (error) {
      console.error("Error capturing or uploading:", error);
    }
  };

  // ✅ Function to Mint NFT on the Blockchain
  const mintNFT = async (metadataURI: string) => {
    try {
      if (!window.ethereum) {
        alert("❌ MetaMask is required to mint NFTs.");
        return;
      }

      setMinting(true);

      // ✅ Connect to MetaMask
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // ✅ Call contract function to mint NFT
      const result = await issueSoulboundToken(
        signer,
        walletAddress,
        1,
        metadataURI
      );

      if (result.success) {
        alert(`✅ NFT Minted Successfully!\nTX Hash: ${result.txHash}`);
      } else {
        alert(`❌ Minting Failed: ${result.error}`);
      }
    } catch (error) {
      console.error("🚨 Error minting NFT:", error);
      alert("❌ Minting failed.");
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="flex h-full gap-8">
      {/* Left Side: Input Form */}
      <div className="w-1/2 p-4 border rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4 text-center">Mint a New NFT</h2>
        <form>
          {/* Wallet Address Input */}
          <input
            type="text"
            placeholder="Enter Wallet Address"
            className="w-full p-2 border rounded mb-2"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
          />

          {/* Institution (Auto-filled) */}
          <input
            type="text"
            className="w-full p-2 border rounded mb-2 bg-gray-200"
            value={adminInstitution}
            readOnly
          />

          {/* Position Selection (Dropdown) */}
          <select
            className="w-full p-2 border rounded mb-2"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            {getValidPositions(adminInstitution).map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>

          {/* Name Input */}
          <input
            type="text"
            placeholder="Enter Name"
            className="w-full p-2 border rounded mb-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* ID Number Input */}
          <input
            type="text"
            placeholder="Enter ID Number"
            className="w-full p-2 border rounded mb-2"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
          />

          {/* Mint NFT Button */}
          <button
            type="button"
            onClick={captureAndUploadToPinata}
            className={`w-full p-2 rounded mt-2 ${
              minting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-500 text-white"
            }`}
            disabled={minting}
          >
            {minting ? "Processing..." : "Mint NFT"}
          </button>
        </form>
      </div>

      {/* Right Side: Preview Canvas */}
      <div className="w-1/2 flex justify-center items-center">
        <div
          id="identity-card"
          className="relative p-4 flex flex-col items-center justify-between h-full aspect-square rounded-xl text-white shadow-md"
          style={{
            background: `linear-gradient(45deg, ${color1}, ${color2})`,
          }}
        >
          <p className="w-full text-left text-6xl font-semibold">
            {adminInstitution || "..."}
          </p>
          <div className="flex flex-col items-center">
            <h3 className="text-4xl font-bold text-center">
              {name || "<name>"}
            </h3>
            <p className="text-2xl">{idNumber ? maskID(idNumber) : "<id>"}</p>
          </div>
          <p className="w-full text-right text-6xl font-semibold">
            {position || "..."}
          </p>
        </div>
      </div>
    </div>
  );
}
