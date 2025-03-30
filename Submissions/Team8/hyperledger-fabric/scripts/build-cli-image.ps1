# Build the custom CLI container image
# Updated for private-prism directory structure

# Set base directory paths
$BASE_DIR = "$PSScriptRoot\..\.."
$DOCKER_DIR = "$BASE_DIR\docker\network"

# Build the Docker image from the Dockerfile in the docker/network directory
Write-Host "Building CLI container with Go support..." -ForegroundColor Cyan
docker build -f $DOCKER_DIR/Dockerfile.cli -t fabric-tools-with-go:latest $DOCKER_DIR

Write-Host "CLI container image built successfully!" -ForegroundColor Green