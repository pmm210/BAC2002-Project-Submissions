# RemitFlow: Blockchain-Based Remittance Platform

## Description

RemitFlow is a decentralized cross-border remittance platform that leverages blockchain technology to provide faster, cheaper, and more transparent money transfers. Our platform allows users to:

- Send any cryptocurrency and have it automatically converted to stablecoins
- Complete transactions in a single operation, reducing gas fees and transaction time
- Verify identity through a secure KYC process
- Track transaction history and status in real-time
- Access preferential exchange rates with lower fees compared to traditional remittance services

Traditional cross-border remittances are costly (6.2% avg. fees), slow (1–5 days processing), and inefficient (40% of transfers delayed due to KYC/AML). RemitFlow solves these problems by bundling conversions and transfers into a single blockchain transaction, dramatically reducing costs and processing time.

## Demo Video

Watch our demonstration video to see RemitFlow in action:

[Watch RemitFlow Demo](https://youtu.be/1UqQUGuxPA8)


## Tech Stack

### Frontend
- React.js
- React Bootstrap
- Ethers.js
- Socket.io Client
- Framer Motion

### Backend
- Node.js + Express
- PostgreSQL with pgAdmin 4 (NEON)
- Socket.io
- JSON Web Tokens (JWT)

### Blockchain
- Solidity Smart Contracts
- Hardhat
- Polygon Amoy Testnet
- OpenZeppelin

## Setup and Run Instructions

### Prerequisites
Before running the app, ensure you have the following installed:
- Node.js (latest LTS version recommended)
- npm (comes with Node.js)
- Git

### Database Setup
1. Open pgAdmin and go to "Servers" -> "Register" -> "Server"
2. Register a new server with the following details:
   - General tab: 
     - Name: NeonDB Remittance
   - Connection tab:
     - Host: ep-falling-pond-a18v6beg-pooler.ap-southeast-1.aws.neon.tech
     - Port: 5432
     - Username: neondb_owner
     - Password: npg_J1gcGiN7yCRS
     - Database: remittance_db
   - Parameters tab: 
     - SSL mode: require

### Project Setup
1. Clone the repository:
   ```
   git clone [repository-url]
   cd remitflow
   ```

2. Setup backend:
   ```
   cd remittance-backend
   npm install express pg bcryptjs jsonwebtoken dotenv cors ethers moralis multer socket.io
   npm install --save-dev nodemon
   ```

3. Setup frontend:
   ```
   cd ../remittance-frontend
   npm install react-bootstrap bootstrap
   npm install react-router-dom
   npm install react-toastify
   npm install axios ethers
   npm install framer-motion
   npm install socket.io-client
   npm install stream-browserify
   npm install recharts --save
   ```

4. Setup root project:
   ```
   cd ..
   npm run install-all
   npm install concurrently
   ```

5. Create `.env` files:

   For backend (remittance-backend/.env):
   ```
   # server configuration
   PORT=5000
   
   # database configuration
   DATABASE_URL=postgresql://remit_admin:npg_vOHKz0ydu6jg@ep-falling-pond-a18v6beg-pooler.ap-southeast-1.aws.neon.tech/remittance_db?sslmode=require
   
   # jwt auth secret key
   JWT_SECRET=e7d445040b1619b76b0e049983872d78692629e1582b5a37eee72170590fe69f81223025849a6dd53053d89e9ac1845b9f3860ee3efb99e9899a5bd2276147c8
   
   # moralis api key
   MORALIS_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImFiYWQ1YzMyLTA0ZWYtNGM2Ny05ZmNiLWI2MWM4NjFlZTQ5YyIsIm9yZ0lkIjoiNDM3MjA5IiwidXNlcklkIjoiNDQ5Nzc5IiwidHlwZUlkIjoiZWMyOTI2ZjMtMzAyYi00YWFhLWIxYjYtZTk5ZjE4MmM4NWY5IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDI0NTg0NjksImV4cCI6NDg5ODIxODQ2OX0.XdLNzs1qlfkk8oAsheNXMQtDt5lIS8NNA_FZoPye4ko
   
   # Blockchain Integration
   RPC_URL=https://polygon-rpc.com
   PRIVATE_KEY=b91a209071808fc8440bcd66d4b196249ed1ef6fbfde1684b410f0d30d6b687b
   CONTRACT_ADDRESS=0xA5BBD4fBf81129fDAF478D3f613F84f31cAF2232
   ```

   For frontend (remittance-frontend/.env):
   ```
   REACT_APP_API_URL=http://localhost:5000/api
   REACT_APP_WEBSOCKET_URL=http://localhost:5000
   REACT_APP_CONTRACT_ADDRESS=0xA5BBD4fBf81129fDAF478D3f613F84f31cAF2232
   ```

### Running the Application
1. From the root directory, run:
   ```
   npm start
   ```
   This will concurrently start both the backend server and the frontend application.

2. The backend will be available at http://localhost:5000
3. The frontend will be available at http://localhost:3000

### Test Account
For testing purposes to see transaction history, you can use:
- Email: test@mail.com
- Password: test

If not, please create a new account to see how kyc verification works.
Since admins need to verify the account for users, please head to the db, check table "kyc_status", and change the column "verified" from "FALSE" to "TRUE".

## User Workflow
1. Register and login with your account
2. Complete KYC verification before making transactions
3. Connect your cryptocurrency wallet (MetaMask)
4. Send money by selecting tokens and entering recipient address
5. Monitor transactions in the transaction history page

## Team Members
- Nur Afiqah Binte Omar (2303062)
- Saffiyudeen Afridha (2303151)
- Airy Zachary Bin Zainal (2303078)
- Graceanne Teo Huixuan (2303098)
- Thahirah Binti Abdul Rahman (2303007)
