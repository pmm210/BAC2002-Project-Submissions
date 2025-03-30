# Use official Golang 1.24.1 image as base
FROM golang:1.24.1 AS builder

# Set working directory inside the container
WORKDIR /app

# Copy Go modules and dependencies
COPY go.mod go.sum ./
RUN go mod tidy

# Copy the source code into the container
COPY . .

# Build the Go application
RUN go build -o hlf-gateway-aggregator hlf-gateway-aggregator.go

# Use a lightweight runtime image
FROM golang:1.24.1
WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/hlf-gateway-aggregator /app/hlf-gateway-aggregator

# Expose API port for aggregator
EXPOSE 8890

# Start the Aggregator Gateway server
CMD ["/app/hlf-gateway-aggregator"]
