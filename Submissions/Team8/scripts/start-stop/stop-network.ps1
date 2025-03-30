# Script to stop the Private Prism federated blockchain network
# This script shuts down all components and completely resets the environment

# Set base directory
$BASE_DIR = "$PSScriptRoot\..\.."
$DOCKER_DIR = "$BASE_DIR\docker"
$CRYPTO_CONFIG_DIR = "$BASE_DIR\hyperledger-fabric\config\crypto-config"
$CHANNEL_ARTIFACTS_DIR = "$BASE_DIR\hyperledger-fabric\config\channel-artifacts"
$EXPLORER_DB_DIR = "$DOCKER_DIR\explorer\explorerdb"

Write-Host "========================================================="
Write-Host "   STOPPING PRIVATE PRISM NETWORK                        "
Write-Host "========================================================="
Write-Host

# Step 1: Stop all containers in reverse order
Write-Host "Step 1: Stopping all Docker containers..." -ForegroundColor Cyan

# Step 1.1: Stop Explorer
Write-Host "  Stopping Hyperledger Explorer..." -ForegroundColor Yellow
docker-compose -f $DOCKER_DIR/explorer/docker-compose.yaml down -v

# Step 1.2: Stop Federated Learning services
Write-Host "  Stopping Federated Learning services..." -ForegroundColor Yellow
docker-compose -f $DOCKER_DIR/federated/docker-compose.yaml down -v

# Step 1.3: Stop API Gateways and MinIO
Write-Host "  Stopping API Gateways and Storage services..." -ForegroundColor Yellow
docker-compose -f $DOCKER_DIR/services/docker-compose.yaml down -v

# Step 1.4: Stop Hyperledger Fabric network
Write-Host "  Stopping Hyperledger Fabric network..." -ForegroundColor Yellow
docker-compose -f $DOCKER_DIR/network/docker-compose.yaml down -v

# Stop any remaining fabric containers if they exist
Write-Host "  Checking for any remaining fabric containers..." -ForegroundColor Yellow
$CONTAINERS = docker ps -a --format "{{.Names}}" | Select-String -Pattern "peer|orderer|fabric|explorer|minio|gateway|client|aggregator"
if ($CONTAINERS) {
    Write-Host "  Found remaining containers, removing them..." -ForegroundColor Yellow
    foreach ($container in $CONTAINERS) {
        docker rm -f $container
    }
}

Write-Host "All containers stopped" -ForegroundColor Green
Write-Host

# Step 2: Remove Docker volumes and networks
Write-Host "Step 2: Removing Docker volumes and networks..." -ForegroundColor Cyan

# Step 2.1: Remove named volumes
Write-Host "  Removing Docker volumes..." -ForegroundColor Yellow
$VOLUMES = docker volume ls --format "{{.Name}}" | Select-String -Pattern "minio|peer|orderer|explorer"
if ($VOLUMES) {
    foreach ($volume in $VOLUMES) {
        docker volume rm -f $volume
    }
}

# Step 2.2: Remove fabric_network if it exists
$NETWORKS = docker network ls --format "{{.Name}}" | Select-String -Pattern "fabric_network"
if ($NETWORKS) {
    Write-Host "  Removing fabric_network..." -ForegroundColor Yellow
    docker network rm fabric_network
}

Write-Host "Docker volumes and networks removed" -ForegroundColor Green
Write-Host

# Step 3: Clean up directories
Write-Host "Step 3: Cleaning up directories..." -ForegroundColor Cyan

# Step 3.1: Remove Explorer database completely
if (Test-Path $EXPLORER_DB_DIR) {
    Write-Host "  Removing Explorer database files..." -ForegroundColor Yellow
    # Force removal of all contents including hidden and system files
    Remove-Item -Path $EXPLORER_DB_DIR -Recurse -Force -ErrorAction SilentlyContinue
    
    # Ensure parent directory exists
    $EXPLORER_PARENT = Split-Path -Path $EXPLORER_DB_DIR -Parent
    if (-not (Test-Path $EXPLORER_PARENT)) {
        New-Item -ItemType Directory -Force -Path $EXPLORER_PARENT | Out-Null
    }
    
    # Recreate an entirely empty directory structure
    New-Item -ItemType Directory -Force -Path $EXPLORER_DB_DIR | Out-Null
    
    Write-Host "  Explorer database directory completely reset" -ForegroundColor Yellow
}

# Step 3.2: Clean up shared_models directory
$SHARED_MODELS_DIR = "$DOCKER_DIR\shared_models"
if (Test-Path $SHARED_MODELS_DIR) {
    Write-Host "  Cleaning shared_models directory..." -ForegroundColor Yellow
    Remove-Item -Path "$SHARED_MODELS_DIR\*" -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 3.3: Clean up crypto-config and channel-artifacts directories
$CLEAN_CRYPTO = Read-Host "Do you want to completely reset crypto materials? This will require regenerating them (y/n)"
if ($CLEAN_CRYPTO -eq "y" -or $CLEAN_CRYPTO -eq "Y") {
    Write-Host "  Removing crypto materials and channel artifacts..." -ForegroundColor Yellow
    Remove-Item -Path $CRYPTO_CONFIG_DIR -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $CHANNEL_ARTIFACTS_DIR -Recurse -Force -ErrorAction SilentlyContinue
    
    # Recreate empty directories
    New-Item -ItemType Directory -Force -Path $CRYPTO_CONFIG_DIR | Out-Null
    New-Item -ItemType Directory -Force -Path $CHANNEL_ARTIFACTS_DIR | Out-Null
}

Write-Host "Directories cleaned up" -ForegroundColor Green
Write-Host

# Step 4: Full Docker cleanup
$FULL_CLEANUP = Read-Host "Do you want to perform a full Docker cleanup (prune unused containers, networks, and volumes)? (y/n)"
if ($FULL_CLEANUP -eq "y" -or $FULL_CLEANUP -eq "Y") {
    Write-Host "Step 4: Performing full Docker cleanup..." -ForegroundColor Cyan
    
    Write-Host "  Pruning containers..." -ForegroundColor Yellow
    docker container prune -f
    
    Write-Host "  Pruning networks..." -ForegroundColor Yellow
    docker network prune -f
    
    Write-Host "  Pruning volumes..." -ForegroundColor Yellow
    docker volume prune -f
    
    Write-Host "Docker environment cleaned" -ForegroundColor Green
    Write-Host
}

Write-Host "========================================================="
Write-Host "   PRIVATE PRISM NETWORK STOPPED SUCCESSFULLY!           "
Write-Host "========================================================="
Write-Host "The environment has been reset and is ready for a fresh start."
Write-Host "To restart the network, run: $PSScriptRoot\start-network.ps1"