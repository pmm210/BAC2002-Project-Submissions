Added Github repository: https://drive.google.com/file/d/1nwZGcUF67vqbf4s--NE-8eK7ZpRnToRu/view?usp=sharing


# GreenChain – Decentralized Carbon Credit Platform

Welcome to **GreenChain**, a decentralized application that enables the verification, tokenization, and trading of carbon credits using blockchain technology.

---

##  Project Description

GreenChain bridges environmental sustainability with DeFi by transforming carbon credit projects into tradable on-chain assets. The system allows:
- Issuers to mint carbon credit metadata (ERC1155) and fungible tokens (ERC20)
- Approvers to validate carbon projects
- Users to buy, swap, and retire credits
- On-chain liquidity provisioning through a custom AMM
- Simplified interactions using a Zap contract

The smart contract architecture consists of:
1. `CarbonRegistry`
2. `CarbonCreditMetadata` (ERC1155)
3. `CarbonCreditToken` (ERC20)
4. `CPAMM` (Custom AMM)
5. `CarbonAMMFactory`
6. `CarbonZap`

---

##  Setup & Run Instructions

###  Prerequisites
- Node.js v16+
- MetaMask

###  Install Dependencies
```bash
npm install
```

###  Compile & Deploy Contracts
```bash
npx hardhat compile
npx hardhat run scripts/deploy.ts --network localhost
```

###  Run React Frontend
```bash
cd frontend
npm install
npm start
```

---

##  Demo Video

[Watch the full demo](https://www.youtube.com/watch?v=KSOHmbSHLD8)

---

##  Team Members

ANG ZI JUN JEREMY (2003282)
TUNG JUN RONG KEEFE (2303020)
NIGEL LIM WEI SIANG (2302942)
YEOW DAO XING (2303175)
AINSLEY CHANG QI JIE (2302954)
---

##   Structure

```plaintext
/Project
  ├── AMM.sol
  ├── ERC1155.sol
  ├── ERC20.sol
  ├── artifacts/
  └── ...compiled JSON ABIs

/frontend
  ├── pages/
  ├── components/
  ├── hooks/
  └── abis/

README.md
```
