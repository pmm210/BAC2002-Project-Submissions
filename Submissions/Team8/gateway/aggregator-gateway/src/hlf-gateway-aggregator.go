package main

import (
	"context"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/hyperledger/fabric-gateway/pkg/client"
	"github.com/hyperledger/fabric-gateway/pkg/identity"
	"google.golang.org/grpc"
	grpcCredentials "google.golang.org/grpc/credentials"
)

var (
	contract      *client.Contract
	network       *client.Network
	upgrader      = websocket.Upgrader{}
	clients       = make(map[*websocket.Conn]bool)
	
	// Track active rounds, their participants, and submissions
	activeRounds     = make(map[string]*RoundInfo)
	activeRoundsMutex sync.Mutex
)

// RoundInfo tracks information about a training round
type RoundInfo struct {
	RoundID           string            // The round identifier
	ExpectedParticipants []string       // List of participants expected to submit models
	Submissions       map[string]string // Map of participant to model URI
}

// ModelUploadEvent represents the data from a MODEL_UPLOADED event
type ModelUploadEvent struct {
	RoundID    string `json:"round_id"`
	BankID     string `json:"bank_id"`
	WeightHash string `json:"weight_hash"`
	ModelURI   string `json:"model_uri"`
}

// RoundStartedEvent represents the data from a ROUND_STARTED event
type RoundStartedEvent struct {
	RoundID     string `json:"round_id"`
	Initiator   string `json:"initiator"`
	Description string `json:"description"`
}

// ReputationRecord represents a participant's reputation data from the blockchain
type ReputationRecord struct {
	ParticipantID string    `json:"participantID"`
	Score         float64   `json:"score"`
	LastUpdated   int64     `json:"lastUpdated"`
	History       []ReputationChange `json:"history"`
}

// ReputationChange represents a change in reputation
type ReputationChange struct {
	Timestamp int64   `json:"timestamp"`
	OldScore  float64 `json:"oldScore"`
	NewScore  float64 `json:"newScore"`
	Reason    string  `json:"reason"`
	RoundID   string  `json:"roundID"`
}

// ModelContribution represents a model contribution record
type ModelContribution struct {
    ID              string             `json:"id"`
    RoundID         string             `json:"roundID"`
    ParticipantID   string             `json:"participantID"`
    SubmittedAt     int64              `json:"submittedAt"`
    WeightHash      string             `json:"weightHash"`
    ModelURI        string             `json:"modelURI"`
    AccuracyMetrics map[string]interface{} `json:"accuracyMetrics"`
    TrainingStats   map[string]string  `json:"trainingStats"`
}

func setupFabricGateway() {
	log.Println("[Aggregator] Initializing Fabric Gateway...")

	peerEndpoint := os.Getenv("PEER_ADDRESS")
	grpcTargetOverride := os.Getenv("GRPC_TARGET_OVERRIDE")
	mspID := os.Getenv("MSP_ID")
	certPath := os.Getenv("CERT_PATH")
	keyPath := os.Getenv("KEY_PATH")
	caCertPath := os.Getenv("CA_PATH")

	if peerEndpoint == "" || mspID == "" || certPath == "" || keyPath == "" || caCertPath == "" {
		log.Fatalf("Missing required environment variables.")
	}

	certBytes, err := os.ReadFile(certPath)
	if err != nil {
		log.Fatalf("Failed to read certificate file: %v", err)
	}

	caCertBytes, err := os.ReadFile(caCertPath)
	if err != nil {
		log.Fatalf("Failed to read CA certificate: %v", err)
	}
	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM(caCertBytes) {
		log.Fatalf("Failed to add CA certificate to pool")
	}

	creds := grpcCredentials.NewClientTLSFromCert(certPool, grpcTargetOverride)
	conn, err := grpc.Dial(peerEndpoint, grpc.WithTransportCredentials(creds))
	if err != nil {
		log.Fatalf("Failed to connect to peer: %v", err)
	}

	cert, err := identity.CertificateFromPEM(certBytes)
	if err != nil {
		log.Fatalf("Failed to parse certificate: %v", err)
	}
	id, err := identity.NewX509Identity(mspID, cert)
	if err != nil {
		log.Fatalf("Failed to create identity: %v", err)
	}

	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		log.Fatalf("Failed to read private key file: %v", err)
	}
	privateKey, err := identity.PrivateKeyFromPEM(keyBytes)
	if err != nil {
		log.Fatalf("Failed to parse private key: %v", err)
	}
	signer, err := identity.NewPrivateKeySign(privateKey)
	if err != nil {
		log.Fatalf("Failed to create signer: %v", err)
	}

	// Get orderer endpoints from environment variable or use default RAFT cluster
	ordererEndpoints := getOrdererEndpoints()
	log.Printf("Using orderer endpoints: %v", ordererEndpoints)

	// Connect to Fabric Gateway with RAFT orderer options
	gateway, err := client.Connect(
		id,
		client.WithSign(signer),
		client.WithClientConnection(conn),
		// Remove the timeout options as they're not available in this version
	)
	if err != nil {
		log.Fatalf("Failed to connect to Fabric Gateway: %v", err)
	}
	
	network = gateway.GetNetwork(os.Getenv("FABRIC_CHANNEL"))
	contract = network.GetContract(os.Getenv("FABRIC_CONTRACT"))

	log.Printf("Successfully connected to Fabric Gateway for MSP: %s on Peer: %s", mspID, peerEndpoint)

	go listenForFabricEvents()
}

// Get orderer endpoints from environment or use default RAFT setup
func getOrdererEndpoints() []string {
	// Try to get from environment variable first
	ordererEndpointsEnv := os.Getenv("ORDERER_ENDPOINTS")
	if ordererEndpointsEnv != "" {
		return strings.Split(ordererEndpointsEnv, ",")
	}
	
	// Default RAFT cluster endpoints
	return []string{
		"orderer1.example.com:7050",
		"orderer2.example.com:7051",
		"orderer3.example.com:7052",
		"orderer4.example.com:7053",
		"orderer5.example.com:7054",
	}
}

func listenForFabricEvents() {
	log.Println("Listening for Fabric events...")
	events, err := network.ChaincodeEvents(context.Background(), os.Getenv("FABRIC_CONTRACT"))
	if err != nil {
		log.Fatalf("Failed to subscribe to chaincode events: %v", err)
	}

	for event := range events {
		handleFabricEvent(event)
	}
}

func handleFabricEvent(event *client.ChaincodeEvent) {
	log.Printf("Fabric Event: %s - %s", event.EventName, string(event.Payload))
	
	switch event.EventName {
	case "ROUND_STARTED":
		handleRoundStarted(event.Payload)
	case "MODEL_UPLOADED":
		handleModelUploaded(event.Payload)
	}
}

func handleRoundStarted(payload []byte) {
	var roundEvent RoundStartedEvent
	if err := json.Unmarshal(payload, &roundEvent); err != nil {
		log.Printf("Failed to parse ROUND_STARTED event: %v", err)
		return
	}

	log.Printf("New training round started: %s", roundEvent.RoundID)
	
	// Query the ledger to get the round details and participants
	result, err := contract.EvaluateTransaction("GetTrainingRound", roundEvent.RoundID)
	if err != nil {
		log.Printf("Failed to query round details: %v", err)
		return
	}

	var roundDetails struct {
		ID           string   `json:"ID"`
		Participants []string `json:"participants"`
	}
	
	if err := json.Unmarshal(result, &roundDetails); err != nil {
		log.Printf("Failed to parse round details: %v", err)
		return
	}

	// If participants list is empty, use a default list of expected banks
	expectedParticipants := roundDetails.Participants
	if len(expectedParticipants) == 0 {
		// Default to 3 major banks if not specified
		expectedParticipants = []string{"dbs", "ing", "ocbc"}
		log.Printf("No participants specified for round %s, using default: %v", roundEvent.RoundID, expectedParticipants)
	}

	// Store round info in our tracking map
	activeRoundsMutex.Lock()
	activeRounds[roundEvent.RoundID] = &RoundInfo{
		RoundID:             roundEvent.RoundID,
		ExpectedParticipants: expectedParticipants,
		Submissions:         make(map[string]string),
	}
	activeRoundsMutex.Unlock()

	log.Printf("Tracking round %s with expected participants: %v", roundEvent.RoundID, expectedParticipants)
}

func handleModelUploaded(payload []byte) {
	var modelEvent ModelUploadEvent
	if err := json.Unmarshal(payload, &modelEvent); err != nil {
		log.Printf("Failed to parse MODEL_UPLOADED event: %v", err)
		return
	}

	roundID := modelEvent.RoundID
	bankID := modelEvent.BankID
	modelURI := modelEvent.ModelURI

	log.Printf("Model uploaded for round %s by %s: %s", roundID, bankID, modelURI)

	activeRoundsMutex.Lock()
	defer activeRoundsMutex.Unlock()

	// Check if we're tracking this round
	roundInfo, exists := activeRounds[roundID]
	if !exists {
		log.Printf("Received model for unknown round %s, querying round details...", roundID)
		
		// Try to get round info from the ledger
		activeRoundsMutex.Unlock() // Unlock during query
		handleRoundStarted([]byte(fmt.Sprintf(`{"round_id":"%s"}`, roundID)))
		activeRoundsMutex.Lock() // Re-lock
		
		// Check again after attempting to load round info
		roundInfo, exists = activeRounds[roundID]
		if !exists {
			log.Printf("Failed to get information for round %s", roundID)
			return
		}
	}

	// Record this submission
	roundInfo.Submissions[bankID] = modelURI

	// Check if all expected participants have submitted
	allSubmitted := true
	for _, participant := range roundInfo.ExpectedParticipants {
		if _, submitted := roundInfo.Submissions[participant]; !submitted {
			allSubmitted = false
			break
		}
	}

	if allSubmitted {
		log.Printf("All expected models received for round %s. Triggering aggregation...", roundID)
		
		// Prepare aggregation request
		submissions := make(map[string]string)
		for participant, uri := range roundInfo.Submissions {
			submissions[participant] = uri
		}
		
		aggregationRequest := map[string]interface{}{
			"event":       "START_AGGREGATION",
			"round_id":    roundID,
			"submissions": submissions,
		}
		
		// Send to Python aggregator
		requestJSON, _ := json.Marshal(aggregationRequest)
		broadcastWebSocketMessage(requestJSON)
		
		// Optional: Remove from active rounds after triggering aggregation
		// delete(activeRounds, roundID)
	} else {
		log.Printf("Waiting for more submissions for round %s (%d/%d received)", 
			roundID, len(roundInfo.Submissions), len(roundInfo.ExpectedParticipants))
	}
}

func submitFinalModelHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var request struct {
        RoundID    string `json:"roundId"`
        ModelURI   string `json:"modelURI"`
        WeightHash string `json:"weightHash"`
        QualityData map[string]interface{} `json:"qualityData"`
    }

    if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    log.Printf("Received final model submission for round %s: %s", request.RoundID, request.ModelURI)

    // Submit the final model to the blockchain
    _, err := contract.SubmitTransaction("RecordAggregatedModel", request.RoundID, request.WeightHash, request.ModelURI)
    if err != nil {
        log.Printf("Failed to submit final model to blockchain: %v", err)
        http.Error(w, fmt.Sprintf("Failed to submit to blockchain: %v", err), http.StatusInternalServerError)
        return
    }

    log.Printf("Final model recorded on blockchain for round %s", request.RoundID)
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Record quality metrics to the blockchain
func recordQualityMetricsHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var request struct {
        RoundID            string                       `json:"round_id"`
        Threshold          float64                      `json:"threshold"`
        AvgQuality         float64                      `json:"avg_quality"`
        AcceptedCount      int                          `json:"accepted_count"`
        RejectedCount      int                          `json:"rejected_count"`
        ParticipantMetrics map[string]map[string]interface{} `json:"participant_metrics"`
    }

    if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    log.Printf("Received quality metrics for round %s: threshold=%.4f, avgQuality=%.4f, accepted=%d, rejected=%d",
        request.RoundID, request.Threshold, request.AvgQuality, request.AcceptedCount, request.RejectedCount)

    // Extract participant quality scores
    participantScores := make(map[string]float64)
    for participantID, metrics := range request.ParticipantMetrics {
        if qualityScore, ok := metrics["quality_score"].(float64); ok {
            participantScores[participantID] = qualityScore
        }
    }

    // Generate a unique ID for this quality metrics record
    qualityID := fmt.Sprintf("qual_%s_%d", request.RoundID, time.Now().UnixNano())
    
    // Convert participant data to JSON
    participantDataJSON, err := json.Marshal(participantScores)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to marshal participant data: %v", err), http.StatusInternalServerError)
        return
    }

    // Submit the quality metrics to the blockchain
    _, err = contract.SubmitTransaction("RecordQualityMetrics", 
        qualityID, 
        request.RoundID, 
        fmt.Sprintf("%f", request.Threshold), 
        fmt.Sprintf("%f", request.AvgQuality), 
        fmt.Sprintf("%d", request.AcceptedCount), 
        fmt.Sprintf("%d", request.RejectedCount), 
        string(participantDataJSON))

    if err != nil {
        log.Printf("Failed to submit quality metrics to blockchain: %v", err)
        http.Error(w, fmt.Sprintf("Failed to submit to blockchain: %v", err), http.StatusInternalServerError)
        return
    }

    log.Printf("Quality metrics recorded on blockchain for round %s", request.RoundID)
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "success", "id": qualityID})
}

// UpdateReputationHandler updates a participant's reputation score
func updateReputationHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var request struct {
        ParticipantID string  `json:"participantId"`
        Score         float64 `json:"score"`
        Reason        string  `json:"reason"`
        RoundID       string  `json:"roundId"`
    }

    if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    log.Printf("Received reputation update for %s: %.2f (round %s, reason: %s)", 
        request.ParticipantID, request.Score, request.RoundID, request.Reason)

    if request.Reason == "" {
        request.Reason = "Model quality evaluation"
    }

    // Submit the reputation update to the blockchain
    _, err := contract.SubmitTransaction("UpdateParticipantReputation", 
        request.ParticipantID, 
        fmt.Sprintf("%f", request.Score), 
        request.Reason,
        request.RoundID)

    if err != nil {
        log.Printf("Failed to update reputation on blockchain: %v", err)
        http.Error(w, fmt.Sprintf("Failed to update reputation: %v", err), http.StatusInternalServerError)
        return
    }

    log.Printf("Reputation updated for %s to %.2f", request.ParticipantID, request.Score)
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// GetReputationHandler retrieves a participant's reputation data
func getReputationHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Get the participant ID from path or query parameter
    vars := mux.Vars(r)
    participantID := vars["participantId"]
    
    if participantID == "" {
        // Try to get from query parameter
        participantID = r.URL.Query().Get("id")
        if participantID == "" {
            http.Error(w, "Participant ID required", http.StatusBadRequest)
            return
        }
    }

    // Query the blockchain for the reputation data
    result, err := contract.EvaluateTransaction("GetParticipantReputation", participantID)
    if err != nil {
        log.Printf("Failed to query reputation: %v", err)
        http.Error(w, fmt.Sprintf("Failed to query reputation: %v", err), http.StatusInternalServerError)
        return
    }

    // Parse and return the reputation data
    var record ReputationRecord
    if err := json.Unmarshal(result, &record); err != nil {
        log.Printf("Failed to parse reputation data: %v", err)
        http.Error(w, "Failed to parse reputation data", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(record)
}

// GetAllReputationsHandler retrieves reputation data for all participants
func getAllReputationsHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Query the blockchain for all reputation data
    result, err := contract.EvaluateTransaction("GetAllReputations")
    if err != nil {
        log.Printf("Failed to query reputations: %v", err)
        http.Error(w, fmt.Sprintf("Failed to query reputations: %v", err), http.StatusInternalServerError)
        return
    }

    // Return the raw data as it's already properly formatted
    w.Header().Set("Content-Type", "application/json")
    w.Write(result)
}

// getModelContributionHandler retrieves model contribution details
func getModelContributionHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Get query parameters
    roundID := r.URL.Query().Get("roundId")
    participantID := r.URL.Query().Get("participantId")
    
    if roundID == "" || participantID == "" {
        http.Error(w, "Missing required parameters: roundId and participantId", http.StatusBadRequest)
        return
    }

    // Get all contributions for this round
    result, err := contract.EvaluateTransaction("GetContributionsByRound", roundID)
    if err != nil {
        log.Printf("Failed to query contributions: %v", err)
        http.Error(w, fmt.Sprintf("Failed to query contributions: %v", err), http.StatusInternalServerError)
        return
    }

    // Parse the contributions
    var contributions []*ModelContribution
    if err := json.Unmarshal(result, &contributions); err != nil {
        log.Printf("Failed to parse contribution data: %v", err)
        http.Error(w, "Failed to parse contribution data", http.StatusInternalServerError)
        return
    }

    // Find the requested contribution
    for _, contribution := range contributions {
        if contribution.ParticipantID == participantID {
            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(contribution)
            return
        }
    }

    http.Error(w, "Contribution not found", http.StatusNotFound)
}

func webSocketHandler(w http.ResponseWriter, r *http.Request) {
	upgrader.CheckOrigin = func(r *http.Request) bool { return true }
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket Upgrade Error: %v", err)
		return
	}
	defer conn.Close()
	clients[conn] = true
	log.Println("WebSocket client connected")
	
	// Handle incoming messages from the Python aggregator
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("WebSocket client disconnected")
			delete(clients, conn)
			break
		}
		
		// Handle responses from aggregator.py if needed
		log.Printf("Received message from aggregator: %s", string(message))
	}
}

func broadcastWebSocketMessage(msg []byte) {
	for client := range clients {
		err := client.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			log.Println("WebSocket Send Error:", err)
			client.Close()
			delete(clients, client)
		}
	}
}

func main() {
    setupFabricGateway()
    router := mux.NewRouter()
    
    // WebSocket endpoint
    router.HandleFunc("/ws", webSocketHandler)

    // Existing endpoints
    router.HandleFunc("/models/final", submitFinalModelHandler)
    router.HandleFunc("/events/quality", recordQualityMetricsHandler)
    
    // Contribution metadata endpoint
    router.HandleFunc("/models/contribution", getModelContributionHandler).Methods("GET")
    
    // New reputation endpoints
    router.HandleFunc("/reputation/update", updateReputationHandler)
    router.HandleFunc("/reputation/{participantId}", getReputationHandler)
    router.HandleFunc("/reputation", getReputationHandler) 
    router.HandleFunc("/reputations", getAllReputationsHandler)

    log.Println("Starting Aggregator Gateway on port 8890...")
    log.Fatal(http.ListenAndServe(":8890", router))
}