import { useState } from "react";
import {
  getAllIssuedTokens,
  revokeSoulboundToken,
} from "../../utils/contractInteractions";
import { ethers } from "ethers";

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

// Function to fetch metadata from IPFS
export default function MintedNFTs() {
  const [mintedNFTs, setMintedNFTs] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState<number | null>(null);

  // ✅ Function to Fetch NFTs
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
      const tokens = await getAllIssuedTokens(signer);

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

      // ✅ Fetch metadata for all tokens in one API call
      const response = await fetch("/api/read-pinata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ipfsHashes }),
      });

      const metadataList = await response.json();

      // ✅ Merge fetched metadata into tokenDataList
      const updatedTokenDataList: NFT[] = tokenDataList.map(
        (tokenData, index) => ({
          ...tokenData,
          metadata: metadataList[index] || null, // Assign metadata if available
        })
      );

      setMintedNFTs(updatedTokenDataList);
    } catch (error) {
      console.error("🚨 Error fetching NFTs:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Function to Revoke Token
  const handleRevoke = async (tokenId: number) => {
    try {
      if (!window.ethereum) {
        alert("❌ MetaMask is required to revoke NFTs.");
        return;
      }

      setRevoking(tokenId); // Set loading state for the specific token

      // ✅ Connect to MetaMask
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // ✅ Call contract function to revoke NFT
      const result = await revokeSoulboundToken(signer, tokenId);

      if (result.success) {
        alert(`✅ Token ID ${tokenId} Revoked Successfully!`);
        fetchNFTs(); // Refresh the list after revocation
      } else {
        alert(`❌ Revocation Failed: ${result.error}`);
      }
    } catch (error) {
      console.error("🚨 Error revoking NFT:", error);
      alert("❌ Revocation failed.");
    } finally {
      setRevoking(null); // Reset revoking state
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Minted NFTs</h2>
        <button
          onClick={fetchNFTs}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {loading ? (
        <p className="text-center">Loading NFTs...</p>
      ) : mintedNFTs.length === 0 ? (
        <p className="text-center">No NFTs issued yet.</p>
      ) : (
        <div className="grid grid-cols-4 gap-6">
          {mintedNFTs.map((nft) => (
            <div
              key={nft.tokenId}
              className="p-4 border rounded-lg shadow-md bg-white"
            >
              {/* ✅ Display NFT Image - Full Width & Square Aspect */}
              {nft.metadata?.image ? (
                <img
                  src={nft.metadata.image}
                  alt={nft.metadata.name}
                  className="w-full aspect-square object-cover rounded mb-2"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-200 flex items-center justify-center rounded mb-2">
                  No Image
                </div>
              )}

              <p className="text-sm text-gray-500 flex items-center">
                Wallet Address: {nft.walletAddress.substring(0, 6)}...
                {nft.walletAddress.slice(-4)}
              </p>

              <p className="font-bold text-lg">
                Name: {nft.metadata?.name || "Unknown NFT"}
              </p>

              <p className="text-sm text-gray-500 flex items-center">
                ID: {nft.metadata?.id_masked}
              </p>

              <p className="text-sm text-gray-500 flex items-center">
                Institution: {nft.metadata?.institution}
              </p>
              <p className="text-sm text-gray-500 flex items-center">
                Position: {nft.metadata?.position}
              </p>

              <p className="text-sm text-gray-500 flex items-center">
                Token ID: {nft.tokenId}
              </p>
              <p
                className={`text-sm flex items-center ${nft.revoked ? "text-red-500" : "text-green-500"}`}
              >
                {nft.revoked ? "🚫 Revoked" : "✅ Active"}
              </p>

              {/* ✅ Show Revoke Button Only for Active Tokens */}
              {!nft.revoked && (
                <button
                  onClick={() => handleRevoke(Number(nft.tokenId))}
                  className="mt-2 w-full bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
                  disabled={revoking === Number(nft.tokenId)}
                >
                  {revoking === Number(nft.tokenId)
                    ? "Revoking..."
                    : "🚫 Revoke"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
