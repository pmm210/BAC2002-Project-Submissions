package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ReputationRecord represents a participant's reputation data
type ReputationRecord struct {
	ID            string  `json:"ID"`
	ParticipantID string  `json:"participantID"`
	Score         float64 `json:"score"`
	LastUpdated   int64   `json:"lastUpdated"`
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

// GetParticipantReputation retrieves the reputation score for a participant
func (s *SmartContract) GetParticipantReputation(ctx contractapi.TransactionContextInterface, participantID string) (*ReputationRecord, error) {
	reputationJSON, err := ctx.GetStub().GetState("REPUTATION_" + participantID)
	if err != nil {
		return nil, fmt.Errorf("failed to read reputation from world state: %v", err)
	}
	if reputationJSON == nil {
		// Initialize new reputation record
		initialScore := 0.5 // Default initial reputation
		record := ReputationRecord{
			ID:            "REPUTATION_" + participantID,
			ParticipantID: participantID,
			Score:         initialScore,
			LastUpdated:   time.Now().Unix(),
			History:       []ReputationChange{},
		}
		
		recordJSON, err := json.Marshal(record)
		if err != nil {
			return nil, fmt.Errorf("failed to create initial reputation record: %v", err)
		}
		
		err = ctx.GetStub().PutState("REPUTATION_"+participantID, recordJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to store initial reputation record: %v", err)
		}
		
		return &record, nil
	}

	var reputationRecord ReputationRecord
	err = json.Unmarshal(reputationJSON, &reputationRecord)
	if err != nil {
		return nil, fmt.Errorf("failed to parse reputation data: %v", err)
	}

	return &reputationRecord, nil
}

// UpdateParticipantReputation updates the reputation score for a participant
func (s *SmartContract) UpdateParticipantReputation(ctx contractapi.TransactionContextInterface, 
	participantID string, newScore float64, reason string, roundID string) error {
	
	reputationRecord, err := s.GetParticipantReputation(ctx, participantID)
	if err != nil {
		return err
	}

	// Create a reputation change record
	change := ReputationChange{
		Timestamp: time.Now().Unix(),
		OldScore:  reputationRecord.Score,
		NewScore:  newScore,
		Reason:    reason,
		RoundID:   roundID,
	}
	
	// Add change to history
	reputationRecord.History = append(reputationRecord.History, change)
	
	// Keep only last 10 changes in history
	if len(reputationRecord.History) > 10 {
		reputationRecord.History = reputationRecord.History[len(reputationRecord.History)-10:]
	}
	
	// Update the score and timestamp
	reputationRecord.Score = newScore
	reputationRecord.LastUpdated = time.Now().Unix()
	
	// Save updated record
	recordJSON, err := json.Marshal(reputationRecord)
	if err != nil {
		return fmt.Errorf("failed to marshal reputation record: %v", err)
	}
	
	err = ctx.GetStub().PutState("REPUTATION_"+participantID, recordJSON)
	if err != nil {
		return fmt.Errorf("failed to update reputation record: %v", err)
	}
	
	// Emit REPUTATION_UPDATED event
	eventPayload := map[string]interface{}{
		"participant_id": participantID,
		"old_score":      change.OldScore,
		"new_score":      change.NewScore,
		"reason":         change.Reason,
		"round_id":       change.RoundID,
	}

	eventJSON, _ := json.Marshal(eventPayload)
	err = ctx.GetStub().SetEvent("REPUTATION_UPDATED", eventJSON)
	if err != nil {
		return fmt.Errorf("failed to emit REPUTATION_UPDATED event: %v", err)
	}
	
	return nil
}

// GetAllReputations retrieves reputation records for all participants
func (s *SmartContract) GetAllReputations(ctx contractapi.TransactionContextInterface) ([]*ReputationRecord, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("REPUTATION_", "REPUTATION_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var records []*ReputationRecord
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var record ReputationRecord
		err = json.Unmarshal(queryResponse.Value, &record)
		if err != nil {
			continue
		}

		records = append(records, &record)
	}

	return records, nil
}