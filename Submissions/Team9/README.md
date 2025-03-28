# Team 9 Project : NFT Identity Card with Zero-Knowledge Proof

![logo](https://github.com/user-attachments/assets/0c8831b4-daec-417f-961c-c5a799cdad5a)

## Overview :

There are two components to our project :

- The **NFT-Issuer** - primarily meant for "Institution Admins" to **mint** "Identity Card NFTs" to their institution's various users, such as students and professors for University or employees and interns for Companies.
- The **ZKP-Generator** - primarily meant for "Institution Users" to **collect and display** the "Identity Card NFTs"

## To view the repository, try using the links below :

- Smart Contracts ([repo](https://github.com/VeriZKP/smart-contracts))
- NFT-issuer ([repo](https://github.com/VeriZKP/nft-issuer)) ([website](https://nft-issuer.vercel.app/))
- ZKP-generator ([repo](https://github.com/VeriZKP/zkp-generator)) ([website](https://zkp-generator.vercel.app/))

## Description

As of today, there were no privacy-ensuring methods to proof your identity to others when claiming benefits. Consider the following examples

- Proving you're a student to restaurants for student discounts
- Proving your citizenship to bowling alleys for price discounts

Each of the scenarios would require you to display your physical (or digital) identity card for an "eyeball" verification, which in-turn creates the following problems :

- Inaccurate verifications
- Information and privacy leak

With the above in mind, we'd propose a new framework that utilizes the strength of **Blockchain Technology** to store the identity cards and **Zero-Knowledge Proof** concept to generate and verify proofs of identity without information and privacy leak.

## Instructions

1. First, the reader should understand the various stakeholders involved in this framework :

- Contract Deployer : The person to launch the smart contract and enable the entire framework to operate
- Institution Admins : The person to mint NFTs for his/her institution's various users
- Institution Users : The person to collect NFTs and subsequently generate ZKP proofs
- Merchants : The person to verify ZKP proofs (Future works)

2. Now, the reader should begin by heading to the [Smart Contracts repository](https://github.com/VeriZKP/smart-contracts) and follow the instructions to deploy the smart contract.

3. Then, the reader should proceed to the [NFT-issuer repository](https://github.com/VeriZKP/nft-issuer) and follow the instructions to deploy the website with the correct Contract ABI and Contract Address

4. Lastly, the reader should proceed to the [ZKP-generator repository](https://github.com/VeriZKP/zkp-generator) and follow the instructions to deploy the website with the correct Contract ABI and Contract Address

## Demonstration

Feel free to view our project demonstration here : 
- [NFT Minting Video](https://www.youtube.com/watch?v=yVlxf9BjzJQ)
- [ZKP Verification Video](https://www.youtube.com/watch?v=V1nBA3htWek)

## About Team 9

- 2302993 | Lin Zhenming (Team Lead & Fullstack Developer) [LinkedIn](https://www.linkedin.com/in/elz-ming/)
- Chua Zong Han, Lionel (Smart Contract Developer) [LinkedIn](https://www.linkedin.com/in/lionelchuazh/)
- Tiang Soon Long (Smart Contract Developer) [LinkedIn](https://www.linkedin.com/in/soon-long-tiang/)
- Koh Yao Hao (Layer 2 Solution Engineer) [LinkedIn](https://www.linkedin.com/in/koh-yao-hao/)
- Toh Zhen Wei (Zero-Knowledge Proof Engineer) [LinkedIn](https://www.linkedin.com/in/tohzhenwei/)
