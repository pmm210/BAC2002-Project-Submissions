// Save this file to frontend/src/utils/gasless-helper.js

import { ethers } from 'ethers';
import LendingABI from '../contracts/Lending.json';
import ForwarderABI from '../contracts/LendingForwarder.json';

// Update this with your relayer service URL
const RELAYER_URL = process.env.REACT_APP_RELAYER_URL || 'http://localhost:3000';

/**
 * Creates and signs a meta-transaction to be relayed by the relayer service
 * @param {string} functionName - The function name to call in the Lending contract
 * @param {Array} functionParams - The parameters for the function call
 * @param {number|string} value - Amount of BNB to send with the transaction (optional)
 * @returns {Promise<Object>} The result from the relayer service
 */
export async function executeGasless(functionName, functionParams, value = 0) {
  if (!window.ethereum) {
    throw new Error("MetaMask or compatible wallet is required");
  }
  
  try {
    // 1) Create a browser-based provider and get the signer (MetaMask)
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    
    // 2) Get the contract addresses from the ABIs
    const LENDING_ADDRESS = LendingABI.address;
    const FORWARDER_ADDRESS = ForwarderABI.address;
    
    // 3) Fetch the user's nonce from your relayer service
    const nonceResponse = await fetch(`${RELAYER_URL}/nonce/${userAddress}`);
    const nonceData = await nonceResponse.json();
    if (!nonceData.nonce) {
      throw new Error("Failed to get nonce from relayer service");
    }
    const nonce = nonceData.nonce;
    
    // 4) Encode the function call data
    const lendingInterface = new ethers.Interface(LendingABI.abi);
    const data = lendingInterface.encodeFunctionData(functionName, functionParams);
    
    // 5) Convert the transaction value to wei
    const valueInWei = ethers.parseEther(value.toString());
    
    // 6) Create the ForwardRequest object
    const request = {
      from: userAddress,
      to: LENDING_ADDRESS,
      value: valueInWei.toString(), // Convert BigInt to string
      gas: 500000,
      nonce: nonce,
      data: data
    };
    
    // 7) Create EIP-712 domain and types
    const network = await provider.getNetwork();
    const domain = {
      name: 'LendingForwarder',
      version: '1',
      chainId: network.chainId,
      verifyingContract: FORWARDER_ADDRESS
    };
    
    const types = {
      ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'data', type: 'bytes' }
      ]
    };
    
    // 8) Ask the user to sign the typed data
    console.log("Requesting signature from wallet for function:", functionName);
    const signature = await signer.signTypedData(domain, types, request);
    
    // 9) Send the signed request to your relayer
    console.log("Sending request to relayer service at:", RELAYER_URL);
    const response = await fetch(`${RELAYER_URL}/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request, signature })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || "Relayer request failed");
    }
    
    console.log('Meta-transaction result:', result);
    return result;
    
  } catch (error) {
    console.error('Error executing gasless transaction:', error);
    throw error;
  }
}

/**
 * Helper function to deposit funds to the lending contract
 * @param {string} amount - Amount to deposit in BNB
 * @returns {Promise<Object>} The result from the relayer service
 */
export async function depositFundsGasless(amount) {
  // Send the amount as the value of the transaction, not as a parameter
  return executeGasless('depositFunds', [], amount);
}

/**
 * Helper function to request a loan by sending the collateral
 * @param {string} interestRate - Interest rate percentage 
 * @param {number} durationDays - Loan duration in days
 * @param {string} collateralBNB - Collateral in BNB (e.g. "1.5")
 * @returns {Promise<Object>} The result from the relayer service
 */
export async function requestLoanGasless(interestRate, durationDays, collateralBNB) {
  const durationSeconds = durationDays * 24 * 60 * 60;
  return executeGasless('requestLoan', [interestRate, durationSeconds], collateralBNB);
}

/**
 * OPTIONAL: Helper function that calculates collateral for a given "desired loan"
 * If you want to replicate the CLI approach of "loan = X BNB" => "collateral = 1.5X"
 */
export async function requestLoanGaslessWithDesiredAmount(interestRate, durationDays, desiredLoanBNB) {
  // 1.5x the desired loan
  const collateral = parseFloat(desiredLoanBNB) * 1.5;
  return requestLoanGasless(interestRate, durationDays, collateral.toString());
}

/**
 * Helper function to repay a loan
 * @param {number} loanId - ID of the loan to repay
 * @param {string} repaymentAmount - Amount to repay (principal + interest) in BNB
 * @returns {Promise<Object>} The result from the relayer service
 */
export async function repayLoanGasless(loanId, repaymentAmount) {
  return executeGasless('repayLoan', [loanId], repaymentAmount);
}

/**
 * Helper function to get credit score (via meta-transaction).
 * NOTE: "getCreditScore" is a 'view' function in Solidity, so normally you wouldn't need
 * a transaction. But if you're deliberately using the relayer for reading, you can do this.
 * Or you might want to call it directly with a provider 'call'.
 */
export async function getCreditScoreGasless(address) {
  return executeGasless('getCreditScore', [address]);
}

/**
 * Helper function to get borrower loans
 * Same note: it's a 'view' function, so you typically wouldn't need meta-transaction.
 */
export async function getBorrowerLoansGasless(address) {
  return executeGasless('getBorrowerLoans', [address]);
}

/**
 * Helper function for admin to withdraw funds
 * @param {string} amount - Amount to withdraw (BNB)
 * @returns {Promise<Object>} The result from the relayer service
 */
export async function withdrawFundsGasless(amount) {
  const amountWei = ethers.parseEther(amount);
  return executeGasless('withdrawFunds', [amountWei]);
}

/**
 * Helper function for admin to withdraw relayer earnings
 * @returns {Promise<Object>} The result from the relayer service
 */
export async function withdrawRelayerEarningsGasless() {
  return executeGasless('withdrawRelayerEarnings', []);
}

/**
 * Batch liquidate multiple overdue loans
 * @param {Array<number|string>} loanIds - Array of loan IDs
 * @returns {Promise<Object>} The result from the relayer service
 */
export async function batchLiquidateGasless(loanIds) {
  // Must pass an array of loanIds
  return executeGasless('batchLiquidateLoans', [loanIds], 0);
}

/**
 * Batch auto-repay multiple overdue loans
 * @param {Array<number|string>} loanIds - Array of loan IDs
 * @returns {Promise<Object>} The result from the relayer service
 */
export async function batchAutoRepayGasless(loanIds) {
  return executeGasless('batchAutoRepayLoans', [loanIds], 0);
}

/**
 * Helper function to check if the relayer service is healthy
 * @returns {Promise<boolean>} True if the relayer is healthy
 */
export async function checkRelayerHealth() {
  try {
    const response = await fetch(`${RELAYER_URL}/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    console.error('Relayer health check failed:', error);
    return false;
  }
}
