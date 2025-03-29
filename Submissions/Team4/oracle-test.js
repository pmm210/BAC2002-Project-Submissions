import Web3 from 'web3';
import fs from 'fs';
import fetch from 'node-fetch'; // You may need to install this: npm install node-fetch

// Simple .env parser
function parseEnv() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') return;
      
      // Split by first equals sign
      const equalIndex = line.indexOf('=');
      if (equalIndex > 0) {
        const key = line.substring(0, equalIndex).trim();
        const value = line.substring(equalIndex + 1).trim();
        // Remove quotes if present
        envVars[key] = value.replace(/^["']|["']$/g, '');
      }
    });
    
    return envVars;
  } catch (err) {
    console.error('Failed to parse .env file:', err.message);
    return {};
  }
}

// Extended Contract ABI with updated functions
const contractABI = [
  // Get policy details
  {
    "inputs": [
      {"internalType": "bytes32", "name": "", "type": "bytes32"}
    ],
    "name": "policies",
    "outputs": [
      {"internalType": "address", "name": "policyholder", "type": "address"},
      {"internalType": "string", "name": "flightIata", "type": "string"},
      {"internalType": "uint256", "name": "premium", "type": "uint256"},
      {"internalType": "uint256", "name": "purchaseDate", "type": "uint256"},
      {"internalType": "uint256", "name": "flightDate", "type": "uint256"},
      {"internalType": "uint256", "name": "lastCheckedTimestamp", "type": "uint256"},
      {"internalType": "uint256", "name": "delayMinutes", "type": "uint256"},
      {"internalType": "enum FlightDelayInsurance.FlightStatus", "name": "status", "type": "uint8"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Get policies by owner
  {
    "inputs": [
      {"internalType": "address", "name": "_owner", "type": "address"}
    ],
    "name": "getPoliciesByOwner",
    "outputs": [
      {"internalType": "bytes32[]", "name": "", "type": "bytes32[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Request flight data from Chainlink Oracle
  {
    "inputs": [
      {"internalType": "bytes32", "name": "_policyId", "type": "bytes32"}
    ],
    "name": "requestFlightData",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Update flight date for testing
  {
    "inputs": [
      {"internalType": "bytes32", "name": "_policyId", "type": "bytes32"},
      {"internalType": "uint256", "name": "_newFlightDate", "type": "uint256"}
    ],
    "name": "updateFlightDateForTesting",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Force recheck
  {
    "inputs": [
      {"internalType": "bytes32", "name": "policyId", "type": "bytes32"}
    ],
    "name": "forceRecheck",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Get detailed policy information
  {
    "inputs": [
      {"internalType": "bytes32", "name": "policyId", "type": "bytes32"}
    ],
    "name": "getPolicyDetails",
    "outputs": [
      {"internalType": "address", "name": "policyholder", "type": "address"},
      {"internalType": "string", "name": "flightIata", "type": "string"},
      {"internalType": "uint256", "name": "premium", "type": "uint256"},
      {"internalType": "uint256", "name": "flightDate", "type": "uint256"},
      {"internalType": "uint256", "name": "lastChecked", "type": "uint256"},
      {"internalType": "uint256", "name": "delayMinutes", "type": "uint256"},
      {"internalType": "enum FlightDelayInsurance.FlightStatus", "name": "status", "type": "uint8"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Get recheck interval
  {
    "inputs": [],
    "name": "recheckInterval",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Flight status enum mapping
const FlightStatus = {
  0: "Pending",
  1: "OnTime",
  2: "Delayed",
  3: "Claimed"
};

// Function to prompt user for input
function promptUser(question) {
  // Using ES modules approach for readline
  return import('readline').then(readline => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      rl.question(question, answer => {
        rl.close();
        resolve(answer);
      });
    });
  });
}

// Enhanced function to request flight data from Chainlink Oracle
async function requestFlightData(web3, contract, account, policyId) {
  try {
    console.log('\n🔮 Requesting flight data from Chainlink Oracle...');
    
    // Get policy details if possible
    let policy;
    let hasDetailedInfo = false;
    
    try {
      const details = await contract.methods.getPolicyDetails(policyId).call();
      policy = {
        policyholder: details.policyholder,
        flightIata: details.flightIata,
        flightDate: details.flightDate,
        lastCheckedTimestamp: details.lastChecked,
        status: parseInt(details.status)
      };
      hasDetailedInfo = true;
    } catch (error) {
      // Fall back to old way if getPolicyDetails is not available
      policy = await contract.methods.policies(policyId).call();
    }
    
    console.log(`Policy flight date: ${new Date(Number(policy.flightDate) * 1000).toLocaleString()}`);
    console.log(`Current time: ${new Date().toLocaleString()}`);
    
    // Check if already checked
    if (hasDetailedInfo && policy.lastCheckedTimestamp > 0) {
      console.log('⚠️ This policy has already been checked by the oracle');
      console.log(`Last check: ${new Date(Number(policy.lastCheckedTimestamp) * 1000).toLocaleString()}`);
      
      // Check if recheck interval has passed
      const currentTime = Math.floor(Date.now() / 1000);
      try {
        const recheckInterval = await contract.methods.recheckInterval().call();
        const nextCheckTime = Number(policy.lastCheckedTimestamp) + Number(recheckInterval);
        
        if (currentTime < nextCheckTime) {
          console.log(`⚠️ Recheck interval has not passed. Next check available at: ${new Date(nextCheckTime * 1000).toLocaleString()}`);
          console.log('Continuing with request (contract will validate)...');
        } else {
          console.log('✅ Recheck interval has passed. Proceeding with check...');
        }
      } catch (error) {
        console.log('Could not verify recheck interval. Proceeding anyway...');
      }
    } else if (!hasDetailedInfo && policy.checked) {
      console.log('⚠️ This policy has already been checked by the oracle (legacy contract)');
      console.log('Continuing with request (may fail)...');
    }
    
    // Check LINK balance if possible
    try {
      const linkTokenAddress = '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904'; // Amoy testnet LINK
      const linkAbi = [{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}];
      const linkContract = new web3.eth.Contract(linkAbi, linkTokenAddress);
      const linkBalance = await linkContract.methods.balanceOf(contract.options.address).call();
      console.log(`Contract LINK balance: ${web3.utils.fromWei(linkBalance, 'ether')} LINK`);
    } catch (error) {
      console.log('Could not check LINK balance:', error.message);
    }
    
    // Check contract ETH/MATIC balance
    const balance = await web3.eth.getBalance(contract.options.address);
    console.log(`Contract MATIC balance: ${web3.utils.fromWei(balance, 'ether')} MATIC`);
    
    // Debug API URL that will be called
    const formattedDate = formatDate(policy.flightDate);
    console.log(`API URL that will be called: https://decentraflightapi.onrender.com/api/flight-delay?flight_iata=${policy.flightIata}&departure_date=${formattedDate}`);
    
    // Manually fetch from API to see response
    try {
      const response = await fetch(`https://decentraflightapi.onrender.com/api/flight-delay?flight_iata=${policy.flightIata}&departure_date=${formattedDate}`);
      const data = await response.json();
      console.log('API direct response:', JSON.stringify(data));
      
      if (data.delay_minutes >= 120) {
        console.log('⚠️ This flight is DELAYED according to the API. Your contract should process a payout.');
      } else {
        console.log('ℹ️ This flight is NOT DELAYED according to the API.');
      }
    } catch (error) {
      console.log('Could not fetch API directly:', error.message);
    }
    
    // Prepare transaction with increased gas
    const data = contract.methods.requestFlightData(policyId).encodeABI();
    const tx = {
      from: account.address,
      to: contract.options.address,
      data: data,
      gas: 500000, // Increased from 300000
      gasPrice: await web3.eth.getGasPrice()
    };
    
    console.log(`Sending transaction with gas: ${tx.gas}, gas price: ${web3.utils.fromWei(tx.gasPrice, 'gwei')} gwei`);
    
    // Sign transaction
    const signedTx = await account.signTransaction(tx);
    
    try {
      // Send transaction
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log('✅ Oracle request transaction successful!');
      console.log('Transaction hash:', receipt.transactionHash);
      console.log('Gas used:', receipt.gasUsed);
      console.log('Waiting for Chainlink Oracle to respond (usually takes 1-5 minutes)...');
      
      // Wait for policy status to update
      let policyChecked = false;
      let attempts = 0;
      const maxAttempts = 30; // Check for up to 5 minutes (30 * 10 seconds)
      
      console.log('\n⏱️ Monitoring for oracle response...');
      
      while (!policyChecked && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds between checks
        attempts++;
        
        console.log(`Checking policy status (attempt ${attempts}/${maxAttempts})...`);
        
        try {
          if (hasDetailedInfo) {
            // For updated contract
            const updatedDetails = await contract.methods.getPolicyDetails(policyId).call();
            if (updatedDetails.lastChecked > 0 && updatedDetails.lastChecked != policy.lastCheckedTimestamp) {
              policyChecked = true;
              console.log('\n✅ Oracle has responded!');
              console.log('  Status:', FlightStatus[parseInt(updatedDetails.status)]);
              console.log('  Delay minutes:', updatedDetails.delayMinutes);
              
              if (parseInt(updatedDetails.status) === 2) { // Delayed
                console.log('  ✅ Flight was marked as DELAYED');
                
                // Check if payout was processed
                if (parseInt(updatedDetails.status) === 3) { // Claimed
                  const payoutAmount = (BigInt(updatedDetails.premium) * BigInt(300)) / BigInt(100);
                  console.log('  ✅ Payout was processed successfully');
                  console.log('  💰 Payout amount:', web3.utils.fromWei(payoutAmount.toString(), 'ether'), 'MATIC');
                  console.log('  🎉 This policy correctly paid out!');
                } else {
                  console.log('  ❌ Flight was delayed but payout was NOT processed');
                  console.log('  Check for errors in the _processClaim function');
                }
              } else if (parseInt(updatedDetails.status) === 1) { // OnTime
                console.log('  ℹ️ Flight was NOT delayed (delay < 120 minutes)');
                console.log('  ℹ️ No payout was processed (as expected)');
              }
            }
          } else {
            // For legacy contract
            const updatedPolicy = await contract.methods.policies(policyId).call();
            if (updatedPolicy.checked) {
              policyChecked = true;
              console.log('\n✅ Oracle has responded!');
              
              if (updatedPolicy.isDelayed) {
                console.log('  ✅ Flight was marked as DELAYED');
                
                if (updatedPolicy.claimed) {
                  const payoutAmount = (BigInt(updatedPolicy.premium) * BigInt(300)) / BigInt(100);
                  console.log('  ✅ Payout was processed successfully');
                  console.log('  💰 Payout amount:', web3.utils.fromWei(payoutAmount.toString(), 'ether'), 'MATIC');
                  console.log('  🎉 This policy correctly paid out!');
                } else {
                  console.log('  ❌ Flight was delayed but payout was NOT processed');
                  console.log('  Check for errors in the _processClaim function');
                }
              } else {
                console.log('  ℹ️ Flight was NOT delayed (delay < 120 minutes)');
                console.log('  ℹ️ No payout was processed (as expected)');
              }
            }
          }
        } catch (checkError) {
          console.log(`Error checking policy status: ${checkError.message}`);
        }
      }
      
      if (!policyChecked) {
        console.log('\n⚠️ Oracle did not respond within the timeout period (5 minutes)');
        console.log('  This could be due to:');
        console.log('  - Chainlink node congestion');
        console.log('  - Insufficient LINK balance');
        console.log('  - API or contract issues');
        console.log('  Try running the script again to check if the oracle has responded.');
      }
          
    } catch (txError) {
      console.error('❌ Transaction failed!');
          
      if (txError.receipt) {
        console.error('Transaction receipt:', JSON.stringify(txError.receipt, null, 2));
        console.error('Gas used:', txError.receipt.gasUsed);
      }
          
      console.error('Error message:', txError.message);
          
      if (txError.reason) {
        console.error('Revert reason:', txError.reason);
      }
          
      // Try to get transaction receipt even if it failed
      try {
        if (txError.transactionHash) {
          const txReceipt = await web3.eth.getTransactionReceipt(txError.transactionHash);
          console.error('Transaction Receipt:', JSON.stringify(txReceipt, null, 2));
        }
      } catch (err) {
        console.error('Could not get receipt:', err.message);
      }
          
      // Suggest contract fix based on error
      if (txError.message.includes("already checked") || 
          txError.message.includes("Too soon to recheck")) {
        console.log('\n⚠️ Policy cannot be rechecked yet due to recheck interval.');
        console.log('Try using the forceRecheck function if you need to check immediately.');
      } else if (txError.message.includes("Flight date not reached")) {
        console.log('\n⚠️ Flight date is in the future. Update the flight date using:');
        console.log('updateFlightDateForTesting function first.');
      } else if (!hasDetailedInfo) {
        console.log('\n⚠️ Most likely issue: The requestId != policyId in your contract!');
        console.log('Your contract probably needs to be updated to track requestId -> policyId mapping.');
        console.log('See details at: https://docs.chain.link/any-api/api-reference#requestid');
      }
    }
  } catch (error) {
    console.error('❌ Error in requestFlightData function:', error.message);
    console.error(error.stack);
  }
}
    
// Force recheck function for admin
async function forceRecheck(web3, contract, account, policyId) {
  try {
    console.log('\n🔄 Forcing recheck of flight data...');
    
    // Prepare transaction
    const data = contract.methods.forceRecheck(policyId).encodeABI();
    const tx = {
      from: account.address,
      to: contract.options.address,
      data: data,
      gas: 500000,
      gasPrice: await web3.eth.getGasPrice()
    };
    
    // Sign and send transaction
    const signedTx = await account.signTransaction(tx);
    
    try {
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log('✅ Force recheck request successful!');
      console.log('Transaction hash:', receipt.transactionHash);
      console.log('Waiting for Chainlink Oracle to respond (usually takes 1-5 minutes)...');
      
      // Wait for policy status to update
      let policyUpdated = false;
      let attempts = 0;
      const maxAttempts = 30; // Check for up to 5 minutes (30 * 10 seconds)
      
      console.log('\n⏱️ Monitoring for oracle response...');
      
      // Get initial policy details
      const initialDetails = await contract.methods.getPolicyDetails(policyId).call();
      const initialTimestamp = initialDetails.lastChecked;
      
      while (!policyUpdated && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds between checks
        attempts++;
        
        console.log(`Checking policy status (attempt ${attempts}/${maxAttempts})...`);
        
        try {
          const updatedDetails = await contract.methods.getPolicyDetails(policyId).call();
          
          if (updatedDetails.lastChecked > initialTimestamp) {
            policyUpdated = true;
            console.log('\n✅ Oracle has responded to the forced recheck!');
            console.log('  Status:', FlightStatus[parseInt(updatedDetails.status)]);
            console.log('  Delay minutes:', updatedDetails.delayMinutes);
            
            if (parseInt(updatedDetails.status) === 2) { // Delayed
              console.log('  ✅ Flight was marked as DELAYED');
              
              // Check if payout was processed
              if (parseInt(updatedDetails.status) === 3) { // Claimed
                const payoutAmount = (BigInt(updatedDetails.premium) * BigInt(300)) / BigInt(100);
                console.log('  ✅ Payout was processed successfully');
                console.log('  💰 Payout amount:', web3.utils.fromWei(payoutAmount.toString(), 'ether'), 'MATIC');
                console.log('  🎉 This policy correctly paid out!');
              } else {
                console.log('  ❌ Flight was delayed but payout was NOT processed');
                console.log('  Check for errors in the _processClaim function');
              }
            } else if (parseInt(updatedDetails.status) === 1) { // OnTime
              console.log('  ℹ️ Flight was NOT delayed (delay < 120 minutes)');
              console.log('  ℹ️ No payout was processed (as expected)');
            }
          }
        } catch (checkError) {
          console.log(`Error checking policy status: ${checkError.message}`);
        }
      }
      
      if (!policyUpdated) {
        console.log('\n⚠️ Oracle did not respond within the timeout period (5 minutes)');
        console.log('  This could be due to:');
        console.log('  - Chainlink node congestion');
        console.log('  - Insufficient LINK balance');
        console.log('  - API or contract issues');
        console.log('  Try running the script again to check if the oracle has responded.');
      }
      
    } catch (txError) {
      console.error('❌ Force recheck transaction failed!');
      console.error('Error:', txError.message);
      
      if (txError.message.includes("not a function")) {
        console.log('The forceRecheck function is not available in this contract.');
        console.log('Make sure you have upgraded to the latest contract version.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error forcing recheck:', error.message);
  }
}
    
// Additional function to help set a policy to be delayed (for testing)
async function setFlightToDelayed(web3, contract, account, policyId) {
  try {
    console.log('\n⏰ Setting flight date to the past for testing...');
    
    // Set flight date to 2 days ago (to ensure it would be checked)
    const pastTimestamp = Math.floor(Date.now() / 1000) - (2 * 24 * 60 * 60);
    
    // Prepare transaction
    const data = contract.methods.updateFlightDateForTesting(policyId, pastTimestamp).encodeABI();
    const tx = {
      from: account.address,
      to: contract.options.address,
      data: data,
      gas: 300000,
      gasPrice: await web3.eth.getGasPrice()
    };
    
    // Sign and send transaction
    const signedTx = await account.signTransaction(tx);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    
    console.log('✅ Flight date updated successfully!');
    console.log('Transaction hash:', receipt.transactionHash);
    
    return true;
  } catch (error) {
    console.error('❌ Error updating flight date:', error.message);
    return false;
  }
}
    
// Helper function to format date in YYYY-MM-DD format
function formatDate(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Function to display policy information
async function displayPolicyInfo(web3, contract, policyId, isUpdatedContract) {
  try {
    if (isUpdatedContract) {
      try {
        const details = await contract.methods.getPolicyDetails(policyId).call();
        console.log('\n📊 Detailed Policy Information:');
        console.log('  Policy ID:', policyId);
        console.log('  Policyholder:', details.policyholder);
        console.log('  Flight IATA:', details.flightIata);
        console.log('  Premium:', web3.utils.fromWei(details.premium, 'ether'), 'MATIC');
        console.log('  Flight Date:', new Date(Number(details.flightDate) * 1000).toLocaleString());
        console.log('  Last Checked:', details.lastChecked > 0 ? 
          new Date(Number(details.lastChecked) * 1000).toLocaleString() : 'Never');
        console.log('  Delay Minutes:', details.delayMinutes);
        console.log('  Status:', FlightStatus[parseInt(details.status)]);
        
        // Check eligibility for rechecking
        const currentTime = Math.floor(Date.now() / 1000);
        const recheckInterval = await contract.methods.recheckInterval().call();
        const nextCheckTime = Number(details.lastChecked) + Number(recheckInterval);
        
        if (details.lastChecked > 0) {
          if (currentTime < nextCheckTime) {
            console.log('  ⏳ Next recheck available:', new Date(nextCheckTime * 1000).toLocaleString());
          } else {
            console.log('  ✅ Eligible for recheck now');
          }
        }
      } catch (error) {
        console.log('Error getting detailed information:', error.message);
      }
    } else {
      const policy = await contract.methods.policies(policyId).call();
      console.log('\n📊 Policy Information (Legacy Contract):');
      console.log('  Policy ID:', policyId);
      console.log('  Policyholder:', policy.policyholder);
      console.log('  Flight IATA:', policy.flightIata);
      console.log('  Premium:', web3.utils.fromWei(policy.premium, 'ether'), 'MATIC');
      console.log('  Flight Date:', new Date(Number(policy.flightDate) * 1000).toLocaleString());
      console.log('  Checked:', policy.checked ? 'Yes' : 'No');
      if (policy.checked) {
        console.log('  Delayed:', policy.isDelayed ? 'Yes' : 'No');
        console.log('  Claimed:', policy.claimed ? 'Yes' : 'No');
      }
    }
  } catch (error) {
    console.error('Error displaying policy info:', error.message);
  }
  return true;
}

// Function to show available actions and get user choice
async function showActionsMenu(isUpdatedContract) {
  console.log('\nAvailable actions:');
  console.log('1. Update flight date to the past');
  console.log('2. Request flight data from oracle');
  
  if (isUpdatedContract) {
    console.log('3. Force recheck (admin only)');
    console.log('4. View detailed policy information');
  }
  
  console.log('5. Select a different policy');
  console.log('6. Exit');
  
  const action = await promptUser('\nEnter action number: ');
  return action;
}

// Main function with loop for multiple actions
async function main() {
  try {
    // Parse .env file
    const env = parseEnv();
    
    // Check private key
    let privateKey = env.PRIVATE_KEY || '';
    if (!privateKey) {
      console.error('ERROR: No private key found in .env file');
      process.exit(1);
    }
    
    // Add 0x prefix if missing
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }
    
    // Initialize Web3
    const web3 = new Web3(env.POLYGON_AMOY_RPC || 'https://polygon-amoy.g.alchemy.com/v2/fHKyGrLKWcmZxxDL3on5gp-ZNkTn7G9A');
    
    // Get account
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const walletAddress = account.address;
    console.log('Connected with wallet address:', walletAddress);
    
    // Create contract instance
    const contractAddress = env.CONTRACT_ADDRESS || '0x596dc51CfEbD10D31CBcc37583D15C6DF56C2aAb';
    const contract = new web3.eth.Contract(contractABI, contractAddress);
    
    // Check if contract is updated version
    let isUpdatedContract = false;
    try {
      await contract.methods.recheckInterval().call();
      isUpdatedContract = true;
      console.log('✅ Using updated contract with time-based rechecking');
    } catch (error) {
      console.log('⚠️ Using legacy contract without time-based rechecking');
    }
    
    let selectedPolicyId = null;
    let continueProgram = true;
    
    while (continueProgram) {
      // If no policy is selected or user wants to select a different one
      if (!selectedPolicyId || selectedPolicyId === 'change') {
        // Get all policies for this user
        const policyIds = await contract.methods.getPoliciesByOwner(walletAddress).call();
        
        if (policyIds.length === 0) {
          console.log('No policies found for testing.');
          return;
        }
        
        // List all policies for selection
        console.log('\nAvailable policies:');
        for (let i = 0; i < policyIds.length; i++) {
          // Try to get detailed info if available
          let policyInfo = '';
          
          try {
            if (isUpdatedContract) {
              const details = await contract.methods.getPolicyDetails(policyIds[i]).call();
              policyInfo = `Flight: ${details.flightIata} (Status: ${FlightStatus[parseInt(details.status)]})`;
            } else {
              const policy = await contract.methods.policies(policyIds[i]).call();
              policyInfo = `Flight: ${policy.flightIata} (${policy.checked ? 'Checked' : 'Not Checked'})`;
            }
          } catch (error) {
            const policy = await contract.methods.policies(policyIds[i]).call();
            policyInfo = `Flight: ${policy.flightIata}`;
          }
          
          console.log(`${i+1}. Policy ID: ${policyIds[i].substring(0, 10)}... ${policyInfo}`);
        }
        
        // Ask user to select a policy
        const policyIndex = await promptUser('\nEnter the number of the policy you want to test (1-' + policyIds.length + '): ');
        const selectedIndex = parseInt(policyIndex) - 1;
        
        if (selectedIndex >= 0 && selectedIndex < policyIds.length) {
          selectedPolicyId = policyIds[selectedIndex];
        } else {
          console.log('Invalid policy selection. Please try again.');
          continue;
        }
      }
      
      // If a policy is selected, show its details
      if (selectedPolicyId && selectedPolicyId !== 'change') {
        await displayPolicyInfo(web3, contract, selectedPolicyId, isUpdatedContract);
      }
      
      // Show actions menu and get user choice
      const action = await showActionsMenu(isUpdatedContract);
      
      switch(action) {
        case '1':
          await setFlightToDelayed(web3, contract, account, selectedPolicyId);
          break;
        case '2':
          await requestFlightData(web3, contract, account, selectedPolicyId);
          break;
        case '3':
          if (isUpdatedContract) {
            await forceRecheck(web3, contract, account, selectedPolicyId);
          } else {
            console.log('This action is only available on the updated contract.');
          }
          break;
        case '4':
          if (isUpdatedContract) {
            await displayPolicyInfo(web3, contract, selectedPolicyId, isUpdatedContract);
          } else {
            console.log('This action is only available on the updated contract.');
          }
          break;
        case '5':
          selectedPolicyId = 'change'; // Flag to indicate we need to select a new policy
          break;
        case '6':
          console.log('Exiting program. Goodbye!');
          continueProgram = false;
          break;
        default:
          console.log('Invalid action selection. Please try again.');
      }
    }
  } catch (error) {
    console.error('Error in main function:', error.message);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});