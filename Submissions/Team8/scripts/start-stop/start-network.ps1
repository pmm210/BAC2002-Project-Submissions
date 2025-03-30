# Master script to start the Private Prism federated blockchain network
# This script coordinates the startup of all components in the correct order

# Set base directory
$BASE_DIR = "$PSScriptRoot\..\.."
$HYPERLEDGER_DIR = "$BASE_DIR\hyperledger-fabric"
$SCRIPTS_DIR = "$HYPERLEDGER_DIR\scripts"
$DOCKER_DIR = "$BASE_DIR\docker"

Write-Host "========================================================="
Write-Host "   PRIVATE PRISM - FEDERATED BLOCKCHAIN AI NETWORK       "
Write-Host "========================================================="
Write-Host

# Step 1: Build the CLI container image if it doesn't exist
Write-Host "Step 1: Building CLI container with Go support..." -ForegroundColor Cyan
& $SCRIPTS_DIR\build-cli-image.ps1
if (-not $?) {
    Write-Host "Error: Failed to build CLI container image. Aborting." -ForegroundColor Red
    exit 1
}
Write-Host

# Step 2: Start the Hyperledger Fabric network
Write-Host "Step 2: Starting Hyperledger Fabric network..." -ForegroundColor Cyan
& $SCRIPTS_DIR\network-setup.ps1
if (-not $?) {
    Write-Host "Error: Failed to start Hyperledger Fabric network. Aborting." -ForegroundColor Red
    exit 1
}

# Give the network some time to stabilize
Write-Host "Waiting for network to stabilize (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15
Write-Host

# Step 3: Deploy chaincode
Write-Host "Step 3: Deploying chaincode to the network..." -ForegroundColor Cyan
& $SCRIPTS_DIR\deploy-chaincode.ps1
if (-not $?) {
    Write-Host "Error: Failed to deploy chaincode. Aborting." -ForegroundColor Red
    exit 1
}
Write-Host

# Step 4: Start API Gateways and MinIO
Write-Host "Step 4: Starting API Gateways and Storage services..." -ForegroundColor Cyan
docker-compose -f $DOCKER_DIR/services/docker-compose.yaml up -d
if (-not $?) {
    Write-Host "Error: Failed to start API Gateways and Storage services. Aborting." -ForegroundColor Red
    exit 1
}

# Give services time to start
Write-Host "Waiting for API services to initialize (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Write-Host

# Step 5: Start Federated Learning services
Write-Host "Step 5: Starting Federated Learning services..." -ForegroundColor Cyan
docker-compose -f $DOCKER_DIR/federated/docker-compose.yaml up -d
if (-not $?) {
    Write-Host "Error: Failed to start Federated Learning services. Aborting." -ForegroundColor Red
    exit 1
}

# Give services time to start
Write-Host "Waiting for Federated Learning services to initialize (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Write-Host

# Step 6: Start Hyperledger Explorer (optional)
Write-Host "Step 6: Starting Hyperledger Explorer..." -ForegroundColor Cyan
docker-compose -f $DOCKER_DIR/explorer/docker-compose.yaml up -d
if (-not $?) {
    Write-Host "Warning: Failed to start Hyperledger Explorer, but continuing..." -ForegroundColor Yellow
}

Write-Host
Write-Host "========================================================="
Write-Host "   PRIVATE PRISM NETWORK STARTED SUCCESSFULLY!           "
Write-Host "========================================================="
Write-Host 
Write-Host "Network Services:"
Write-Host "- Hyperledger Fabric: Running" -ForegroundColor Green
Write-Host "- API Gateways: Running" -ForegroundColor Green
Write-Host "- Storage Services: Running" -ForegroundColor Green
Write-Host "- Federated Learning: Running" -ForegroundColor Green
Write-Host "- Explorer: Available at http://localhost:8080" -ForegroundColor Green
Write-Host
Write-Host "To stop the network, run: $SCRIPTS_DIR\stop-network.ps1"