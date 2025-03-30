// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./verifier.sol";  // Adjust path as necessaryzkp-project/artifacts/IVerifier.json

contract VerifyStudent {
    Verifier private verifier;  // Interface to interact with the Verifier contract

    event VerificationResult(bool verified);

    event DebugInfo(string message, uint indexed value); // for debugging

    // Constructor to set the address of the Verifier contract
    constructor(address verifierAddress) {
        verifier = Verifier(verifierAddress);
    }

    // Function to perform the verification using the verifier contract
    function verifyStudentData(
        uint256[2] memory a, 
        uint256[2][2] memory b, 
        uint256[2] memory c, 
        uint256[3] memory input //error might be here
    ) external returns (bool) {
        Verifier.Proof memory proof = Verifier.Proof({
            a: Pairing.G1Point(a[0], a[1]),
            b: Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]),
            c: Pairing.G1Point(c[0], c[1])
        });

        bool result = verifier.verifyTx(proof, input);
        emit VerificationResult(result);

        //debug
        if (!result) {
            emit DebugInfo("Verification failed", 1);
        }

        return result;
    }
}
