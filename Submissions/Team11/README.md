# 💥 PowPow - Transparent Donation DApp (zkSync + zkSNARKs)

**PowPow** is a decentralized and privacy-preserving donation platform built on the **zkSync Sepolia Testnet**, leveraging **zkSNARKs** to allow users to donate to verified charities **privately**, while ensuring **public transparency** in how those funds are used.

---

## 📝 Description

In light of past incidents such as the **National Kidney Foundation (NKF) financial scandal**, where it was revealed that donated funds were misused by the former CEO and a lack of transparency led to public mistrust, **PowPow** was developed to restore confidence in charitable giving.

The NKF scandal, which surfaced in July 2005, highlighted significant issues in the traditional charity ecosystem—namely the **misuse of donations**, **lack of accountability**, and **opacity in fund allocation**. The scandal erupted when NKF's CEO, T.T. Durai, sued Singapore Press Holdings for defamation after a report exposed these malpractices, leading to a public outcry and widespread demand for change.

---

### 🛡️ Our Solution: PowPow

**PowPow** is a **decentralized donation platform** that leverages blockchain technology to address these trust issues head-on.

#### 🔍 Key Objectives:
- **Transparency in fund usage**: All donations and withdrawals by verified charities are recorded immutably on the blockchain and viewable by the public.
- **Privacy for donors**: Donors can contribute anonymously using **zkSNARKs**—zero-knowledge cryptography that hides their identity while proving the donation occurred.
- **Low fees and high scalability**: Built on **zkSync Era**, a Layer 2 rollup for Ethereum that drastically reduces transaction fees while ensuring security and throughput.

#### 👥 Target Users:
- **Organizations / Individuals** who wish to donate privately while ensuring their funds are used meaningfully.
- **Verified Charities** who want to build trust by showcasing transparent and accountable fund usage.

With **PowPow**, we aim to empower donors, encourage responsible giving, and build a more accountable charity ecosystem through blockchain innovation.

---

### 🎥 Demo Video  
Check out our demo of **PowPow** in action:  
[![Watch on YouTube](https://img.youtube.com/vi/MPKYG9YW1is/0.jpg)](https://youtu.be/MPKYG9YW1is)  
🔗 [https://youtu.be/MPKYG9YW1is](https://youtu.be/MPKYG9YW1is)

---

## 🛠️ Setup & Run Instructions

### ⚙️ Step 1: Wallet Setup

1. **MetaMask** → Add custom network:

   ```
   Network Name: zkSync Sepolia Testnet  
   RPC URL: https://sepolia.era.zksync.dev  
   Chain ID: 300  
   Currency Symbol: ETH  
   Block Explorer: https://sepolia.explorer.zksync.io  
   ```

2. **Bridge Sepolia ETH to zkSync Sepolia ETH**  
   🔗 https://portal.zksync.io/bridge/?network=sepolia

3. **Get zkSync Sepolia USDC**  
   🔗 https://faucet.circle.com/  
   Import token: `0xAe045DE5638162fa134807Cb558E15A3F5A7F853`

---

### 📦 Step 2: Deploying Smart Contracts

1. **Clone project from GitHub** and open in your IDE

2. In the `.env` file, add your wallet private key:
   ```
   PRIVATE_KEY=your_wallet_private_key
   ```

3. **Install dependencies**:
   ```bash
   npm install
   chmod +x node_modules/.bin/vite ## macOS
   xattr -r -d com.apple.quarantine node_modules ##macOs
   ```


4. **Deploy zkSNARK Verifier contract**:
   ```bash
   npx hardhat deploy-zksync --script deploy-verifier.js --network zkSyncSepolia
   ```
   ➤ Copy and add the deployed verifier address to `.env`

5. **Deploy CharityDonation contract**:
   ```bash
   npx hardhat deploy-zksync --script deploy-charitydonation.js --network zkSyncSepolia
   ```
   ➤ Save the deployed contract address for frontend use

6. **Verify CharityDonation contract**:
  ```bash
   npx hardhat verify --network zkSyncSepolia 'CharityDonationAddress' 0xAe045DE5638162fa134807Cb558E15A3F5A7F853 'VerifierAddress' 
  ```
---

### 🌐 Step 3: Deploying DApp

1. Navigate to the frontend folder:
   ```bash
   cd charity-dapp
   ```

2. Install frontend packages:
   ```bash
   npm install
   chmod +x node_modules/.bin/vite ## macOS
   xattr -r -d com.apple.quarantine node_modules ##macOs
   ```

3. Add contract address to `/charity-dapp/.env`:
   ```
   VITE_CONTRACT_ADDRESS=your_charityDonation_contract_address
   ```

4. Start the frontend:
   ```bash
   npm run dev
   ```

---

### 🤝 Step 4: Interacting with DApp

| User Role | Actions |
|-----------|---------|
| 🛡️ Admin (Contract Owner) | Add/Remove charities |
| 🏢 Charity (Verified Address) | Withdraw available funds |
| 💰 Donor (Any Wallet) | Donate privately using zkSNARKs, view fund usage |

---

## 👨‍💻 Team Members

- **Manesh Kaliannan** (2303056)  
- **Lim Jing Yu** (2303001)  
- **Nurul Shaidah** (2303052)  
- **Rachel Wan** (2303024)  
- **Sheila Soh** (2303134)

---

## 📄 License

This project is created for academic purposes under the coursework of our blockchain module.