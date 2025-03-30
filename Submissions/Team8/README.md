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
  pip install numpy pandas scikit-learn tensorflow matplotlib websocket-client requests
  ```
- [Hyperledger Fabric Binaries](https://hyperledger-fabric.readthedocs.io/en/release-2.5/install.html) (v2.5.0)
- [ghcr.io](https://github.com/features/packages) access for Hyperledger Explorer images
- PowerShell 5.1+ (Windows users)

### Important Setup Notes

1. **PowerShell Execution Policy**: On Windows, you may encounter execution policy restrictions. Run PowerShell as Administrator and use one of these approaches:
   ```powershell
   # Option 1: Bypass for current session only
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

   # Option 2: Run script directly with bypass 
   PowerShell -ExecutionPolicy Bypass -File .\scripts\start-stop\start-all.ps1
   ```

2. **Docker Network**: If you encounter a "fabric_network declared as external but not found" error, manually create the network first:
   ```bash
   docker network create fabric_network
   ```

## Installation & Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/your-org/private-prism.git
cd private-prism
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
   ```bash
   docker login ghcr.io -u YOUR_GITHUB_USERNAME -p YOUR_PERSONAL_ACCESS_TOKEN
   ```
   
   Or more securely (to avoid exposing your token in command history):
   ```bash
   echo YOUR_PERSONAL_ACCESS_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
   ```

### 3. Install Dependencies

```bash
# For federated learning components
pip install numpy pandas tensorflow-cpu scikit-learn websocket-client requests

# For Go components (Gateway)
cd gateway
go mod tidy
```

### 4. Start the Entire System

```bash
# Start the Hyperledger Fabric network, deploy chaincode, and launch all components
cd scripts/start-stop
./start-all.ps1
```

The script will automatically:
1. Set up the Hyperledger Fabric network with RAFT consensus
2. Deploy the smart contracts (chaincode)
3. Start API gateways and services (including MinIO and Explorer)
4. Launch federated learning components (aggregator and bank clients)

No additional startup commands are needed as all components are started by the single script.

## Usage

### Starting a Training Round

You can start a new training round in two ways:

#### Using the API:

```bash
# Example: Start a new training round via API
curl -X POST http://localhost:8883/rounds/start \
  -H "Content-Type: application/json" \
  -d '{"id":"round1", "initiator":"mas", "description":"Fraud Detection Model Training"}'
```

#### Using the CLI directly:

```bash
# Start a training round using the CLI container
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
  -c '{"function":"CreateTrainingRound","Args":["round:70","test-initiator","Test training round"]}'
```
Note: The `MSYS_NO_PATHCONV=1` prefix is needed on Git Bash/MSYS environments to prevent path conversion issues.

### Monitoring the Network

1. Access Hyperledger Explorer at http://localhost:8080
2. Login with username `exploreradmin` and password `exploreradminpw`

### Checking Model Quality and Reputation

```bash
# Get participant reputation
curl http://localhost:8883/reputation?id=dbs

# Get model quality metrics
curl http://localhost:8883/quality/round?id=round1
```

## System Flow

1. **Training Initiation**: MAS initiates a new training round
2. **Round Notification**: Banks receive the notification via WebSocket
3. **Local Training**: Each bank trains a model on local data
4. **Model Upload**: Trained models are uploaded to MinIO via pre-signed URLs
5. **Quality Filtering**: Aggregator evaluates model quality and filters poor contributions
6. **Federated Averaging**: Weighted average of accepted models with reputation-based weighting
7. **Result Storage**: Final model is stored in blockchain and MinIO
8. **Reputation Update**: Banks' reputation scores are updated based on contribution quality

## Advanced Features

### Dynamic Quality Thresholds

The system automatically adjusts quality thresholds based on:
- Historical model performance trends
- Participant reputation scores
- Overall system performance metrics

### Reputation System

Each bank has a reputation score that:
- Affects their weight in the aggregation process
- Adjusts based on the quality of their contributions
- Provides incentives for high-quality training

### Governance Controls

Smart contracts enforce:
- Participation requirements and permissions
- Quality control parameters and monitoring
- Audit trail for all training events and model submissions

## Troubleshooting

### Common Issues

1. **Connection refused to Fabric network**
   - Check if all peer and orderer containers are running
   - Verify TLS certificates are correctly mounted
   - Ensure the fabric_network Docker network exists

2. **WebSocket connection failures**
   - Ensure ports 8881-8884 are open and accessible
   - Check if gateway containers are running with `docker ps`
   - Verify WebSocket endpoints are correctly configured

3. **Model aggregation failures**
   - Verify MinIO is accessible at port 9000
   - Check model format compatibility between clients
   - Ensure all necessary Python dependencies are installed

### Logs

```bash
# Check Fabric logs
docker logs peer0.mas.example.com

# Check aggregator logs
docker logs fl-aggregator

# Check bank client logs
docker logs dbs_client
```

## Directory Structure

```
private-prism/
├── docker/                # Docker configurations
│   ├── explorer/          # Hyperledger Explorer config
│   ├── federated/         # Federated learning services
│   ├── network/           # Network configuration
│   └── services/          # Supporting services
├── docs/                  # Documentation
├── federated/             # Federated Learning
│   ├── aggregator/        # Model aggregation service
│   └── clients/           # Bank clients for local training
├── gateway/               # API Gateways
│   ├── aggregator-gateway/# Aggregator API
│   └── bank-gateway/      # Bank APIs
├── hyperledger-fabric/    # Blockchain components
│   ├── bin/               # Fabric binaries
│   ├── chaincode/         # Smart contracts
│   └── config/            # Network configuration
├── scripts/               # Utility scripts
│   ├── evaluation/        # Model evaluation tools
│   ├── generate-dataset/  # Data generation scripts
│   └── start-stop/        # Network control scripts
└── storage/               # Storage components
    └── minio-handler/     # MinIO integration
```

## Team Members

- Kelisha
- Rachel
- Samuel Soon
- Han Yi
- Yusri

## Demo Video

[Click here to view our project demo](https://drive.google.com/file/d/1TQHROwl6HSpLi5sgx_UnrKbU4yx4JtDg/view)
