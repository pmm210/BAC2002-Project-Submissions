# DecentraFlight - Blockchain-Based Flight Delay Insurance

DecentraFlight is a decentralized application (DApp) that provides automatic flight delay insurance using blockchain technology and smart contracts. When flights are delayed beyond a threshold, policyholders receive automatic compensation without having to file claims.

## Demo Video
[Watch our project demo on YouTube](https://youtu.be/9dEz86Q6ExQ)

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [Testing Flight Delays](#testing-flight-delays)
- [Smart Contract Details](#smart-contract-details)
- [API Services](#api-services)
- [Security Considerations](#security-considerations)
- [Team](#team)

## Project Overview

DecentraFlight provides a transparent, efficient insurance solution for travelers facing flight delays. Using blockchain technology, the platform allows users to purchase insurance policies for their flights. If a flight is delayed by more than 2 hours, compensation is automatically triggered and delivered to the policyholder's wallet.

## Features

- **Simple Policy Purchase**: Users can easily buy flight delay insurance by connecting their wallet and entering flight details.
- **Automatic Flight Monitoring**: Chainlink Keepers automatically check flight status.
- **Transparent Policy Management**: All policies are stored on-chain and visible to policyholders.
- **Instant Payouts**: Smart contracts automatically process compensation when flight delays are confirmed.
- **Admin Dashboard**: Admin interface for monitoring the system and managing parameters.

## Architecture

The system consists of several interconnected components:

1. **Frontend**: Web interface for users to purchase insurance and view policies
2. **Smart Contracts**: Blockchain logic for policy management and payouts
3. **API Service**: External service providing flight data verification
4. **Blockchain Listener**: Background service that listens for blockchain events
5. **Database**: Stores policy details and synchronizes with blockchain data

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript, Bootstrap, Web3.js
- **Backend**: Python, Flask
- **Blockchain**: Polygon Network (Amoy Testnet)
- **Smart Contracts**: Solidity, Chainlink (Oracle, Keepers)
- **Database**: PostgreSQL (via Supabase)
- **APIs**: DecentraFlight API for flight verification and status checking

## Installation & Setup

### Prerequisites

- Node.js (v16+)
- Python 3.8+
- MetaMask wallet extension
- Git
- Polygon Amoy testnet MATIC tokens (for testing)

###  Setup

1. Install required Node.js packages:
   ```
   npm install
   ```

2. Install required Python packages:
   ```
   pip install flask web3 psycopg2-binary python-dotenv requests websockets chainlink-utils filelock
   ```

3. Run the blockchain listener:
   ```
   python blockchain_listener.py
   ```

4. Run the Flask application:
   ```
   python app.py
   ```

5. Access the application:
   - Web app: http://localhost:3000
   - Admin dashboard: http://localhost:3000/admin (username: admin, password: password)
   - Test API: https://decentraflightapi.onrender.com/test.html

## Usage Guide

### For Users

1. Visit the DecentraFlight website at http://localhost:3000
2. Connect your MetaMask wallet (ensure it's configured for Polygon Amoy testnet)
3. Enter your flight details (airline, flight number, departure date)
4. Review the premium and coverage details
5. Click "Buy Insurance" and confirm the transaction in MetaMask
6. Your policy is now active and can be viewed in the "My Policies" section

### For Admins

1. Access the admin dashboard at http://localhost:3000/admin
2. Login with username: admin, password: password
3. Connect your admin wallet
4. Monitor system statistics, policy statuses, and funds
5. Configure contract parameters like check intervals
6. Force policy rechecks if needed
7. Withdraw protocol fees when appropriate

## Testing Flight Delays

To test the flight delay insurance flow, follow these steps:

1. Purchase insurance for flight AV43:
   - Visit http://localhost:3000
   - Connect your MetaMask wallet
   - Select Airline "Avianca (AV)" from the dropdown
   - Enter Flight Number "43"
   - **Important**: Select a FUTURE date (not a past date)
   - Click "Buy Insurance" and confirm the transaction in MetaMask

2. **Simulate a Flight Delay**:
   Access the test API page and use one of these methods:

   * **Using the Test API UI**:
     - Go to https://decentraflightapi.onrender.com/test.html
     - In the "Edit Flight Delay" section, enter "AV43" as the Flight IATA
     - Set "Delay Minutes" to 150 (greater than the 120-minute threshold)
     - Click "Update Flight Delay"

   * **Using the direct URL**:
     - Navigate to:
       ```
       https://decentraflightapi.onrender.com/api/update-flight-delay?flight_iata=AV43&delay_minutes=150
       ```

3. **Force Flight Status Check**:
   - Go to the admin dashboard (username: admin, password: password)
   - Find your policy and click "Force Recheck"
   - Alternatively, wait for the automatic check if Chainlink Keepers are running

4. **Verify Payout**:
   - Check your MetaMask wallet for incoming transactions
   - The payout should be 3x your premium amount
   - Your policy status should change to "COMPENSATED"

## Smart Contract Details

The core smart contract (`FlightDelayInsurance.sol`) handles:

- Policy creation and storage
- Flight status checking via Chainlink oracles
- Automatic payout processing
- Contract parameter management
- Fund management (premium splitting between insurance pool and protocol fees)

### Key Contract Parameters

- **MIN_DELAY_MINUTES**: 120 (2 hours) - Minimum delay for compensation
- **PAYOUT_PERCENTAGE**: 300% - Payout amount as percentage of premium
- **PROTOCOL_FEE_PERCENTAGE**: 20% - Fee percentage taken from premiums
- **Check Interval**: How often Chainlink Keepers scan for flights to check
- **Recheck Interval**: Minimum time between rechecking the same flight

### Contract Functions

#### User Functions

- **buyInsurance(string memory flightNumber, uint256 departureDate, uint256 premium, string memory currency)** - Purchase flight delay insurance
- **hasPolicyForFlight(address user, string memory flightIata, uint256 flightDate)** - Check if a user already has a policy for a specific flight

#### Admin Functions

- **withdrawExcessFunds(uint256 amount)** - Withdraw protocol fees (admin only)
- **forceRecheck(bytes32 policyId)** - Force recheck of a flight status (admin only)
- **setCheckInterval(uint256 newInterval)** - Update check interval (admin only)
- **setRecheckInterval(uint256 newInterval)** - Update recheck interval (admin only)

#### View Functions

- **totalPolicies()** - Get total number of policies
- **getPoliciesByOwner(address _owner)** - Get all policies for a specific user
- **getPolicyDetails(bytes32 policyId)** - Get detailed information about a specific policy
- **getAvailableRevenue()** - Get available revenue to withdraw

### Chainlink Integration

The contract uses Chainlink for two key functions:

1. **Oracle Data Feeds**: Fetches flight status data from DecentraFlight API
2. **Chainlink Keepers**: Automatically triggers flight status checks at regular intervals

### Contract Deployment

The contract is deployed on Polygon Amoy testnet at address: `0x1159d7d7F1f55C8c31265a59Bb6A952917896C8E`

## API Services

DecentraFlight uses a dedicated API for flight data, already deployed at https://decentraflightapi.onrender.com/

### API Endpoints

1. **Flight Verification**: Confirms flight exists before policy purchase
   - Endpoint: `/api/verify-flight`
   - Example: `POST /api/verify-flight` with body `{"airline_iata": "AV", "flight_number": "43", "departure_date": "2025-03-26"}`

2. **Flight Delay Checking**: Determines if flights are delayed
   - Endpoint: `/api/flight-delay`
   - Example: `GET /api/flight-delay?flight_iata=AV43&departure_date=2025-03-26`

3. **Airline Information**: Fetches airline details for the UI
   - Endpoint: `/api/airlines`

### Testing Flight Delays

You can easily test the flight delay API and insurance payout mechanism using our API test interface:

**API Test Interface:** https://decentraflightapi.onrender.com/test.html

This interface provides several testing options:
1. **Check API Health**: Verify the API is operational
2. **Get Airlines**: View all supported airlines
3. **Verify Flight**: Check if a flight exists and is valid for insurance
4. **Check Flight Delay**: Get the current delay status for a flight
5. **Edit Flight Data**: Update flight information
6. **Edit Flight Delay**: Set a specific delay time for testing insurance payouts

For quick testing, you can also use this direct URL:
https://decentraflightapi.onrender.com/api/update-flight-delay?flight_iata=AV43&delay_minutes=150

> Note: Test flight AV43 is available by default for testing the insurance flow.

## Blockchain Listener and Oracle Testing

### Blockchain Listener

The blockchain listener (`blockchain_listener.py`) monitors the blockchain for:

- Policy purchase events
- Flight status check events
- Policy claim events

It synchronizes this data with the database to ensure consistent state between the blockchain and backend.

### Running the Blockchain Listener

Simply run the blockchain listener as a separate process:

```
python blockchain_listener.py
```

This will keep the database in sync with on-chain events and process policy updates automatically.

**Important Note**: You can use your own contract address with the blockchain_listener by modifying the CONTRACT_ADDRESS variable in the script. This allows you to monitor events for your deployed contract.

### Oracle Testing

You can test the oracle functionality using the `oracle-test.js` script. This script provides an interactive interface to test flight data requests and verify Chainlink Oracle responses.

To use your own contract address:

1. Create or modify the `.env` file in your project root with your contract address:
   ```
   CONTRACT_ADDRESS=0xYourContractAddressHere
   PRIVATE_KEY=YourPrivateKeyHere
   POLYGON_AMOY_RPC=https://your-rpc-url-here
   ```

2. Run the script:
   ```
   node oracle-test.js
   ```

3. The script will:
   - Connect to your wallet
   - List all your policies from the contract
   - Allow you to select a policy for testing
   - Provide options to:
     - Update flight dates for testing
     - Request flight data from the Chainlink Oracle
     - Force recheck policies (admin only)
     - View detailed policy information
   - Monitor for oracle responses in real-time

This tool is useful for verifying that your contract correctly interacts with the Chainlink Oracle and processes flight delay claims.

## Security Considerations

- Smart contract uses OpenZeppelin contracts for security best practices
- Nonreentrant guards protect against reentrancy attacks
- Access control ensures only authorized addresses can call admin functions
- Funds are segregated between insurance pool and protocol fees
- Oracle security through Chainlink's decentralized network

## Troubleshooting

### Common Issues

1. **MetaMask Not Connecting**: 
   - Ensure you're on the Polygon Amoy testnet
   - Network details: 
     - Network Name: Polygon Amoy
     - RPC URL: https://polygon-amoy.g.alchemy.com/v2/your-key
     - Chain ID: 80002
     - Currency Symbol: MATIC

2. **Transaction Failed**:
   - Check if you have sufficient MATIC for gas
   - Verify the transaction in PolygonScan (https://amoy.polygonscan.com/)

3. **Policy Not Showing**:
   - Blockchain transactions can take time to process
   - Refresh the page or try clearing browser cache

### Getting Help

If you encounter issues or have questions, please:
1. Check existing GitHub issues for similar problems
2. Create a new issue with detailed information about your problem
3. Contact the team at 2303091@sit.singaporetech.edu.sg

## Team

This project was developed by:

- Celeste Tan Jia Yu (2303091)
- Ong Wei Qiang (2303095)
- Kenix Nge Yutong (2303072)
- Lee Zhi Qin (2303071)
- See Hui Yang Joel (2302961)