package main

import (
	"encoding/json"
	_ "fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// RecordParticipation records a participant's response to an invitation
func (s *SmartContract) RecordParticipation(ctx contractapi.TransactionContextInterface, id string, roundID string, 
                                           participantID string, invitedAt int64, hasAccepted bool) error {
	// Check if round exists
	_, err := s.GetTrainingRound(ctx, roundID)
	if err != nil {
		return err
	}

	record := ParticipationRecord{
		ID:            id,
		RoundID:       roundID,
		ParticipantID: participantID,
		InvitedAt:     invitedAt,
		RespondedAt:   time.Now().Unix(),
		HasAccepted:   hasAccepted,
	}

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return err
	}

	// Store with prefix
	return ctx.GetStub().PutState("PARTICIPATION_"+id, recordJSON)
}

// GetParticipationRecordsByRound returns all participation records for a specific round
func (s *SmartContract) GetParticipationRecordsByRound(ctx contractapi.TransactionContextInterface, roundID string) ([]*ParticipationRecord, error) {
	// This is not efficient but works for our demo - in production you'd want to use a composite key
	resultsIterator, err := ctx.GetStub().GetStateByRange("PARTICIPATION_", "PARTICIPATION_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var records []*ParticipationRecord
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var record ParticipationRecord
		err = json.Unmarshal(queryResponse.Value, &record)
		if err != nil {
			return nil, err
		}

		if record.RoundID == roundID {
			records = append(records, &record)
		}
	}

	return records, nil
}