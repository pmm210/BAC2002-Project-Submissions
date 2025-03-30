package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	// Create a new instance of the federated learning chaincode
	// This will automatically include all functions in our SmartContract struct,
	// including the new quality metrics functions
	flChaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating federated-learning chaincode: %v", err)
	}

	// Start the chaincode, making it ready to accept invocations
	if err := flChaincode.Start(); err != nil {
		log.Panicf("Error starting federated-learning chaincode: %v", err)
	}
}