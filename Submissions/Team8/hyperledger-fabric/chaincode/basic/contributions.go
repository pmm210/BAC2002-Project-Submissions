package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// RecordModelContribution records a model contribution from a participant
func (s *SmartContract) RecordModelContribution(ctx contractapi.TransactionContextInterface, id string, roundID string, 
	participantID string, weightHash string, modelURI string, 
	accuracyJSON string, statsJSON string) error {

	// Check if round exists
	_, err := s.GetTrainingRound(ctx, roundID)
	if err != nil {
		return err
	}

	// Parse accuracy metrics
	var accuracyMetrics map[string]float64
	err = json.Unmarshal([]byte(accuracyJSON), &accuracyMetrics)
	if err != nil {
		return fmt.Errorf("failed to parse accuracy metrics: %v", err)
	}

	// Parse training stats
	var trainingStats map[string]string
	err = json.Unmarshal([]byte(statsJSON), &trainingStats)
		if err != nil {
	return fmt.Errorf("failed to parse training stats: %v", err)
	}

	contribution := ModelContribution{
		ID:              id,
		RoundID:         roundID,
		ParticipantID:   participantID,
		SubmittedAt:     time.Now().Unix(),
		WeightHash:      weightHash,
		ModelURI:        modelURI,
		AccuracyMetrics: accuracyMetrics,
		TrainingStats:   trainingStats,
	}

	contributionJSON, err := json.Marshal(contribution)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState("CONTRIBUTION_"+id, contributionJSON)
	if err != nil {
		return err
	}

	// Emit MODEL_UPLOADED event
	eventPayload := map[string]string{
		"round_id": roundID,
		"bank_id": participantID,
		"weight_hash": weightHash,
		"model_uri": modelURI,
	}

	eventJSON, _ := json.Marshal(eventPayload)
	err = ctx.GetStub().SetEvent("MODEL_UPLOADED", eventJSON)
	if err != nil {
		return fmt.Errorf("failed to emit MODEL_UPLOADED event: %v", err)
	}

	return nil
}

// RecordAggregatedModel records the final aggregated model for a round
func (s *SmartContract) RecordAggregatedModel(ctx contractapi.TransactionContextInterface, roundID string, 
	weightHash string, modelURI string) error {
	round, err := s.GetTrainingRound(ctx, roundID)
	if err != nil {
		return err
	}

	round.ModelWeightHash = weightHash
	round.ModelURI = modelURI
	round.Status = "COMPLETED"
	round.EndTime = time.Now().Unix()

	roundJSON, err := json.Marshal(round)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState("ROUND_"+roundID, roundJSON)
	if err != nil {
		return err
	}

	// Emit AGGREGATED_MODEL_SUBMITTED event
	eventPayload := map[string]string{
		"round_id": roundID,
		"weight_hash": weightHash,
		"model_uri": modelURI,
	}

	eventJSON, _ := json.Marshal(eventPayload)
	err = ctx.GetStub().SetEvent("AGGREGATED_MODEL_SUBMITTED", eventJSON)
	if err != nil {
		return fmt.Errorf("failed to emit AGGREGATED_MODEL_SUBMITTED event: %v", err)
	}

	return nil
}


// GetContributionsByRound returns all model contributions for a specific round
func (s *SmartContract) GetContributionsByRound(ctx contractapi.TransactionContextInterface, roundID string) ([]*ModelContribution, error) {
	// This is not efficient but works for our demo - in production you'd want to use a composite key
	resultsIterator, err := ctx.GetStub().GetStateByRange("CONTRIBUTION_", "CONTRIBUTION_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var contributions []*ModelContribution
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var contribution ModelContribution
		err = json.Unmarshal(queryResponse.Value, &contribution)
		if err != nil {
			return nil, err
		}

		if contribution.RoundID == roundID {
			contributions = append(contributions, &contribution)
		}
	}

	return contributions, nil
}