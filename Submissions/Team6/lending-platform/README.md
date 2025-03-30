# Lending Platform

A decentralized finance (DeFi) platform for peer-to-peer lending and borrowing on the BNB Chain.

## Table of Contents
- Description
- Features
- Smart Contracts
- Prerequisites
- Installation
- Running the Application
- Project Structure
- Technologies Used
- Meta-Transactions
- Security Considerations
- Contributing
- License

## Description
This lending platform is a DeFi application built on BNB Chain that facilitates peer-to-peer lending and borrowing of cryptocurrency. The platform uses smart contracts to manage loans, collateral, and interest rates without intermediaries. It provides a user-friendly interface for depositing funds, requesting collateralized loans, and managing repayments.

## Features
- User authentication and role-based access control
- Wallet connection and management with MetaMask
- Deposit funds into lending pool
- Overcollateralized loans with customizable parameters
- Smart contract-powered loan origination and repayment
- Meta-transactions for gas-less operations
- Loan health monitoring and liquidation processes
- Admin dashboard with platform analytics
- Real-time price feeds via Chainlink oracles
- Educational resources about DeFi lending

## Smart Contracts
The platform is powered by two key smart contracts:
- **Lending Contract**: Manages deposits, loans, collateral, and repayments
- **Forwarder Contract**: Enables meta-transactions for gas-less operations

These contracts are deployed on the BNB Chain testnet. Do not redeploy for a smooth experience.

## Prerequisites
- Python 3.9 or later
- MongoDB database
- Web3.py
- Flask
- MetaMask or other Web3 wallet
- BNB Chain testnet access

## Installation
1. Clone the repository:
    ```
    git clone https://github.com/Foxon31/BAC2002-Lending-Platform.git
    cd lending-platform
    ```

2. Set up a virtual environment:
    ```
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3. Install dependencies:
    ```
    pip install -r requirements.txt
    ```

4. Configure environment variables:
    ```
    cp .env.example .env
    ```
    Edit the `.env` file with your configuration details.

    I have already provided you with a pre-configured .env file for this project. This file contains all the necessary environment variables but doesn't include any sensitive information that would pose security risks.

## Running the Application

### Development Mode
```
python frontend/main.py
```

The application will be available at `http://localhost:5000`.

### Connecting to Blockchain
1. Ensure you have MetaMask installed and configured for BNB Chain Testnet
2. Connect your wallet to get the full functionality
3. For testnet BNB, use the BNB Chain Faucet: https://testnet.bnbchain.org/faucet-smart

## Project Structure
```
lending-platform/
├── frontend/           # Flask frontend application
│   ├── static/         # Static assets (CSS, images, JavaScript)
│   │   ├── css/        # Stylesheets
│   │   ├── img/        # Images and icons
│   │   └── js/         # Client-side JavaScript
│   ├── templates/      # Jinja2 HTML templates
│   └── main.py         # Frontend entry point
├── backend/            # Python backend logic
│   ├── routes/         # API route definitions
│   │   ├── admin_routes.py    # Admin-specific routes
│   │   ├── main_routes.py     # Core application routes
│   │   └── user_routes.py     # Authentication and user routes
│   ├── auth_utils.py   # Authentication utilities
│   ├── contract_utils.py # Smart contract interaction utilities
│   └── database.py     # MongoDB database connection
├── contracts/          # Smart contract source code
│   ├── LendingPlatform.sol     # Main lending contract
│   └── LendingForwarder.sol   # Meta-transaction forwarder contract
└── README.md           # Project documentation
```

## Technologies Used
- **Frontend**: HTML5, CSS3, JavaScript, Bootstrap 5
- **Backend**: Python, Flask
- **Database**: MongoDB
- **Blockchain**: BNB Chain, Web3.py
- **Smart Contracts**: Solidity
- **Authentication**: Flask-Login, Session Management
- **Price Feeds**: Chainlink Oracles
- **Development Tools**: Remix IDE, Truffle

## Meta-Transactions
This platform uses meta-transactions to provide a gas-less experience for users:

1. Users sign permission messages with their wallet
2. Backend relayer submits transactions to the blockchain
3. Users can interact with smart contracts without holding BNB for gas

## Security Considerations

### Smart Contract Security
- Collateralization requirements protect lenders
- Reentry Guards
- Access control for admin functions

### Backend Security
- Role-based access control
- Relayer key management through secure database
- Input validation and sanitization

### User Security
- Private keys never leave user's wallet
- All blockchain interactions require explicit signing
- Real-time loan health monitoring

## Video Demo
https://youtu.be/sDsQA-k3lG0

## Team Members and (User ID)
1. Mok Ji Yong, Jason (2303089)
2. Jasbir ()
3. Andrew Yaputra(2303129)
4. Varsha Kulkarni (2303153)
5. Ranson ()

## Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License
This project is licensed under the MIT License - see the LICENSE file for details.