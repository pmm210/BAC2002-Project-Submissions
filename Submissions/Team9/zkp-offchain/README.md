# zkp-offchain

## Overview
This project demonstrates an off-chain Zero-Knowledge Proof (ZKP) verification workflow using ZoKrates and Next.js. The goal is to show how we generate a ZKP proof for a student ID verification process and determine the validity of the student ID by decoding the circuit’s public output, without relying on an on-chain smart contract.

## Workflow
The core of the project is a ZoKrates circuit (student.zok) that takes three inputs:
- studentId (private): The actual student ID.
- minValidId (public): The minimum valid student ID (e.g., 1000).
- maxValidId (public): The maximum valid student ID (e.g., 5000).

The circuit computes and returns a boolean value:
- "1" if the studentId is within the valid range.
- "0" if it is not.

Our backend endpoint ses ZoKrates (via Docker) to:
- Compute the witness.
- Generate a proof.
- Return the proof data, including the public inputs (where the last element is the circuit’s computed output).

On the frontend, a simple Next.js UI is used to:
- Accept a student ID as input.
- Call the backend API to generate a proof.
- Decode the public input (using JavaScript BigInt) to determine if the proof indicates a valid student ID.
- Display the result to the user.

## Pre-requisites
- Node.js (v14 or later)
- Next.js framework
- Docker Desktop (to run the ZoKrates Docker container)
- Basic familiarity with Zero-Knowledge Proofs and ZoKrates

## Useful Resources
General Knowledge and Understanding
- https://chain.link/education/zero-knowledge-proof-zkp
- https://www.youtube.com/watch?v=_MYpZQVZdiM

Useful Guides
- https://www.youtube.com/watch?v=5qzNe1hk0oY
- https://www.youtube.com/watch?v=3Gd3E92aBxk

Useful Resources
- https://github.com/iden3/snarkjs#7-prepare-phase-2
- https://github.com/iden3/snarkjs


## Future Exploration
1. On-Chain Verification
- In the future, we might integrate an on-chain verifier (using the exported verifier.sol) for a trustless verification process.
2. Circom
- We may also explore using Circom for circuit design and proof generation, which might offer additional features.

## Issues Encountered
1. verifyTx function is not working as intended
- I tried to verify the proof on-chain using verifyTx, expecting it to return false for an invalid student ID. However, I tested and realised that verifyTx was only checking if the proof is cryptographically valid for the provided public inputs. It doesn’t interpret the meaning of the circuit’s output (e.g., “Is the student ID valid?”). As long as the proof is mathematically correct, verifyTx returns true—even if the circuit output says “invalid.”

2. Choice not to use "assertion" logic
- To force the on-chain verifier to reject an invalid student ID, we’d need to include an assertion in the circuit (so that no proof is generated at all for invalid inputs) or decode the circuit’s output on-chain. However, if there is no proof generated at all, then there is no proof to be verified which defeats the purpose of using ZKP.
