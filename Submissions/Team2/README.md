
# Team 2 Project: Tokenized Artwork Management Platform (ERC-1400 DApp)

## Team Members  
- **Ming Zhao** (2303045)  
- **Raja** (2303035)  
- **Rifat** (2303003)  
- **Shou Zhi** (2303441)  
- **Philicia** (2303359)

---

## Overview

This decentralized application (DApp) enables the **tokenization, ownership verification, transfer, and secure burning** of digital artworks using blockchain technology, leveraging the **ERC-1400** token standard.

### Core Modules

1. **Admin Dashboard**  
   - Create artwork partitions (mint tokens)
   - Verify KYC for investors  
   - Burn tokens if the investor holds 100% ownership  

2. **Investor Dashboard**  
   - View owned artwork tokens  
   - Transfer tokens to other KYC-verified investors  
   - View all available artworks on the blockchain  

---

## Technologies Used

| Layer             | Tool/Framework     |
|------------------|--------------------|
| **Frontend**      | React + MetaMask   |
| **Smart Contracts** | Solidity + Hardhat |
| **Blockchain Network** | Arbitrum Sepolia Testnet |
| **Wallet**        | MetaMask           |

---

## Security Features
- **KYC Enforcement** – Only KYC-verified users can interact with tokens  
- **Admin Control** – Only Admin can create, burn, and verify KYC  
- **Ownership Validation** – Tokens can only be burned when 100% ownership is confirmed  
- **Reentrancy Protection** – All token-related logic is protected using OpenZeppelin’s `ReentrancyGuard`  

---

## Deployment & Testing Instructions

### Step 1: Environment Setup
- Install dependencies:  
  ```bash
  npm install
  ```
- In `.env`, set up:
  - Three wallet private keys (`PRIVATE_KEY1`, `PRIVATE_KEY2`, `PRIVATE_KEY3`)
---

### Step 2: Compile & Deploy Contract
- Deploy the contract to the Arbitrum Sepolia network:
```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```
✅ **Expected Output**:
- `Deploying contract with:` (Admin account address should display)
- `ERC1400Token deployed at:` ContractAddress
- `Deployer` (Admin account address should display) is automatically set as Admin.

---

### Step 3: Set Up Frontend

```bash
cd frontend
cp ../artifacts/contracts/ERC1400Token.sol/ERC1400Token.json src/contracts/
npm install
```
- Copy the Contract Address from Step 2 and paste it into the frontend `.env` file.

Start the frontend:
```bash
npm start
```
---

### Step 4: Connect MetaMask Wallet
- Click "Connect Wallet" in the frontend.
- A MetaMask popup should appear; select "Connect".
✅ **Expected Outcome**: The page should automatically redirect to the Admin Dashboard, as the first registered account is the Admin.

### Step 5: Verify KYC for an Investor
- Verify Investor 1 by inserting their wallet address in "Verify KYC".
- Confirm KYC status by selecting "Check KYC Status" and entering the investor’s wallet address.
✅ **Expected Output**: Verified

### Step 6: Create an Artwork Partition
- Enter the wallet address of Investor 1, the artwork name, and the token amount.
- Click "Create Partition".
✅ **Expected Output**: A popup notification confirming that the artwork partition was created.
- Verify partition balance:
- Select "Check Partition Balance".
- Enter Investor 1’s wallet address and the artwork name.
✅ **Expected Output**: The token amount assigned in the previous step.

### Step 7: Transfer Tokens
- Verify Investor 2: Insert Investor 2’s wallet address into "Verify KYC".
- Confirm by checking KYC Status.
✅ **Expected Output**: Verified
- Switch to Investor 1’s Account in MetaMask and reconnect.
✅ **Expected Outcome**: The frontend reloads and redirects to the Investor Dashboard.
- Transfer Tokens:
- Enter Investor 2’s wallet address, the artwork name, and the token amount.
✅ **Expected Output**: A popup notification confirming the successful transfer.
- Verify updated partition balance:
- Select "Check Partition Balance".
- Enter Investor 1’s wallet address and the artwork name.
✅ **Expected Output**: Investor 1’s remaining token balance after the transfer.

### Step 8: Create Additional Artwork Partitions (Optional)
- If additional testing is required, create another artwork partition and assign it to Investor 2 (Refer to Step 6).
- Investor 2 can transfer part of their tokens to Investor 1 (Refer to Step 7).

### Step 9: Transfer Remaining Tokens for Burn Test
- Transfer remaining tokens from Investor 1 to Investor 2.
- Confirm 100% ownership by checking the balance:
- Select "Check Partition Balance".
- Enter Investor 2’s wallet address and the artwork name.
✅ **Expected Output**: Investor 2 now holds 100% ownership of the artwork.
- Switch to Admin Account:
- Only the Admin can burn tokens.
- Perform Burn Validation (**3 Conditions to Check**):
  1. Investor 2 is KYC Verified.
  2. Artwork exists in "Get All Artworks".
  3. Investor 2 holds 100% ownership of the artwork.
- Execute the Burn Process:
- Enter Investor 2’s wallet address and the artwork name.
✅ **Expected Output**: A popup notification confirming successful burn.
- Confirm Burn Completion:
- Select "Check Partition Balance".
- Enter Investor 2’s wallet address and the artwork name.
✅ **Expected Output**: 0 tokens
- Verify Artwork Still Exists:
- Select "Get All Artworks".
✅ **Expected Output**: The artwork remains in the list.

### Admin Actions

1. **Verify KYC**
   - Input investor address → Click `Verify KYC`  
   - Confirm with `Check KYC Status`

2. **Create Artwork Partition**
   - Enter: investor address, artwork name, token amount  
   - Click `Create Partition`  
   - Confirm with `Check Partition Balance`

3. **Burn Tokens (Admin Only)**
   - Ensure the investor is KYC-verified  
   - Confirm they hold 100% tokens of the artwork  
   - Click `Burn Tokens`

---

### Investor Actions

1. **Transfer Tokens**
   - Enter recipient address, artwork name, and amount  
   - Click `Transfer Tokens`

2. **Check Partition Balance**
   - Enter artwork name  
   - Click `Check Balance`

3. **Get All Artworks**
   - Click `Get All Artworks` to view the list

---

## Demonstration

> View our live walkthrough:
- [Tokenized Artwork Management Platform (ERC-1400 DApp) Demo](https://youtu.be/df_t9fQpmL4)
---

## Learning Outcomes

- Understood the application of ERC-1400 for partitioned tokens  
- Gained experience with smart contract-based permission logic  
- Explored frontend-backend-wallet integration  
- Hands-on deployment on Arbitrum Sepolia  
- Importance of KYC enforcement in tokenized asset systems  

