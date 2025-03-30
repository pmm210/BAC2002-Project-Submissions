package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// AssetExists returns true when asset with given ID exists in world state
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return assetJSON != nil, nil
}

// GetAllAssets returns all assets found in world state (for backward compatibility)
func (s *SmartContract) GetAllAssets(ctx contractapi.TransactionContextInterface) ([]*Asset, error) {
	// We only need to return assets that don't have prefixes (backward compatibility)
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "CONTRIBUTION_")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var assets []*Asset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		// Skip any prefixed keys that belong to our FL system
		key := queryResponse.Key
		if len(key) > 5 && 
		  (key[:6] == "EVENT_" || 
		   key[:6] == "ROUND_" || 
		   key[:14] == "PARTICIPATION_") {
			continue
		}

		var asset Asset
		err = json.Unmarshal(queryResponse.Value, &asset)
		if err != nil {
			continue // Skip if it's not an asset
		}
		assets = append(assets, &asset)
	}

	return assets, nil
}