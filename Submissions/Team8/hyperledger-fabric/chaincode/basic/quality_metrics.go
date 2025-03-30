package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// QualityMetrics represents metrics for dynamic threshold adjustment
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

// ParticipantQualityData records a participant's quality metrics over time
type ParticipantQualityData struct {
	ID             string    `json:"ID"`
	ParticipantID  string    `json:"participantID"`
	QualityHistory []float64 `json:"qualityHistory"`
	AcceptedCount  int       `json:"acceptedCount"`
	RejectedCount  int       `json:"rejectedCount"`
	LastUpdated    int64     `json:"lastUpdated"`
}

// RecordQualityMetrics saves quality metrics for a training round
func (s *SmartContract) RecordQualityMetrics(ctx contractapi.TransactionContextInterface, id string, roundID string,
	threshold float64, averageQuality float64, acceptedCount int, rejectedCount int, participantDataJSON string) error {

	// Parse participant quality data
	var participantData map[string]float64
	err := json.Unmarshal([]byte(participantDataJSON), &participantData)
	if err != nil {
		return fmt.Errorf("failed to parse participant data: %v", err)
	}

	// Create metrics record
	metrics := QualityMetrics{
		ID:             id,
		RoundID:        roundID,
		Timestamp:      time.Now().Unix(),
		Threshold:      threshold,
		AverageQuality: averageQuality,
		AcceptedCount:  acceptedCount,
		RejectedCount:  rejectedCount,
		Participants:   participantData,
	}

	// Save to state
	metricsJSON, err := json.Marshal(metrics)
	if err != nil {
		return fmt.Errorf("failed to marshal metrics: %v", err)
	}

	err = ctx.GetStub().PutState("QUALITY_"+id, metricsJSON)
	if err != nil {
		return fmt.Errorf("failed to store quality metrics: %v", err)
	}

	// Update quality history for each participant
	for participantID, qualityScore := range participantData {
		err = s.updateParticipantQualityHistory(ctx, participantID, qualityScore, qualityScore >= threshold)
		if err != nil {
			return fmt.Errorf("failed to update participant history: %v", err)
		}
	}

	// Update training round with quality metadata
	roundMetadata := map[string]interface{}{
		"quality_threshold": threshold,
		"average_quality":   averageQuality,
		"accepted_count":    acceptedCount,
		"rejected_count":    rejectedCount,
	}

	roundMetadataJSON, err := json.Marshal(roundMetadata)
	if err != nil {
		return fmt.Errorf("failed to marshal round metadata: %v", err)
	}

	// Assuming we have a method to update round metadata
	_, err = ctx.GetStub().GetState("ROUND_" + roundID)
	if err != nil {
		return fmt.Errorf("failed to get round: %v", err)
	}

	// Store quality metadata for the round
	err = ctx.GetStub().PutState("QUALITY_ROUND_"+roundID, roundMetadataJSON)
	if err != nil {
		return fmt.Errorf("failed to store round quality metadata: %v", err)
	}

	// Emit QUALITY_RECORDED event
	eventPayload := map[string]interface{}{
		"round_id":        roundID,
		"threshold":       threshold,
		"average_quality": averageQuality,
		"accepted_count":  acceptedCount,
		"rejected_count":  rejectedCount,
	}

	eventJSON, _ := json.Marshal(eventPayload)
	err = ctx.GetStub().SetEvent("QUALITY_RECORDED", eventJSON)
	if err != nil {
		return fmt.Errorf("failed to emit QUALITY_RECORDED event: %v", err)
	}

	return nil
}

// updateParticipantQualityHistory updates quality history for a participant
func (s *SmartContract) updateParticipantQualityHistory(ctx contractapi.TransactionContextInterface,
	participantID string, qualityScore float64, accepted bool) error {

	// Get existing quality history
	qualityDataJSON, err := ctx.GetStub().GetState("PARTICIPANT_QUALITY_" + participantID)

	var qualityData ParticipantQualityData
	if err == nil && qualityDataJSON != nil {
		// Parse existing data
		err = json.Unmarshal(qualityDataJSON, &qualityData)
		if err != nil {
			return fmt.Errorf("failed to parse quality data: %v", err)
		}
	} else {
		// Create new quality data
		qualityData = ParticipantQualityData{
			ID:             "QUALITY_" + participantID,
			ParticipantID:  participantID,
			QualityHistory: []float64{},
			AcceptedCount:  0,
			RejectedCount:  0,
		}
	}

	// Update quality history (keep last 10 scores)
	qualityData.QualityHistory = append(qualityData.QualityHistory, qualityScore)
	if len(qualityData.QualityHistory) > 10 {
		qualityData.QualityHistory = qualityData.QualityHistory[1:]
	}

	// Update accepted/rejected counts
	if accepted {
		qualityData.AcceptedCount++
	} else {
		qualityData.RejectedCount++
	}

	qualityData.LastUpdated = time.Now().Unix()

	// Save updated data
	updatedJSON, err := json.Marshal(qualityData)
	if err != nil {
		return fmt.Errorf("failed to marshal updated quality data: %v", err)
	}

	err = ctx.GetStub().PutState("PARTICIPANT_QUALITY_"+participantID, updatedJSON)
	if err != nil {
		return fmt.Errorf("failed to store participant quality data: %v", err)
	}

	return nil
}

// GetQualityMetricsForRound retrieves quality metrics for a specific round
func (s *SmartContract) GetQualityMetricsForRound(ctx contractapi.TransactionContextInterface, roundID string) (*QualityMetrics, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("QUALITY_", "QUALITY_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var metrics QualityMetrics
		err = json.Unmarshal(queryResponse.Value, &metrics)
		if err != nil {
			continue
		}

		if metrics.RoundID == roundID {
			return &metrics, nil
		}
	}

	return nil, fmt.Errorf("no quality metrics found for round %s", roundID)
}

// GetParticipantQualityData retrieves quality history for a participant
func (s *SmartContract) GetParticipantQualityData(ctx contractapi.TransactionContextInterface, participantID string) (*ParticipantQualityData, error) {
	qualityDataJSON, err := ctx.GetStub().GetState("PARTICIPANT_QUALITY_" + participantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get participant quality data: %v", err)
	}
	if qualityDataJSON == nil {
		return nil, fmt.Errorf("no quality data found for participant %s", participantID)
	}

	var qualityData ParticipantQualityData
	err = json.Unmarshal(qualityDataJSON, &qualityData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse quality data: %v", err)
	}

	return &qualityData, nil
}