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
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/hyperledger/fabric-gateway/pkg/client"
	"github.com/hyperledger/fabric-gateway/pkg/identity"
	"google.golang.org/grpc"
	grpcCredentials "google.golang.org/grpc/credentials"
)

// Global contract & WebSocket clients
var contract *client.Contract
var network *client.Network
var upgrader = websocket.Upgrader{}
var clients = make(map[*websocket.Conn]bool)

// TrainingRound represents a federated learning round
type TrainingRound struct {
	ID              string   `json:"id"`
	Initiator       string   `json:"initiator"`
	StartTime       int64    `json:"startTime"`
	EndTime         int64    `json:"endTime,omitempty"`
	Status          string   `json:"status"`
	Participants    []string `json:"participants"`
	Description     string   `json:"description"`
	ModelWeightHash string   `json:"modelWeightHash,omitempty"`
	ModelURI        string   `json:"modelURI,omitempty"`
}

// ModelContribution represents a model contribution from a participant
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

// QualityMetrics represents quality metrics for a round
type QualityMetrics struct {
	ID             string             `json:"ID"`
	RoundID        string             `json:"roundID"`
	Timestamp      int64              `json:"timestamp"`
	Threshold      float64            `json:"threshold"`
	AverageQuality float64            `json:"averageQuality"`
	AcceptedCount  int                `json:"acceptedCount"`
	RejectedCount  int                `json:"rejectedCount"`
	Participants   map[string]float64 `json:"participants"` // Participant ID -> quality score
}

// QualityData represents a participant's quality metrics and history
type QualityData struct {
	ParticipantID  string    `json:"participantId"`
	QualityHistory []float64 `json:"qualityHistory"`
	AcceptedCount  int       `json:"acceptedCount"`
	RejectedCount  int       `json:"rejectedCount"`
	LastUpdated    int64     `json:"lastUpdated"`
	CurrentScore   float64   `json:"currentScore"`
}

func setupFabricGateway() {
	log.Println("[API] Initializing Fabric Gateway...")

	// Load environment variables
	peerEndpoint := os.Getenv("PEER_ADDRESS")
	grpcTargetOverride := os.Getenv("GRPC_TARGET_OVERRIDE")
	mspID := os.Getenv("MSP_ID")
	certPath := os.Getenv("CERT_PATH")
	keyPath := os.Getenv("KEY_PATH")
	caCertPath := os.Getenv("CA_PATH")

	// Validate environment variables
	if peerEndpoint == "" || grpcTargetOverride == "" || mspID == "" || certPath == "" || keyPath == "" || caCertPath == "" {
		log.Fatalf("Missing required environment variables. Ensure PEER_ADDRESS, GRPC_TARGET_OVERRIDE, MSP_ID, CERT_PATH, KEY_PATH, and CA_PATH are set.")
	}

	// Load certificate files dynamically
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

	// Set up gRPC connection with TLS credentials
	creds := grpcCredentials.NewClientTLSFromCert(certPool, grpcTargetOverride) // Ensure TLS validation passes
	conn, err := grpc.Dial(peerEndpoint, grpc.WithTransportCredentials(creds))
	if err != nil {
		log.Fatalf("Failed to connect to peer: %v", err)
	}

	// Load and parse identity
	cert, err := identity.CertificateFromPEM(certBytes)
	if err != nil {
		log.Fatalf("Failed to parse certificate: %v", err)
	}
	id, err := identity.NewX509Identity(mspID, cert)
	if err != nil {
		log.Fatalf("Failed to create identity: %v", err)
	}

	// Load private key and create signer
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

	// Store network globally
	network = gateway.GetNetwork("hlftffv1")
	contract = network.GetContract("asset-transfer")

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

// Listen for Fabric Events
func listenForFabricEvents() {
	log.Println("Listening for Fabric events...")

	events, err := network.ChaincodeEvents(context.Background(), "asset-transfer")
	if err != nil {
		log.Fatalf("Failed to subscribe to chaincode events: %v", err)
	}

	for event := range events {
		handleFabricEvent(event)
	}
}

// Handle Fabric Events
func handleFabricEvent(event *client.ChaincodeEvent) {
	log.Printf("Fabric Event: %s - %s", event.EventName, string(event.Payload))

	message := map[string]string{
		"event": event.EventName,
		"data":  string(event.Payload),
	}

	msgJSON, _ := json.Marshal(message)

	// Send WebSocket event only to the correct client
	broadcastToOwnClient(msgJSON)
}

func broadcastToOwnClient(msg []byte) {
	for client := range clients {
		err := client.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			log.Println("WebSocket Send Error:", err)
			client.Close()
			delete(clients, client)
		}
	}
}

// WebSocket Connection Handler
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

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Println("WebSocket client disconnected")
			delete(clients, conn)
			break
		}
	}
}

// Broadcast Message to WebSocket Clients
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

func GetActiveRounds(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Get Active Rounds")

	result, err := contract.EvaluateTransaction("GetAllTrainingRounds")
	if err != nil {
		log.Printf("Failed to query rounds: %v", err)
		http.Error(w, fmt.Sprintf("Failed to query training rounds: %v", err), http.StatusInternalServerError)
		return
	}

	var allRounds []*TrainingRound
	err = json.Unmarshal(result, &allRounds)
	if err != nil {
		log.Printf("Failed to parse rounds: %v", err)
		http.Error(w, "Failed to parse training rounds", http.StatusInternalServerError)
		return
	}

	var activeRounds []*TrainingRound
	for _, round := range allRounds {
		if round.Status != "COMPLETED" {
			activeRounds = append(activeRounds, round)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activeRounds)
}

func StartTrainingRound(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Start Training Round")

	var request struct {
		ID          string `json:"id"`
		Initiator   string `json:"initiator"`
		Description string `json:"description"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		log.Printf("Failed to parse request: %v", err)
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	_, err = contract.SubmitTransaction("CreateTrainingRound", request.ID, request.Initiator, request.Description)
	if err != nil {
		log.Printf("Failed to start round: %v", err)
		http.Error(w, fmt.Sprintf("Failed to start training round: %v", err), http.StatusInternalServerError)
		return
	}

	roundResult, err := contract.EvaluateTransaction("GetTrainingRound", request.ID)
	if err != nil {
		log.Printf("Failed to get created round: %v", err)
		http.Error(w, "Round created but failed to retrieve details", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	w.Write(roundResult)
}

func OptInBank(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Bank Opt-In")

	var request struct {
		RoundID string `json:"roundId"`
		BankID  string `json:"bankId"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		log.Printf("Failed to parse request: %v", err)
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	roundResult, err := contract.EvaluateTransaction("GetTrainingRound", request.RoundID)
	if err != nil {
		log.Printf("Failed to get round: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get training round: %v", err), http.StatusInternalServerError)
		return
	}

	var round TrainingRound
	err = json.Unmarshal(roundResult, &round)
	if err != nil {
		log.Printf("Failed to parse round data: %v", err)
		http.Error(w, "Failed to parse round data", http.StatusInternalServerError)
		return
	}

	round.Participants = append(round.Participants, request.BankID)
	roundJSON, _ := json.Marshal(round.Participants)
	_, err = contract.SubmitTransaction("UpdateRoundParticipants", request.RoundID, string(roundJSON))

	if err != nil {
		log.Printf("Failed to update round participants: %v", err)
		http.Error(w, fmt.Sprintf("Failed to opt in: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Successfully opted in to training round",
	})
}

func OptOutBank(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Bank Opt-Out")

	var request struct {
		RoundID string `json:"roundId"`
		BankID  string `json:"bankId"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		log.Printf("Failed to parse request: %v", err)
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	roundResult, err := contract.EvaluateTransaction("GetTrainingRound", request.RoundID)
	if err != nil {
		log.Printf("Failed to get round: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get training round: %v", err), http.StatusInternalServerError)
		return
	}

	var round TrainingRound
	err = json.Unmarshal(roundResult, &round)
	if err != nil {
		log.Printf("Failed to parse round data: %v", err)
		http.Error(w, "Failed to parse round data", http.StatusInternalServerError)
		return
	}

	var updatedParticipants []string
	for _, participant := range round.Participants {
		if participant != request.BankID {
			updatedParticipants = append(updatedParticipants, participant)
		}
	}

	updatedParticipantsJSON, _ := json.Marshal(updatedParticipants)
	_, err = contract.SubmitTransaction("UpdateRoundParticipants", request.RoundID, string(updatedParticipantsJSON))

	if err != nil {
		log.Printf("Failed to update round participants: %v", err)
		http.Error(w, fmt.Sprintf("Failed to opt out: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Successfully opted out from training round",
	})
}

func SubmitContribution(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Submit Model Contribution")

	var request ModelContribution
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		log.Printf("Failed to parse request: %v", err)
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	// Convert accuracyMetrics to JSON string
	accuracyJSON, err := json.Marshal(request.AccuracyMetrics)
	if err != nil {
		log.Printf("Failed to marshal accuracy metrics: %v", err)
		http.Error(w, "Invalid accuracy metrics", http.StatusBadRequest)
		return
	}
	
	// Convert trainingStats to JSON string
	statsJSON, err := json.Marshal(request.TrainingStats)
	if err != nil {
		log.Printf("Failed to marshal training stats: %v", err)
		http.Error(w, "Invalid training stats", http.StatusBadRequest)
		return
	}

	_, err = contract.SubmitTransaction("RecordModelContribution", 
		request.ID, 
		request.RoundID, 
		request.ParticipantID, 
		request.WeightHash, 
		request.ModelURI, 
		string(accuracyJSON), 
		string(statsJSON))

	if err != nil {
		log.Printf("Failed to submit contribution: %v", err)
		http.Error(w, fmt.Sprintf("Failed to submit model contribution: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
		"id":     request.ID,
	})
}

func SubmitFinalModel(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Submit Final Model")

	var request struct {
		RoundID    string `json:"roundId"`
		WeightHash string `json:"weightHash"`
		ModelURI   string `json:"modelURI"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		log.Printf("Failed to parse request: %v", err)
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	_, err = contract.SubmitTransaction("RecordAggregatedModel", request.RoundID, request.WeightHash, request.ModelURI)
	if err != nil {
		log.Printf("Failed to submit final model: %v", err)
		http.Error(w, fmt.Sprintf("Failed to submit final model: %v", err), http.StatusInternalServerError)
		return
	}

	roundResult, err := contract.EvaluateTransaction("GetTrainingRound", request.RoundID)
	if err != nil {
		log.Printf("Failed to get updated round: %v", err)
		http.Error(w, "Final model submitted but failed to retrieve round details", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(roundResult)
}

// GetModelContribution retrieves details about a specific model contribution
func GetModelContribution(w http.ResponseWriter, r *http.Request) {
    log.Println("API: Get Model Contribution")

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

// GetParticipantReputation gets reputation data for a specific participant
func GetParticipantReputation(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    participantID := vars["participantId"]

    if participantID == "" {
        participantID = r.URL.Query().Get("id")
        
        if participantID == "" {
            // Get bank ID from MSP ID
            mspID := os.Getenv("MSP_ID")
            if mspID != "" {
                // Extract bank identifier from MSP ID (e.g., "DBSMSP" -> "dbs")
                participantID = strings.ToLower(strings.TrimSuffix(mspID, "MSP"))
            }
        }
    }

    if participantID == "" {
        http.Error(w, "Participant ID required", http.StatusBadRequest)
        return
    }

    result, err := contract.EvaluateTransaction("GetParticipantReputation", participantID)
    if err != nil {
        log.Printf("Failed to get reputation: %v", err)
        
        // If no data found, return empty data with status 200
        if strings.Contains(err.Error(), "no reputation data found") {
            record := ReputationRecord{
                ParticipantID: participantID,
                Score: 0.5,
                LastUpdated: time.Now().Unix(),
                History: []ReputationChange{},
            }
            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(record)
            return
        }
        
        http.Error(w, fmt.Sprintf("Failed to get reputation: %v", err), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    w.Write(result)
}

// GetRoundQualityMetrics gets quality metrics for a specific round
func GetRoundQualityMetrics(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    roundID := vars["roundId"]

    if roundID == "" {
        roundID = r.URL.Query().Get("id")
        if roundID == "" {
            http.Error(w, "Round ID required", http.StatusBadRequest)
            return
        }
    }

    result, err := contract.EvaluateTransaction("GetQualityMetricsForRound", roundID)
    if err != nil {
        log.Printf("Failed to get quality metrics: %v", err)
        http.Error(w, fmt.Sprintf("Failed to get quality metrics: %v", err), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    w.Write(result)
}

// GetQualityMetricsForParticipant gets quality metrics for a specific participant
func GetQualityMetricsForParticipant(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    participantID := vars["participantId"]

    if participantID == "" {
        participantID = r.URL.Query().Get("id")
        
        if participantID == "" {
            // Get bank ID from MSP ID
            mspID := os.Getenv("MSP_ID")
            if mspID != "" {
                // Extract bank identifier from MSP ID (e.g., "DBSMSP" -> "dbs")
                participantID = strings.ToLower(strings.TrimSuffix(mspID, "MSP"))
            }
        }
    }

    if participantID == "" {
        http.Error(w, "Participant ID required", http.StatusBadRequest)
        return
    }

    // Get participant quality history
    result, err := contract.EvaluateTransaction("GetParticipantQualityData", participantID)
    if err != nil {
        log.Printf("Failed to get quality data: %v", err)
        
        // If no data found, return empty data with status 200
        if strings.Contains(err.Error(), "no quality data found") {
            response := map[string]interface{}{
                "participantID": participantID,
                "qualityHistory": []float64{},
                "acceptedCount": 0,
                "rejectedCount": 0,
                "lastUpdated": time.Now().Unix(),
                "currentScore": 0.0,
            }
            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(response)
            return
        }
        
        http.Error(w, fmt.Sprintf("Failed to get quality data: %v", err), http.StatusInternalServerError)
        return
    }

    // Parse the result
    var qualityData struct {
        ParticipantID  string    `json:"participantID"`
        QualityHistory []float64 `json:"qualityHistory"`
        AcceptedCount  int       `json:"acceptedCount"`
        RejectedCount  int       `json:"rejectedCount"`
        LastUpdated    int64     `json:"lastUpdated"`
    }

    err = json.Unmarshal(result, &qualityData)
    if err != nil {
        log.Printf("Failed to parse quality data: %v", err)
        http.Error(w, "Failed to parse quality data", http.StatusInternalServerError)
        return
    }

    // Calculate current quality score (average of last 3 if available)
    var currentScore float64
    if len(qualityData.QualityHistory) > 0 {
        // Get up to the last 3 scores
        startIdx := len(qualityData.QualityHistory) - 3
        if startIdx < 0 {
            startIdx = 0
        }
        recentScores := qualityData.QualityHistory[startIdx:]
        
        // Calculate average
        sum := 0.0
        for _, score := range recentScores {
            sum += score
        }
        currentScore = sum / float64(len(recentScores))
    }

    // Create response with current score added
    response := map[string]interface{}{
        "participantID":  qualityData.ParticipantID,
        "qualityHistory": qualityData.QualityHistory,
        "acceptedCount":  qualityData.AcceptedCount,
        "rejectedCount":  qualityData.RejectedCount,
        "lastUpdated":    qualityData.LastUpdated,
        "currentScore":   currentScore,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func main() {
    // Initialize Fabric connection
    setupFabricGateway()

    // Create router
    router := mux.NewRouter()

    // Add WebSocket endpoint
    router.HandleFunc("/ws", webSocketHandler)

    // Existing REST API endpoints
    router.HandleFunc("/rounds/active", GetActiveRounds).Methods("GET")
    router.HandleFunc("/rounds/start", StartTrainingRound).Methods("POST")
    router.HandleFunc("/banks/opt-in", OptInBank).Methods("POST")
    router.HandleFunc("/banks/opt-out", OptOutBank).Methods("POST")
    router.HandleFunc("/models/contribution", SubmitContribution).Methods("POST")
    router.HandleFunc("/models/final", SubmitFinalModel).Methods("POST")

    // Add endpoints for model contribution retrieval
    router.HandleFunc("/models/contribution", GetModelContribution).Methods("GET")

    // Add endpoints for reputation and quality
    router.HandleFunc("/reputation/{participantId}", GetParticipantReputation).Methods("GET")
    router.HandleFunc("/reputation", GetParticipantReputation).Methods("GET")
    
    router.HandleFunc("/quality/round/{roundId}", GetRoundQualityMetrics).Methods("GET")
    router.HandleFunc("/quality/round", GetRoundQualityMetrics).Methods("GET")
    
    router.HandleFunc("/quality/participant/{participantId}", GetQualityMetricsForParticipant).Methods("GET")
    router.HandleFunc("/quality/participant", GetQualityMetricsForParticipant).Methods("GET")

    // Start the API server
    fmt.Println("Starting API server on port 8888...")
    log.Fatal(http.ListenAndServe(":8888", router))
}