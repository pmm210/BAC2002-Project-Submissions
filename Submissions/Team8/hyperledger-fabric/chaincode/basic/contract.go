package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing FL training rounds
type SmartContract struct {
	contractapi.Contract
}

// InitLedger adds base data to the ledger
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	// Add dummy assets for backward compatibility
	assets := []Asset{
		{ID: "asset1", Color: "blue", Size: 5, Owner: "Tomoko", AppraisedValue: 300},
		{ID: "asset2", Color: "red", Size: 5, Owner: "Brad", AppraisedValue: 400},
	}

	for _, asset := range assets {
		assetJSON, err := json.Marshal(asset)
		if err != nil {
			return err
		}

		err = ctx.GetStub().PutState(asset.ID, assetJSON)
		if err != nil {
			return fmt.Errorf("failed to put to world state: %v", err)
		}
	}

	// Add a demo training round
	round := TrainingRound{
		ID:           "round0",
		Initiator:    "system",
		StartTime:    time.Now().Unix(),
		Status:       "INITIATED",
		Participants: []string{},
		Description:  "Initial demo training round",
	}

	roundJSON, err := json.Marshal(round)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState("ROUND_round0", roundJSON)
	if err != nil {
		return fmt.Errorf("failed to put demo round to world state: %v", err)
	}

	// Log a system initialization event
	initEvent := Event{
		ID:          "event0",
		EventType:   "SYSTEM_INIT",
		Timestamp:   time.Now().Unix(),
		ActorID:     "system",
		Description: "Federated Learning chaincode initialized",
	}

	eventJSON, err := json.Marshal(initEvent)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState("EVENT_event0", eventJSON)
	if err != nil {
		return fmt.Errorf("failed to put init event to world state: %v", err)
	}

	return nil
}