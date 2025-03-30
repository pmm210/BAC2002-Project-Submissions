# Setup Hyperledger Fabric Network using PowerShell with RAFT Consensus
# Updated for private-prism directory structure

# Set base directory for the project
$BASE_DIR = "$PSScriptRoot\..\.."
$FABRIC_DIR = "$BASE_DIR\hyperledger-fabric"
$CONFIG_DIR = "$FABRIC_DIR\config"
$BIN_DIR = "$FABRIC_DIR\bin"
$DOCKER_DIR = "$BASE_DIR\docker"

# Stop any existing containers
Write-Host "Stopping existing containers..." -ForegroundColor Cyan
docker-compose -f $DOCKER_DIR/network/docker-compose.yaml down --volumes --remove-orphans

# Clean up existing volumes
Write-Host "Cleaning up volumes..." -ForegroundColor Cyan
docker volume prune -f

# Clean up existing crypto material
Remove-Item -Path $CONFIG_DIR/crypto-config -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path $CONFIG_DIR/channel-artifacts -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $CONFIG_DIR/crypto-config -Force
New-Item -ItemType Directory -Path $CONFIG_DIR/channel-artifacts -Force

# Generate crypto material
Write-Host "Generating crypto material..." -ForegroundColor Cyan
& "$BIN_DIR\cryptogen" generate --config=$CONFIG_DIR/organizations/cryptogen/crypto-config-orderer.yaml --output=$CONFIG_DIR/crypto-config
& "$BIN_DIR\cryptogen" generate --config=$CONFIG_DIR/organizations/cryptogen/crypto-config-mas.yaml --output=$CONFIG_DIR/crypto-config
& "$BIN_DIR\cryptogen" generate --config=$CONFIG_DIR/organizations/cryptogen/crypto-config-ing.yaml --output=$CONFIG_DIR/crypto-config
& "$BIN_DIR\cryptogen" generate --config=$CONFIG_DIR/organizations/cryptogen/crypto-config-ocbc.yaml --output=$CONFIG_DIR/crypto-config
& "$BIN_DIR\cryptogen" generate --config=$CONFIG_DIR/organizations/cryptogen/crypto-config-dbs.yaml --output=$CONFIG_DIR/crypto-config
& "$BIN_DIR\cryptogen" generate --config=$CONFIG_DIR/organizations/cryptogen/crypto-config-aggregator.yaml --output=$CONFIG_DIR/crypto-config

# Fix directory paths in config files - replace Windows backslashes with forward slashes
Write-Host "Fixing path separators in crypto-config..." -ForegroundColor Cyan
Get-ChildItem -Path $CONFIG_DIR/crypto-config -Recurse -File | Where-Object { $_.Extension -match "\.ya?ml|\.json|\.pem|\.crt|\.key" } | ForEach-Object {
    (Get-Content $_.FullName -Raw) -replace '\\', '/' | Set-Content $_.FullName
}

# Generate genesis block
Write-Host "Generating genesis block..." -ForegroundColor Cyan
& $BIN_DIR/configtxgen -profile BankingOrdererGenesis -channelID system-channel -outputBlock $CONFIG_DIR/channel-artifacts/genesis.block -configPath $CONFIG_DIR/configtx

# Generate channel tx
Write-Host "Generating channel transaction..." -ForegroundColor Cyan
& $BIN_DIR/configtxgen -profile BankingChannel -outputCreateChannelTx $CONFIG_DIR/channel-artifacts/hlftffv1.tx -channelID hlftffv1 -configPath $CONFIG_DIR/configtx

# Start the network
Write-Host "Starting the network..." -ForegroundColor Cyan
docker-compose -f $DOCKER_DIR/network/docker-compose.yaml up -d

# Wait much longer for containers to fully start (RAFT consensus needs more time)
Write-Host "Waiting for basic container startup (30 seconds)..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

# Verify orderers are running
Write-Host "Verifying orderer containers are running..." -ForegroundColor Cyan
docker ps | Select-String "orderer1.example.com"
docker ps | Select-String "orderer2.example.com"
docker ps | Select-String "orderer3.example.com"
docker ps | Select-String "orderer4.example.com"
docker ps | Select-String "orderer5.example.com"

# Give RAFT consensus more time to elect a leader
Write-Host "Giving orderers more time to stabilize and elect a leader (60 seconds)..." -ForegroundColor Cyan
Start-Sleep -Seconds 60

# Fix TLS certificate paths inside CLI container
Write-Host "Fixing TLS certificate paths in CLI container..." -ForegroundColor Cyan
docker exec cli mkdir -p /tmp/fixed-certs

# Fix using simpler commands to avoid quotation issues
docker exec cli bash -c 'find /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto -name "*.pem" -o -name "*.crt" > /tmp/cert_files.txt'
docker exec cli bash -c 'cat /tmp/cert_files.txt | while read file; do cp "$file" "$file.fixed"; done'
docker exec cli bash -c 'cat /tmp/cert_files.txt | while read file; do mv "$file.fixed" "$file"; done'

# Create channel with proper MSP configuration - using orderer1 (the leader)
Write-Host "Creating channel with proper MSP configuration..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID="MASMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer1.example.com/msp/tlscacerts/tlsca.example.com-cert.pem -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/users/Admin@mas.example.com/msp -e CORE_PEER_ADDRESS=peer0.mas.example.com:7051 cli peer channel create -o orderer1.example.com:7050 -c hlftffv1 -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/hlftffv1.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer1.example.com/msp/tlscacerts/tlsca.example.com-cert.pem --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/hlftffv1.block -t 60s

# Wait for channel creation to complete
Write-Host "Waiting for channel creation to complete (15 seconds)..." -ForegroundColor Cyan
Start-Sleep -Seconds 15

# Join peer0.mas to channel
Write-Host "Joining peer0.mas to channel..." -ForegroundColor Green
docker exec -e CORE_PEER_LOCALMSPID="MASMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/peers/peer0.mas.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/users/Admin@mas.example.com/msp -e CORE_PEER_ADDRESS=peer0.mas.example.com:7051 cli peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/hlftffv1.block

# Join peer0.ing to channel
Write-Host "Joining peer0.ing to channel..." -ForegroundColor Green
docker exec -e CORE_PEER_LOCALMSPID="INGMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/peers/peer0.ing.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/users/Admin@ing.example.com/msp -e CORE_PEER_ADDRESS=peer0.ing.example.com:8051 cli peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/hlftffv1.block

# Join peer0.ocbc to channel
Write-Host "Joining peer0.ocbc to channel..." -ForegroundColor Green
docker exec -e CORE_PEER_LOCALMSPID="OCBCMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/peers/peer0.ocbc.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/users/Admin@ocbc.example.com/msp -e CORE_PEER_ADDRESS=peer0.ocbc.example.com:9051 cli peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/hlftffv1.block

# Join peer0.dbs to channel
Write-Host "Joining peer0.dbs to channel..." -ForegroundColor Green
docker exec -e CORE_PEER_LOCALMSPID="DBSMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/peers/peer0.dbs.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/users/Admin@dbs.example.com/msp -e CORE_PEER_ADDRESS=peer0.dbs.example.com:10051 cli peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/hlftffv1.block

# Verify channel membership for all peers
Write-Host "Verifying channel membership for all peers..." -ForegroundColor Cyan
Write-Host "`nVerifying peer0.mas..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID="MASMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/peers/peer0.mas.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/mas.example.com/users/Admin@mas.example.com/msp -e CORE_PEER_ADDRESS=peer0.mas.example.com:7051 cli peer channel list

Write-Host "`nVerifying peer0.ing..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID="INGMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/peers/peer0.ing.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ing.example.com/users/Admin@ing.example.com/msp -e CORE_PEER_ADDRESS=peer0.ing.example.com:8051 cli peer channel list

Write-Host "`nVerifying peer0.ocbc..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID="OCBCMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/peers/peer0.ocbc.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/ocbc.example.com/users/Admin@ocbc.example.com/msp -e CORE_PEER_ADDRESS=peer0.ocbc.example.com:9051 cli peer channel list

Write-Host "`nVerifying peer0.dbs..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID="DBSMSP" -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/peers/peer0.dbs.example.com/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dbs.example.com/users/Admin@dbs.example.com/msp -e CORE_PEER_ADDRESS=peer0.dbs.example.com:10051 cli peer channel list

# Create fabric_network if it doesn't exist
docker network create fabric_network 2>$null
Write-Host "`nNetwork setup complete with RAFT consensus!" -ForegroundColor Green