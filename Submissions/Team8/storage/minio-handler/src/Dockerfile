FROM golang:1.24.1

WORKDIR /app

# Copy go.mod and go.sum
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY *.go ./

# Build the application
RUN go build -o minio-handler minio-handler.go

# Expose the port the service listens on
EXPOSE 9002

# Command to run when container starts
CMD ["./minio-handler"]