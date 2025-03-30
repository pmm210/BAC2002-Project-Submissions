# File-based chaincode deployment script for RAFT Consensus
# Updated for private-prism directory structure
# Run after network setup is complete

# Set base directory for the project
$BASE_DIR = "$PSScriptRoot\..\.."
$FABRIC_DIR = "$BASE_DIR\hyperledger-fabric"
$CHAINCODE_DIR = "$FABRIC_DIR\chaincode"

# Check that the network is running
Write-Host "Checking that the network is running..." -ForegroundColor Cyan
$CONTAINERS = docker ps --format "{{.Names}}" | Select-String -Pattern "peer0|orderer"
if ($CONTAINERS.Count -lt 9) {  # Check for 5 orderers + 4 peers
    Write-Host "Error: Network containers are not all running. Please run network setup first." -ForegroundColor Red
    exit 1
}

# Verify chaincode file exists
if (-not (Test-Path -Path $CHAINCODE_DIR/basic/main.go)) {
    Write-Host "Error: Main chaincode file not found at $CHAINCODE_DIR/basic/main.go" -ForegroundColor Red
    exit 1
}

# Create a proper go.mod file locally
$GO_MOD_CONTENT = @"
module github.com/asset-transfer

go 1.18

require github.com/hyperledger/fabric-contract-api-go v1.2.1
"@

# Write it to file in the chaincode directory
Write-Host "Creating go.mod file with proper dependencies..." -ForegroundColor Cyan
$GO_MOD_PATH = "$CHAINCODE_DIR/basic/go.mod"
Set-Content -Path $GO_MOD_PATH -Value $GO_MOD_CONTENT -Force

# Create chaincode structure and copy files
Write-Host "Creating chaincode structure in CLI container..." -ForegroundColor Cyan
docker exec cli bash -c "mkdir -p /opt/gopath/src/github.com/asset-transfer/"

# Use recursive copy to copy all files (Windows PowerShell)
Get-ChildItem -Path "$CHAINCODE_DIR/basic/" -Filter "*.go" | ForEach-Object {
    docker cp $_.FullName cli:/opt/gopath/src/github.com/asset-transfer/
}
# Copy go.mod file
docker cp $GO_MOD_PATH cli:/opt/gopath/src/github.com/asset-transfer/

# Set up Go environment and download dependencies
Write-Host "Setting up Go environment and downloading dependencies..." -ForegroundColor Cyan
docker exec -w /opt/gopath/src/github.com/asset-transfer cli bash -c "export GO111MODULE=on && export GOPROXY=https://proxy.golang.org && go mod tidy && go mod vendor"

# Package the chaincode
Write-Host "Packaging chaincode..." -ForegroundColor Cyan
docker exec -w /opt/gopath/src cli bash -c "peer lifecycle chaincode package asset-transfer.tar.gz --path github.com/asset-transfer --lang golang --label asset-transfer_1.0"

# Install on all peers
Write-Host "Installing on peer0.mas..." -ForegroundColor Green
docker exec -e CORE_PEER_LOCALMSPID="MASMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/peers/peer0.mas.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/users/Admin@mas.example.com/msp -e CORE_PEER_ADDRESS=peer0.mas.example.com:7051 -w /opt/gopath/src cli peer lifecycle chaincode install asset-transfer.tar.gz

Write-Host "Installing on peer0.ing..." -ForegroundColor Green
docker exec -e CORE_PEER_LOCALMSPID="INGMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/peers/peer0.ing.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/users/Admin@ing.example.com/msp -e CORE_PEER_ADDRESS=peer0.ing.example.com:8051 -w /opt/gopath/src cli peer lifecycle chaincode install asset-transfer.tar.gz

Write-Host "Installing on peer0.ocbc..." -ForegroundColor Green
docker exec -e CORE_PEER_LOCALMSPID="OCBCMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/peers/peer0.ocbc.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/users/Admin@ocbc.example.com/msp -e CORE_PEER_ADDRESS=peer0.ocbc.example.com:9051 -w /opt/gopath/src cli peer lifecycle chaincode install asset-transfer.tar.gz

Write-Host "Installing on peer0.dbs..." -ForegroundColor Green
docker exec -e CORE_PEER_LOCALMSPID="DBSMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/peers/peer0.dbs.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/users/Admin@dbs.example.com/msp -e CORE_PEER_ADDRESS=peer0.dbs.example.com:10051 -w /opt/gopath/src cli peer lifecycle chaincode install asset-transfer.tar.gz

# Get package ID
Write-Host "Retrieving package ID..." -ForegroundColor Cyan
$QUERY_INSTALLED = docker exec cli peer lifecycle chaincode queryinstalled
Write-Host "Raw command output:"
Write-Host $QUERY_INSTALLED

# Extract using a simpler regex pattern
$REGEX_PATTERN = 'asset-transfer_1\.0:[a-z0-9]+'
$REGEX_MATCH = [regex]::Match($QUERY_INSTALLED, $REGEX_PATTERN)

if ($REGEX_MATCH.Success) {
    $PACKAGE_ID = $REGEX_MATCH.Value
    Write-Host "Successfully extracted Package ID: $PACKAGE_ID" -ForegroundColor Green
} else {
    Write-Host "Failed to extract Package ID using regex." -ForegroundColor Red
    # Prompt for manual entry
    Write-Host "Please enter the Package ID from the output above:" -ForegroundColor Yellow
    $PACKAGE_ID = Read-Host "Package ID"
}

Write-Host "Using Package ID: $PACKAGE_ID" -ForegroundColor Green

# Set the orderer CA path (using orderer1)
$ORDERER_CA = "/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer1.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

# Approve from each organization - using orderer1
Write-Host "Approving from MASMSP..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID="MASMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/peers/peer0.mas.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/users/Admin@mas.example.com/msp -e CORE_PEER_ADDRESS=peer0.mas.example.com:7051 cli peer lifecycle chaincode approveformyorg -o orderer1.example.com:7050 --tls --cafile $ORDERER_CA --channelID hlftffv1 --name asset-transfer --version 1.0 --package-id $PACKAGE_ID --sequence 1 --init-required

Write-Host "Approving from INGMSP..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID="INGMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/peers/peer0.ing.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/users/Admin@ing.example.com/msp -e CORE_PEER_ADDRESS=peer0.ing.example.com:8051 cli peer lifecycle chaincode approveformyorg -o orderer1.example.com:7050 --tls --cafile $ORDERER_CA --channelID hlftffv1 --name asset-transfer --version 1.0 --package-id $PACKAGE_ID --sequence 1 --init-required

Write-Host "Approving from OCBCMSP..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID="OCBCMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/peers/peer0.ocbc.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/users/Admin@ocbc.example.com/msp -e CORE_PEER_ADDRESS=peer0.ocbc.example.com:9051 cli peer lifecycle chaincode approveformyorg -o orderer1.example.com:7050 --tls --cafile $ORDERER_CA --channelID hlftffv1 --name asset-transfer --version 1.0 --package-id $PACKAGE_ID --sequence 1 --init-required

Write-Host "Approving from DBSMSP..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID="DBSMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/peers/peer0.dbs.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/users/Admin@dbs.example.com/msp -e CORE_PEER_ADDRESS=peer0.dbs.example.com:10051 cli peer lifecycle chaincode approveformyorg -o orderer1.example.com:7050 --tls --cafile $ORDERER_CA --channelID hlftffv1 --name asset-transfer --version 1.0 --package-id $PACKAGE_ID --sequence 1 --init-required

# Check commit readiness
Write-Host "Checking commit readiness..." -ForegroundColor Cyan
$COMMIT_READINESS = docker exec cli peer lifecycle chaincode checkcommitreadiness --channelID hlftffv1 --name asset-transfer --version 1.0 --sequence 1 --output json --init-required
Write-Host $COMMIT_READINESS

# Commit chaincode definition to channel - Include all four peers for endorsement, using orderer1 
Write-Host "Committing chaincode definition..." -ForegroundColor Green
docker exec -e CORE_PEER_LOCALMSPID="MASMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/peers/peer0.mas.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/users/Admin@mas.example.com/msp -e CORE_PEER_ADDRESS=peer0.mas.example.com:7051 cli peer lifecycle chaincode commit -o orderer1.example.com:7050 --tls --cafile $ORDERER_CA --channelID hlftffv1 --name asset-transfer --version 1.0 --sequence 1 --init-required --peerAddresses peer0.mas.example.com:7051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/peers/peer0.mas.example.com/tls/ca.crt --peerAddresses peer0.ing.example.com:8051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/peers/peer0.ing.example.com/tls/ca.crt --peerAddresses peer0.ocbc.example.com:9051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/peers/peer0.ocbc.example.com/tls/ca.crt --peerAddresses peer0.dbs.example.com:10051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/peers/peer0.dbs.example.com/tls/ca.crt

# Wait a bit longer to ensure commit is propagated across RAFT orderers
Write-Host "Waiting for commit to be propagated (10 seconds)..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Initialize chaincode (inline JSON without cat)
Write-Host "Initializing chaincode..." -ForegroundColor Green
docker exec cli peer chaincode invoke `
    -o orderer1.example.com:7050 `
    --isInit `
    --tls `
    --cafile $ORDERER_CA `
    -C hlftffv1 -n asset-transfer `
    --peerAddresses peer0.mas.example.com:7051 `
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/peers/peer0.mas.example.com/tls/ca.crt `
    --peerAddresses peer0.ing.example.com:8051 `
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/peers/peer0.ing.example.com/tls/ca.crt `
    --peerAddresses peer0.ocbc.example.com:9051 `
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/peers/peer0.ocbc.example.com/tls/ca.crt `
    --peerAddresses peer0.dbs.example.com:10051 `
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/peers/peer0.dbs.example.com/tls/ca.crt `
    -c '{\"function\":\"InitLedger\",\"Args\":[]}'

# Wait longer for initialization to complete across RAFT orderers
Write-Host "Waiting for initialization (10 seconds)..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Verify by querying chaincode directly
Write-Host "Querying all assets to verify initialization..." -ForegroundColor Green
docker exec cli peer chaincode query `
    -C hlftffv1 -n asset-transfer `
    -c '{\"Args\":[\"GetAllAssets\"]}'

Write-Host "`nChaincode deployment complete with RAFT consensus!" -ForegroundColor Green