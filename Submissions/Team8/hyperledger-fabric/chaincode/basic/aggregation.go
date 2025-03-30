package main

import (
	_"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// CheckReadyForAggregation checks if all expected participants have uploaded their models for aggregation
func (s *SmartContract) CheckReadyForAggregation(ctx contractapi.TransactionContextInterface) (map[string]interface{}, error) {
	// Get all active rounds
	rounds, err := s.GetAllTrainingRounds(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get training rounds: %v", err)
	}

	// Find active rounds that might be ready for aggregation
	for _, round := range rounds {
		if round.Status == "INITIATED" || round.Status == "IN_PROGRESS" {
			// Get contributions for this round
			contributions, err := s.GetContributionsByRound(ctx, round.ID)
			if err != nil {
				continue
			}

			// Track participants who have submitted models
			submittedParticipants := make(map[string]bool)
			for _, contribution := range contributions {
				submittedParticipants[contribution.ParticipantID] = true
			}

			// If no participants are explicitly defined for the round,
			// consider it ready if at least 3 participants submitted (for backward compatibility)
			if len(round.Participants) == 0 && len(submittedParticipants) >= 3 {
				response := map[string]interface{}{
					"ready":         true,
					"round_id":      round.ID,
					"uploadedCount": len(submittedParticipants),
					"participants":  mapToSlice(submittedParticipants),
				}
				return response, nil
			}

			// Check if all expected participants have submitted
			allSubmitted := true
			for _, participant := range round.Participants {
				if !submittedParticipants[participant] {
					allSubmitted = false
					break
				}
			}

			// If all expected participants have submitted and there are some participants
			if allSubmitted && len(round.Participants) > 0 {
				response := map[string]interface{}{
					"ready":         true,
					"round_id":      round.ID,
					"uploadedCount": len(submittedParticipants),
					"participants":  round.Participants,
				}
				return response, nil
			}
		}
	}

	// No rounds ready for aggregation
	return map[string]interface{}{
		"ready": false,
	}, nil
}

// GetRoundParticipationStatus checks if all participants have submitted models for a specific round
func (s *SmartContract) GetRoundParticipationStatus(ctx contractapi.TransactionContextInterface, roundID string) (map[string]interface{}, error) {
	// Check if round exists
	round, err := s.GetTrainingRound(ctx, roundID)
	if err != nil {
		return nil, err
	}

	// Get contributions for this round
	contributions, err := s.GetContributionsByRound(ctx, roundID)
	if err != nil {
		return nil, err
	}

	// Track participants who have submitted models
	submittedParticipants := make(map[string]bool)
	for _, contribution := range contributions {
		submittedParticipants[contribution.ParticipantID] = true
	}

	// Check if all expected participants have submitted
	allSubmitted := true
	for _, participant := range round.Participants {
		if !submittedParticipants[participant] {
			allSubmitted = false
			break
		}
	}

	// For backward compatibility, if no participants are defined for the round
	// consider it ready if at least 3 participants submitted
	isReady := false
	if len(round.Participants) == 0 {
		isReady = len(submittedParticipants) >= 3
	} else {
		isReady = allSubmitted && len(round.Participants) > 0
	}

	response := map[string]interface{}{
		"round_id":      roundID,
		"status":        round.Status,
		"ready":         isReady,
		"uploadedCount": len(submittedParticipants),
		"expected":      round.Participants,
		"submitted":     mapToSlice(submittedParticipants),
	}

	return response, nil
}

// Helper function to convert map keys to slice
func mapToSlice(m map[string]bool) []string {
	result := make([]string, 0, len(m))
	for key := range m {
		result = append(result, key)
	}
	return result
}