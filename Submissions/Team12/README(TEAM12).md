# Readme for Running the Hyperledger Fabric DApp (Financial Auditing System)

This document provides step-by-step instructions to set up and run the Hyperledger Fabric DApp on a new computer. The DApp is built on Hyperledger Fabric and uses a modified setup to preserve ledger data, chaincode, and CA data across network restarts. Follow these instructions carefully to install prerequisites, set up the network, manually start the CLI, and run the DApp.

Description
This Financial Auditing System is a decentralized application (DApp) built on Hyperledger Fabric that facilitates the management, auditing, and regulation of financial claims. The platform uses chaincode to securely manage claim submissions, status updates, and auditing processes in a permissioned blockchain network. It provides a user-friendly interface for companies to submit claims, auditors to review and update claim statuses, and regulators to monitor approved claims, ensuring transparency and compliance without intermediaries.

Features
- Role-based access control for three user types: Company, Auditor, and Regulator
- Secure claim submission by companies with fraud detection
- Status updates (e.g., Submitted, Under Review, Approved, Rejected) by auditors
- Real-time querying of claims by ID or all claims (role-based visibility)
- Yearly summary of approved claims (total amount and count) for auditors and regulators
- Fraud detection for duplicate claims within a one-hour window
- Responsive web interface for claim management
- Integration with Hyperledger Fabric test network (mychannel)

---

## Prerequisites

Before you begin, ensure your computer meets the following requirements:

1. **Operating System**:
   - Linux (e.g., Ubuntu 18.04 or later), macOS, or Windows (with WSL2 recommended for Windows users).
   - These instructions are written for Linux/macOS. For Windows, use WSL2 and follow the Linux steps.

2. **Hardware**:
   - At least 4GB of RAM and 10GB of free disk space.
   - A multi-core CPU for better performance.

3. **Software Dependencies**:
   - Docker: Version 20.10 or later.
   - Docker Compose: Version 2.0 or later.
   - Git: To clone the `fabric-samples` repository.
   - Curl: To download the Fabric binaries.
   - Go: Version 1.21 or later (if your DApp includes Go chaincode).
   - Node.js and npm: Version 16 or later (if your DApp includes a Node.js application).
   - Make and build-essential tools (for Linux).

---

## Step 1: Install Prerequisites

### 1.1 Install Docker and Docker Compose
1. **Install Docker**:
   - On Ubuntu:
     
sudo apt update
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker

- On macOS:
- Download and install Docker Desktop from https://www.docker.com/products/docker-desktop.
- Start Docker Desktop.
- On Windows (using WSL2):
- Install WSL2 and a Linux distribution (e.g., Ubuntu) following Microsoft’s guide: https://learn.microsoft.com/en-us/windows/wsl/install.
- Install Docker Desktop and enable WSL2 integration.
- Follow the Ubuntu steps above within your WSL2 environment.

2. **Add Your User to the Docker Group** (Linux only):
   
sudo usermod -aG docker $USER

Log out and log back in for the change to take effect.

3. **Install Docker Compose**:
- On Ubuntu: sudo apt install -y docker-compose-plugin

- On macOS/Windows:
- Docker Compose is included with Docker Desktop.

4. **Verify Installation**:
docker --version
docker compose version

Ensure Docker is running:


### 1.2 Install Git, Curl, and Build Tools
- On Ubuntu: sudo apt install -y git curl build-essential
- On macOS: brew install git curl
(Install Homebrew if not already installed: https://brew.sh)

### 1.3 Install Go 
1. Download and install Go:
 - On Ubuntu: 
	wget https://golang.org/dl/go1.21.0.linux-amd64.tar.gz
	sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz

- On macOS:
	brew install go@1.21

2. Set up your environment: (NOTE: SET UP ACCORDING TO YOUR OWN PC PATH)
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
echo 'export GOPATH=$HOME/go' >> ~/.bashrc
echo 'export PATH=$PATH:$GOPATH/bin' >> ~/.bashrc
source ~/.bashrc

3. Verify installation:
go version

### 1.4 Install Node.js and npm 
1. Install Node.js:
- On Ubuntu:
	curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
	sudo apt install -y nodejs

- On macOS:
	brew install node@16

2. Verify installation:
	node --version
	npm --version



---

## Step 2: Set Up the Hyperledger Fabric Network (NOTE: All commands need to be run on WSL2/Ubuntu/Gitbash)

The necessary `fabric-samples` and `node_modules` files are provided in the links below. Please download and place them into the project folder. You don’t need to clone the repository, but you’ll need to download the Fabric binaries and Docker images.

fabric-samples: https://drive.google.com/drive/folders/1ZoMGKioXohnbYUdODji4hAGCZyv-ydKA?usp=sharing
node_modules: https://drive.google.com/drive/folders/10G2tOffZ4vey0Gi1nN0IFrYXQkubS18Y?usp=sharing

### 2.1 Navigate to the Provided Directory
Navigate to the directory containing the provided files: 
EXAMPLE: cd /mnt/c/Users/westb/Desktop/websys/BlockChain-Project/fabric-samples

### 2.2 Download Fabric Binaries and Docker Images
1. Navigate to the `fabric-samples` directory:
cd fabric-samples

The `fabric-samples` directory in this package is based on Hyperledger Fabric version 2.5.0.

2. Download the Fabric binaries and Docker images:
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.6

This script downloads the Fabric binaries, places them in `fabric-samples/bin`, and pulls the necessary Docker images (e.g., `hyperledger/fabric-peer`, `hyperledger/fabric-orderer`).

3. Add the binaries to your PATH:
export PATH=$PWD/bin:$PATH

To make this permanent, add the following to your `~/.bashrc` or `~/.zshrc`:
echo 'export PATH=$PATH:'$PWD'/bin' >> ~/.bashrc
source ~/.bashrc

4. Verify the binaries:
peer version


### 2.3 Verify the Modified Files
The test network in this package has been modified to preserve ledger data, chaincode, and CA data across restarts. The following files are already modified and included:

- `fabric-samples/test-network/network.sh`
- `fabric-samples/test-network/compose/compose-test-net.yaml`

You don’t need to replace these files, as they are already set up correctly.

---

## Step 3: Set Up the Network

### 3.1 Navigate to the Test Network Directory
cd fabric-samples/test-network


### 3.2 Create Persistent Docker Volumes
The modified `compose-test-net.yaml` uses external Docker volumes to preserve ledger data. Create these volumes explicitly:
docker volume create peer0.org1.example.com
docker volume create peer0.org2.example.com
docker volume create orderer.example.com


### 3.3 Start the Network
Start the Hyperledger Fabric network:
./network.sh up -ca


This command starts the peers (`peer0.org1.example.com`, `peer0.org2.example.com`) and the orderer (`orderer.example.com`) and CA server. The CLI container MIGHT not be started automatically by this command.

### 3.4 Verify the Channel
The channel (`mychannel`) is already preserved in the ledger data you imported. You don’t need to recreate it unless you start fresh. 
To verify:
peer channel list

You should see `mychannel` in the list.

If the channel is not present, create it:
./network.sh createChannel -c mychannel

---

## Step 4: Manually Set Up the CLI

The CLI container (`cli`) is used to interact with the network (e.g., to deploy chaincode, invoke transactions, or query the ledger). Since the modified `network.sh` might not automatically start the CLI, you may need to start it manually.

### 4.1 Start the CLI Container (replace with your own Computer's path at the -v command)

docker run -d --name cli \
  --network fabric_test \
  -v /mnt/c/Users/westb/Downloads/financial-audit_1/fabric-samples/test-network/organizations:/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
  -e CORE_PEER_TLS_ENABLED=true \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp \
  hyperledger/fabric-tools:latest \
  /bin/bash -c "tail -f /dev/null"


### 4.2 Access the CLI Shell
Access the CLI container’s shell to run commands:
docker exec -it cli bash


### 4.3 Verify the CLI Setup
Inside the CLI shell, verify that you can interact with the network:
peer chaincode list -C mychannel


This should list the `financial-audit.go' chaincode, which is already installed and committed on the channel (preserved in the ledger data).

---

## Step 5: Verify the Chaincode


The  chaincode is already installed and committed on the channel (preserved in the ledger data). The chaincode source code is included in `fabric-samples/chaincode/financial-audit.go'

### 5.1 Verify the Chaincode
Access the CLI shell (if not already in it):
docker exec -it cli bash


Check the installed chaincode:
peer chaincode list --installed


Check the committed chaincode on the channel:
peer chaincode list -C mychannel


You should see the `basic` chaincode in both lists.

ELSE, deploy the chaincode by using this code: (change it to your computer's pathing)
cd /mnt/c/Users/westb/Desktop/websys/BlockChain-Project/fabric-samples/test-network
./network.sh deployCC -ccn financial_audit -ccp ../chaincode/financial_audit -ccl go -ccv 1.0 -ccs 1 -c mychannel


---

## Step 6: Run the DApp

### 6.1 Navigate to the file directory . for eg. (cd /mnt/c/Users/westb/Desktop/websys/BlockChain-Project)

### 6.2 Start the Dapp
node server

Access the DApp in your browser (e.g., http://localhost:3000)

## Step 7: Shutting Down 
./network.sh down

Team Members and (User ID)
Jovan Lim Yu Hang (2303397)
Hibatul Hadi (2303116)
Bryan Won (2303069)
Gerald Tan Liang Chee (2303173)
Koh Tong Wei (2303365) 

Video Demo:
https://youtu.be/btXw6beawpo?si=GEkpHOA2JRBtxPwG
