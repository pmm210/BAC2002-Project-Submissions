# DEV Token Payroll DApp

## Project Title

**DEV Token Payroll** — A decentralized payroll system for cross-border salary and bonus management using DEV tokens.

---

## Description

This DApp enables seamless payroll automation on the **Moonbase Alpha testnet** using smart contracts. It supports two roles:

- **Manager**: Add/remove employees, deposit DEV tokens, pause/unpause payroll, and perform batch salary payments.
- **Employee**: View payroll info, claim salary or bonus if eligible.

The app uses:
- **RainbowKit** & **wagmi** for wallet connection
- **Next.js** with TypeScript for the frontend
- **viem** for formatting/token handling
- **Remix IDE** for smart contract deployment and testing

Everything is stored on-chain — no centralized database or backend server required.

---

## Setup Instructions

1. Install Dependencies
Unzip the project folder, open a terminal in the project directory, and run:
npm install

2. Connect MetaMask to Moonbase Alpha
Open MetaMask and click the network dropdown.

Select Add Network and configure with:

Network Name: Moonbase Alpha

RPC URL: https://rpc.api.moonbase.moonbeam.network

Chain ID: 1287

Currency Symbol: DEV

Block Explorer: https://moonbase.moonscan.io/

3. Run the Development Server
npm run dev
Then open http://localhost:3000 in your browser.
Note: No .env setup is required. Contract addresses are already hardcoded in lib/contract.ts.

## Team Memebers

Alenna
Nicole
Hazirah
Samuel


Vidoe link:  https://youtu.be/LsHpNgJDNvg
