package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// CreateTrainingRound starts a new federated learning round
func (s *SmartContract) CreateTrainingRound(ctx contractapi.TransactionContextInterface, id string, initiator string, description string) error {
	exists, err := s.TrainingRoundExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("the training round %s already exists", id)
	}

	round := TrainingRound{
		ID:           id,
		Initiator:    initiator,
		StartTime:    time.Now().Unix(),
		Status:       "INITIATED",
		Participants: []string{},
		Description:  description,
	}

	roundJSON, err := json.Marshal(round)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState("ROUND_"+id, roundJSON)
	if err != nil {
		return err
	}

	// 🔥 Emit ROUND_STARTED event
	eventPayload := map[string]string{
		"round_id": id,
		"initiator": initiator,
		"description": description,
	}
	eventJSON, _ := json.Marshal(eventPayload)
	err = ctx.GetStub().SetEvent("ROUND_STARTED", eventJSON)
	if err != nil {
		return fmt.Errorf("failed to emit ROUND_STARTED event: %v", err)
	}

	return nil
}


// GetTrainingRound returns a training round by ID
func (s *SmartContract) GetTrainingRound(ctx contractapi.TransactionContextInterface, id string) (*TrainingRound, error) {
	roundJSON, err := ctx.GetStub().GetState("ROUND_" + id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if roundJSON == nil {
		return nil, fmt.Errorf("the training round %s does not exist", id)
	}

	var round TrainingRound
	err = json.Unmarshal(roundJSON, &round)
	if err != nil {
		return nil, err
	}

	return &round, nil
}

// UpdateTrainingRoundStatus updates the status of a training round
func (s *SmartContract) UpdateTrainingRoundStatus(ctx contractapi.TransactionContextInterface, id string, status string) error {
	round, err := s.GetTrainingRound(ctx, id)
	if err != nil {
		return err
	}

	round.Status = status
	if status == "COMPLETED" {
		round.EndTime = time.Now().Unix()
	}

	roundJSON, err := json.Marshal(round)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState("ROUND_"+id, roundJSON)
}

// GetAllTrainingRounds returns all training rounds found in world state
func (s *SmartContract) GetAllTrainingRounds(ctx contractapi.TransactionContextInterface) ([]*TrainingRound, error) {
	// Get all keys that start with ROUND_
	resultsIterator, err := ctx.GetStub().GetStateByRange("ROUND_", "ROUND_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var rounds []*TrainingRound
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var round TrainingRound
		err = json.Unmarshal(queryResponse.Value, &round)
		if err != nil {
			return nil, err
		}
		rounds = append(rounds, &round)
	}

	return rounds, nil
}

// TrainingRoundExists returns true when round with given ID exists in world state
func (s *SmartContract) TrainingRoundExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	roundJSON, err := ctx.GetStub().GetState("ROUND_" + id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return roundJSON != nil, nil
}