# SmartEscrow – Trustless Freelance Payments on Polygon

## Overview

SmartEscrow is a decentralized application (dApp) that uses Ethereum smart contracts to provide secure and automated escrow services tailored for freelancers and clients. This system helps eliminate disputes, prevent payment delays, and build trust without relying on centralized platforms.

## Problem Statement

Freelancers often face:
- Delayed or missed payments
- Disputes with clients
- Lack of enforcement on centralized platforms

## Our Solution

SmartEscrow leverages blockchain technology to:
- Hold funds in escrow until both parties meet the agreed terms
- Auto-release funds upon agreement
- Provide a transparent, decentralized, and reliable payment process

## Demo Video

[Click here to watch our demo video!](https://youtu.be/V2GFatEmzsE?si=sykrC10FF641unGN)

## User Roles & Interactions

| Role        | Actions                                             |
|-------------|-----------------------------------------------------|
| Freelancer  | Accept job, submit work, receive funds              |
| Client      | Fund escrow, approve deliverables                   |
| Smart Contract | Lock, release, or refund payments automatically |

## Technology Stack

- Smart Contract: Solidity (via Remix IDE)
- Frontend: HTML, JavaScript
- Backend: Node.js with Express, XAMPP, PHP
- Testnet: Polygon Amoy
- Wallet: MetaMask

## Setup & Installation

### 1. Prerequisites

- XAMPP: https://www.apachefriends.org/
- Node.js and npm: https://nodejs.org/
- Remix IDE: https://remix.ethereum.org/
- MetaMask: https://metamask.io/

### 2. Polygon Amoy Testnet Setup

1. Visit Chainlist and search for "Polygon Amoy":  
   https://chainlist.org/?testnets=true&search=amoy

2. Add the testnet to your MetaMask wallet.

3. Get testnet tokens using this faucet:  
   https://faucet.stakepool.dev.br/amoy  
   (You can request once per day; alternatively, create multiple test accounts and transfer funds.)

### 3. Backend Setup

In your project directory:

```bash
npm init -y
npm install express cors body-parser dotenv express-session
```

### 4. Smart Contract Deployment (Remix)

1. Deploy the `SmartEscrowFinal.sol` smart contract using Remix IDE.
2. Save the following details:
   - Contract address
   - Contract ABI

### 5. Configuration

Update the following files with your deployed contract details:

- `disputeForm.html`, `server.js`, `app.js`:  
  Update with your contract address
  ```bash
  // In disputeForm.html and app.js
  SmartEscrowContract: {
    abi: abi,
    address: "Update address here",
  },

  // In server.js
  const CONTRACT_ADDRESS = "Update address here";
  ```

- `smartEscrowAbi.json`:  
  Replace the entire file with your contract ABI

- `server.js`, `app.js`:  
  Update with the correct freelancer wallet address
  ```bash
  // In server.js
  const FREELANCER_ADDRESS = "Update address here";

  // In app.js
  const freelancerAddress = "Update address here";
  ```

### 6. Running the Application

1. Start Apache using the XAMPP control panel.
2. In your project terminal, run the Node.js backend server:

```bash
node server.js
```

3. Open your browser and go to:

```
http://localhost/BlockchainProject
```

## Important Note on Auto-Releasing Funds

For funds to be automatically released to the freelancer, the MetaMask wallet used during approval must be logged into the freelancer’s address.

## Team Members

- Cheryl Lee Jiayu  
- Chua Zi Hui Hazel  
- How Ai Ying  
- Mock Jun Yu  
- Yeo Sim Yee  

This project was created as part of our Blockchain Development coursework.

## License

This project is intended solely for academic and learning purposes. Not for production use.
