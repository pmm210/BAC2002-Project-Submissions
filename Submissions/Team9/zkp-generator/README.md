# 🪪 Identity Card ZKP Generator

A decentralized application (DApp) that collects **Ethereum-Compatible (ERC-5727) Soulbound Tokens** — non-transferable NFTs representing identity credentials, memberships, or academic verifications — and generates **Zero-Knowledge Proofs (ZKPs)** for third parties like merchants and vendors to verify.  
The system ensures that **only active tokens** are displayed and eligible for use.

🌐 **Live Website:** [https://zkp-generator.vercel.app/](https://zkp-generator.vercel.app/)

---

## 🚀 Getting Started Locally
https://github.com/VeriZKP/nft-issuer.git
Follow these steps to run the project on your local machine:

### 1. Clone the Repository
Use Git or GitHub Desktop:
```bash
git clone https://github.com/VeriZKP/nft-issuer.git
cd nft-issuer
```

### 2. Install Dependencies
Make sure Node.js is installed, then run:
```bash
npm install
```
💡 You can download Node.js via [this link](https://nodejs.org/en/download) 

### 3. Set Up Environment Variables
Create a `.env` file in the root directory with the following variables:
```.env
PINATA_GATEWAY=your_gateway_url
PINATA_JWT=your_jwt_token
```
💡 You can get these by creating an account at Pinata via [this link](https://pinata.cloud/)

### 4. Run the Development Server
Make sure Node.js is installed, then run:
```bash
npm run dev
```
💡 You can download Node.js via [this link](https://nodejs.org/en/download) 
The app should now be running on http://localhost:3000 🚀
