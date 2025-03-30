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

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/dev-token-payroll.git
cd dev-token-payroll


2. Install Dependencies

npm install
3. Set Up Environment
Create a .env.local file in the root directory:

NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourPayrollContract
NEXT_PUBLIC_DEV_TOKEN_ADDRESS=0xYourDEVToken
Ensure these match your deployed contract addresses on Moonbase Alpha.

4. Run the Development Server
npm run dev
Then open http://localhost:3000 in your browser.


## Team Memebers

Alenna
Nicole
Hazirah
Samuel


Vidoe link:  https://youtu.be/LsHpNgJDNvg
