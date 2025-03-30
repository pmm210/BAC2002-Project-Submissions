# PrivatePrism: Blockchain-Powered Federated Learning

A secure, decentralized machine learning platform for financial institutions using Hyperledger Fabric and TensorFlow, designed to maintain data privacy while enabling collaborative model training.

## Project Overview

PrivatePrism combines federated learning and blockchain technology to enable multiple financial institutions to collaboratively train AI models without sharing sensitive data. By leveraging Hyperledger Fabric for governance and TensorFlow for distributed model training, the system ensures transparency, accountability, and privacy.

### Key Features

- **Privacy-Preserving Training**: Local model training keeps sensitive data private
- **Reputation System**: Quality-based participant scoring improves model reliability
- **Dynamic Thresholds**: Adaptive quality controls prevent model poisoning
- **RAFT Consensus**: Fault-tolerant blockchain network with 5 orderers
- **Secure Model Storage**: MinIO integration for model weight transfer
- **Real-time Events**: WebSocket-based event propagation system

### Participating Organizations

The network includes the following financial institutions:

- MAS (Monetary Authority of Singapore)
- DBS Bank
- OCBC Bank
- ING Bank

## System Architecture

The project is organized into several key directories:

### 1. Hyperledger Fabric (`/hyperledger-fabric`)

Contains the blockchain network configuration:

- Smart contracts (chaincode) for tracking training rounds, participation, and models
- RAFT consensus configuration with 5 orderers for fault tolerance
- Organization MSPs and crypto materials
- Channel configuration

### 2. Federated Learning (`/federated`)

Contains the machine learning components:

- Bank clients for local model training with data privacy
- Aggregator for federated averaging with quality filtering
- Data preprocessing and model evaluation tools

### 3. Gateway (`/gateway`)

API layer connecting blockchain and machine learning:

- Bank gateways for each participating institution
- Aggregator gateway for coordinating the training process
- WebSocket event listeners for real-time updates

### 4. Storage (`/storage`)

Model storage solution:

- MinIO handler for secure model weight transfer
- Pre-signed URL generation for secure uploads
- Object storage configuration

### 5. Docker (`/docker`)

Docker configurations for all components:

- Explorer for monitoring blockchain activity
- Federated learning services
- Network configuration
- Supporting services

## Prerequisites

- Docker and Docker Compose
- Node.js (v14+)
- Go (v1.18+)
- Python 3.8+ with the following packages:
  ```bash
  pip install numpy pandas scikit-learn tensorflow matplotlib websocket-client requests argparse
  ```
- [Hyperledger Fabric Binaries](https://hyperledger-fabric.readthedocs.io/en/release-2.5/install.html) (v2.5.0)
- [ghcr.io](https://github.com/features/packages) access for Hyperledger Explorer images
- PowerShell 5.1+ (Windows users)

### Important Setup Notes

**Download Required Dataset**: Before running the start script, download the required CSV file from the following link and place it in the appropriate directory:

[Download Credit Card Dataset](https://drive.google.com/file/d/1_5LQggHzP5dBowZSEwU7rsYnZ_BATkxR/view?usp=drive_link)

1. **Create the Docker Network**: If you encounter a "fabric\_network declared as external but not found" error, manually create the network first:
   ```bash
   docker network create fabric_network
   ```

2. **Set PowerShell Execution Policy and Start the System**: On Windows, you may encounter execution policy restrictions. Run PowerShell as Administrator and execute:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   PowerShell -ExecutionPolicy Bypass -File .\scripts\start-stop\start-all.ps1
   ```

## Installation & Setup

### 1. Clone the Repository

```bash
# Clone the repository
cd Team8
```

### 2. Set Up GitHub Container Registry Access

1. **Generate a Personal Access Token (PAT)**:

   - Log in to GitHub
   - Go to Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
   - Click "Generate new token"
   - Select the `read:packages` permission
   - Click "Generate token"
   - **Important**: Copy and save your token immediately, as you won't be able to see it again

2. **Login to GitHub Container Registry**:

   ```powershell
   $env:CR_PAT="YOUR_PERSONAL_ACCESS_TOKEN"
   echo $env:CR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
   ```

### 3. Install Dependencies (On Local Machine)

```bash
pip install pandas numpy scikit-learn argparse
```

### 4. Start the Entire System

```powershell
# Start the Hyperledger Fabric network, deploy chaincode, and launch all components
cd scripts/start-stop
./start-network.ps1
```

## Usage

### Starting a Training Round

You can start a new training round using the CLI command:

```bash
MSYS_NO_PATHCONV=1 docker exec cli peer chaincode invoke \
  -o orderer1.example.com:7050 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer1.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
  -C hlftffv1 -n asset-transfer \
  --peerAddresses peer0.mas.example.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/peers/peer0.mas.example.com/tls/ca.crt \
  --peerAddresses peer0.ing.example.com:8051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/peers/peer0.ing.example.com/tls/ca.crt \
  --peerAddresses peer0.ocbc.example.com:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/peers/peer0.ocbc.example.com/tls/ca.crt \
  -c '{"function":"CreateTrainingRound","Args":["round:1","test-initiator","Test training round"]}'
```

### Monitoring the Network

1. Access Hyperledger Explorer at [http://localhost:8080](http://localhost:8080)
2. Login with username `exploreradmin` and password `exploreradminpw`
3. Use the MinIO front-end to explore stored models at [http://localhost:9002](http://localhost:9002), using credentials `fladmin` and `flsecret`

## Team Members (Team 8)

- Samuel Soon (2300489)
- Han Yi (2302934)
- Rachel Poh (2302945)
- Yusri (2302950)
- Kelisha (2303030)

## Demo Video

[Click here to view our project demo. Skip to 9:40 timestamp to view DEMO](https://drive.google.com/file/d/1pm44i8k-GO1jiRHsNB-AW8jbavGUp0cL/view?usp=drive_link)
