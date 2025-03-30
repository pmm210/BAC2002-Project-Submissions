package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/minio/minio-go/v7"
	minioCredentials "github.com/minio/minio-go/v7/pkg/credentials"
)

// MinIO settings
const (
	minioEndpoint = "minio:9000"
	minioBucket   = "models"
)

var minioClient *minio.Client

// Handle model weight uploads (per-bank)
func UploadModel(w http.ResponseWriter, r *http.Request) {
	var request struct {
		RoundID string `json:"roundId"`
		BankID  string `json:"bankId"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	objectName := fmt.Sprintf("%s/%s.weights", request.RoundID, request.BankID)

	presignedURL, err := minioClient.PresignedPutObject(context.Background(), minioBucket, objectName, time.Hour)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to generate upload URL: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"uploadUrl":  presignedURL.String(),
		"objectPath": objectName,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Handle per-bank model weight downloads
func DownloadModel(w http.ResponseWriter, r *http.Request) {
	var request struct {
		RoundID string `json:"roundId"`
		BankID  string `json:"bankId"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	objectName := fmt.Sprintf("%s/%s.weights", request.RoundID, request.BankID)

	presignedURL, err := minioClient.PresignedGetObject(context.Background(), minioBucket, objectName, time.Hour, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to generate download URL: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"downloadUrl": presignedURL.String(),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Handle global model download (NEW FUNCTION)
func DownloadGlobalModel(w http.ResponseWriter, r *http.Request) {
	var request struct {
		RoundID string `json:"roundId"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	objectName := fmt.Sprintf("global/%s.weights", request.RoundID) // Standard global model location

	presignedURL, err := minioClient.PresignedGetObject(context.Background(), minioBucket, objectName, time.Hour, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to generate global model download URL: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"downloadUrl": presignedURL.String(),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Initialize MinIO
func initMinIO() {
	var err error
	maxRetries := 10
	retryInterval := 5 * time.Second

	for i := 0; i < maxRetries; i++ {
		log.Printf("Attempting to connect to MinIO (attempt %d/%d)...", i+1, maxRetries)

		minioClient, err = minio.New(minioEndpoint, &minio.Options{
			Creds:  minioCredentials.NewStaticV4(os.Getenv("MINIO_ACCESS_KEY"), os.Getenv("MINIO_SECRET_KEY"), ""),
			Secure: false,
		})

		if err != nil {
			log.Printf("❌ Failed to initialize MinIO client: %v. Retrying in %s...", err, retryInterval)
			time.Sleep(retryInterval)
			continue
		}

		// Ensure bucket exists
		exists, err := minioClient.BucketExists(context.Background(), minioBucket)
		if err != nil {
			log.Printf("❌ MinIO error checking bucket: %v. Retrying in %s...", err, retryInterval)
			time.Sleep(retryInterval)
			continue
		}

		if !exists {
			err = minioClient.MakeBucket(context.Background(), minioBucket, minio.MakeBucketOptions{})
			if err != nil {
				log.Printf("❌ Failed to create bucket: %v. Retrying in %s...", err, retryInterval)
				time.Sleep(retryInterval)
				continue
			}
			log.Printf("✅ Created MinIO bucket: %s", minioBucket)
		}

		log.Printf("✅ Successfully connected to MinIO!")
		return
	}

	log.Fatalf("❌ Failed to connect to MinIO after %d attempts", maxRetries)
}

func main() {
	// Initialize MinIO client
	initMinIO()

	// Create a new router
	router := http.NewServeMux()

	// Register endpoints
	router.HandleFunc("/upload", UploadModel)
	router.HandleFunc("/download", DownloadModel)
	router.HandleFunc("/download-global", DownloadGlobalModel) // New route

	// Start HTTP server
	log.Println("🚀 Starting MinIO handler server on port 9002...")
	log.Fatal(http.ListenAndServe(":9002", router))
}
