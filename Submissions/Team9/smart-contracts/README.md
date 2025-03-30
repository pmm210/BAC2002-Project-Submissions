# Smart Contract Repository
We have 3 smart contracts in our entire project : 
1. Soulbound Token
2. Verifier (parent)
3. VerifyStudent (child)

---
## 🔐 Soulbound Token (ERC-5727) Smart Contract

This repository contains the Solidity smart contract code for issuing **Soulbound Tokens (SBTs)** — non-transferable ERC-5727 tokens used to represent identity credentials, academic achievements, or memberships.

This contract is intended for use with the [Identity Card NFT Issuer](https://nft-issuer.vercel.app/) and [ZKP Generator](https://zkp-generator.vercel.app/) dApps.

### 🚀 Deploy on Remix IDE

1. Visit [Remix IDE](https://remix.ethereum.org/)
2. Create a new file and **copy the smart contract code** from this repository into the file.
3. Compile the contract using the **Solidity compiler** tab.
4. Go to the **Deploy & Run Transactions** tab.
5. Select the appropriate **Environment** (It is recommended to use `Injected Provider` for MetaMask with Sepolia or ScrollSepolia Blockchain).
6. Deploy the contract.
7. Once deployed, interact with the contract using the Remix UI.

### Smart Contract Functionalities
Contract Deployer
1. Assign Admin
2. Revoke Admin
3. Get All Admins

Institution Admin
1. Mint NFT
2. Revoke NFT
3. Get All Issued NFTs

Institution User
1. Get All Received NFT
