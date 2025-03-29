------- Step 1: Wallet Setup -------

1) Metamask Wallet (Add Custom Network)
   Network Name - zkSync Sepolia Testnet
   Default RPC URL - https://sepolia.era.zksync.dev
   Chain ID - 300
   Currency Symbol - ETH 
   Block Explorer URL - https://sepolia.explorer.zksync.io

2) Convert Sepolia ETH to zkSync Sepolia Eth
   https://portal.zksync.io/bridge/?network=sepolia

3) zkSync Sepolia USDC
   https://faucet.circle.com/
   Import Token Address - 0xAe045DE5638162fa134807Cb558E15A3F5A7F853


------- Step 2: Deploying Smart Contracts -------

1) Import project from GitHub into IDE of choice 
2) In the .env file, add your wallet's private key
3) To install packages, in terminal run
	> npm install
4) Deploy Snarkjs verifier.sol contract
        > npx hardhat deploy-zksync --script deploy-verifier.js --network zkSyncSepolia;
	(Take note of the deployed verifier contract address)
5) In the .env file, add the verifier's contract address
6) Deploy the main charityDonation.sol contract 
	> npx hardhat deploy-zksync --script deploy-charitydonation.js --network zkSyncSepolia;
	(Take note of the deployed charityDonation contract address)


------- Step 3: Deploying DApp -------

1) Change directory to the charity-dapp folder
	> cd charity-dapp
2) Install required packages
	> npm install
3) In the /charity-dapp/.env file, add the charityDonation's contract address
4) Launch the Dapp
 	> npm run dev

------- Step 4: Interacting with DApp -------

1) Connect to the Dapp with the contract owner's address to access Admin functions
	- Adding and Removing Charities

2) Connect to the Dapp with an added charity's address to access Charity page
	- Withdrawing of available funds
	
3) Connect to the Dapp with any other address to access Donor page
	- Donate to any active charities privately
	- View all charities fund usage history
	




