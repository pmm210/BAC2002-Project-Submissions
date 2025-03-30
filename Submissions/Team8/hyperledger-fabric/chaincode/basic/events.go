package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// RecordEvent creates a general event record for auditing
func (s *SmartContract) RecordEvent(ctx contractapi.TransactionContextInterface, id string, eventType string, 
                                 actorID string, relatedID string, description string, metadataJSON string) error {
	var metadata map[string]string
	err := json.Unmarshal([]byte(metadataJSON), &metadata)
	if err != nil {
		return fmt.Errorf("failed to parse metadata: %v", err)
	}

	event := Event{
		ID:          id,
		EventType:   eventType,
		Timestamp:   time.Now().Unix(),
		ActorID:     actorID,
		RelatedID:   relatedID,
		Description: description,
		Metadata:    metadata,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState("EVENT_"+id, eventJSON)
}

// GetEvents returns events by type
func (s *SmartContract) GetEvents(ctx contractapi.TransactionContextInterface, eventType string) ([]*Event, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("EVENT_", "EVENT_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var events []*Event
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var event Event
		err = json.Unmarshal(queryResponse.Value, &event)
		if err != nil {
			return nil, err
		}

		if eventType == "" || event.EventType == eventType {
			events = append(events, &event)
		}
	}

	return events, nil
}