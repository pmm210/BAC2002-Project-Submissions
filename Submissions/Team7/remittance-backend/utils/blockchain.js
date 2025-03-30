const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

// Load environment variables from .env file
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const STABLECOIN_ADDRESS = process.env.STABLECOIN_ADDRESS;
const ETHERSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "UTRWBFJQX1FCU5TYNCC1AZYENUU5H8QMZG";
const POLYGON_NETWORK = process.env.POLYGON_NETWORK || "amoy"; // Options: mainnet, amoy (testnet)

// Complete ABI from RemittanceContract.json
const RemittanceContractAbi = require('../../remittance-frontend/src/pages/RemittanceContract.json').abi;

// Log blockchain configuration (without revealing private key)
console.log("Blockchain Configuration:");
console.log(`- RPC URL: ${RPC_URL ? "Set" : "NOT SET"}`);
console.log(`- Private Key: ${PRIVATE_KEY ? "Set" : "NOT SET"}`);
console.log(`- Contract Address: ${CONTRACT_ADDRESS ? CONTRACT_ADDRESS : "NOT SET"}`);
console.log(`- Stablecoin Address: ${STABLECOIN_ADDRESS ? STABLECOIN_ADDRESS : "NOT SET"}`);
console.log(`- Etherscan/Polygonscan API Key: ${ETHERSCAN_API_KEY ? "Set" : "NOT SET"}`);
console.log(`- Network: ${POLYGON_NETWORK}`);

// Flag for simulation mode when blockchain connection fails
const useSimulation = !RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS;

// Create blockchain provider, wallet, and contract objects only if not in simulation mode
let provider, wallet, contract;

// In-memory cache with configurable TTL
const cache = {
  data: {},
  set: function(key, value, ttlSeconds) {
    const now = Date.now();
    this.data[key] = {
      value,
      expiry: now + (ttlSeconds * 1000)
    };
  },
  get: function(key) {
    const now = Date.now();
    const entry = this.data[key];
    
    if (!entry) return null;
    if (entry.expiry < now) {
      delete this.data[key];
      return null;
    }
    
    return entry.value;
  },
  clear: function() {
    this.data = {};
  },
  invalidate: function(keyPattern) {
    // Remove all cache entries matching the pattern
    Object.keys(this.data).forEach(key => {
      if (key.includes(keyPattern)) {
        delete this.data[key];
      }
    });
  }
};

/**
 * Initialize blockchain connection
 * @returns {Promise<boolean>} - True if successfully initialized, false otherwise
 */
async function initializeBlockchain() {
  if (useSimulation) {
    console.log("Using blockchain simulation mode due to missing configuration");
    return false;
  }
  
  try {
    // Create Ethereum provider connected to the specified RPC URL
    provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("Provider initialized with RPC URL", RPC_URL);
    
    // Create wallet using the private key and provider
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("Wallet initialized successfully");
    
    // Initialize contract with ABI and deployed contract address
    contract = new ethers.Contract(CONTRACT_ADDRESS, RemittanceContractAbi, wallet);
    console.log("Contract initialized at address:", CONTRACT_ADDRESS);
    
    // Test a simple contract call to verify connection
    try {
      const feePercentage = await contract.platformFeePercentage();
      console.log("Contract connection verified, platform fee:", feePercentage.toString());
    } catch (contractCallError) {
      console.warn("Could not verify contract with a test call:", contractCallError.message);
      // Continue anyway, as the contract might still be usable
    }
    
    return true;
  } catch (error) {
    console.error("Failed to initialize blockchain connection:", error);
    console.log("Falling back to simulation mode");
    return false;
  }
}

/**
 * Check the status of the smart contract connection
 * @returns {Promise<Object>} - Status object with connection details
 */
async function checkContractStatus() {
  // Check cache (1 minute TTL)
  const cacheKey = 'contract_status';
  const cachedStatus = cache.get(cacheKey);
  if (cachedStatus) {
    return cachedStatus;
  }

  let status;
  
  try {
    // Try to initialize blockchain connection if not already done
    if (!provider || !wallet || !contract) {
      const initialized = await initializeBlockchain();
      if (!initialized) {
        throw new Error("Failed to initialize blockchain connection");
      }
    }
    
    if (useSimulation || !contract) {
      status = {
        working: false,
        mode: "simulation",
        contractAddress: CONTRACT_ADDRESS || "Not set",
        network: RPC_URL || "Not set"
      };
    } else {
      try {
        // Try to call a simple view function like platformFeePercentage
        const feePercentage = await contract.platformFeePercentage();
        
        // If we got here, the contract is working
        status = {
          working: true,
          mode: "blockchain",
          contractAddress: CONTRACT_ADDRESS,
          network: RPC_URL,
          feePercentage: feePercentage.toString()
        };
        console.log("Smart contract is operational with fee percentage:", feePercentage.toString());
      } catch (error) {
        console.error("Contract status check failed:", error);
        status = {
          working: false,
          mode: "error",
          contractAddress: CONTRACT_ADDRESS,
          network: RPC_URL,
          error: error.message
        };
      }
    }
  } catch (error) {
    console.error("Error checking contract status:", error);
    status = {
      working: false,
      mode: "simulation",
      contractAddress: CONTRACT_ADDRESS || "Not set",
      network: RPC_URL || "Not set",
      error: error.message
    };
  }

  // Cache the status for 1 minute (reduced from 5 minutes)
  cache.set(cacheKey, status, 60);
  return status;
}
/**
 * Gets current gas prices from Etherscan/Polygonscan Gas Tracker API
 * @returns {Promise<Object>} Gas price data
 */

async function getCurrentGasPrices() {
  // Check if we have cached gas prices less than 1 minute old
  const now = Date.now();
  if (gasPriceCache.data && (now - gasPriceCache.timestamp < 60000)) {
    console.log("Using cached gas prices");
    return gasPriceCache.data;
  }
  
  if (useSimulation || !provider) {
    console.log("SIMULATION: Generating mock gas prices");
    
    // Generate mock gas prices with some randomness
    const baseSlow = 30 + Math.random() * 15;
    const baseAverage = baseSlow * 1.2;
    const baseFast = baseAverage * 1.3;
    
    // Convert to USD (assumes ETH price around $3000, simplified calculation)
    const ethPrice = 3000;
    const standardTxGas = 21000;
    const gweiToEth = 1e-9;
    
    const mockData = {
      slow: Math.round(baseSlow), 
      average: Math.round(baseAverage),
      fast: Math.round(baseFast),
      slowUsd: (baseSlow * gweiToEth * standardTxGas * ethPrice).toFixed(2),
      averageUsd: (baseAverage * gweiToEth * standardTxGas * ethPrice).toFixed(2),
      fastUsd: (baseFast * gweiToEth * standardTxGas * ethPrice).toFixed(2),
      isHigh: false,
      _source: 'mock'
    };
    
    // Determine if gas prices are high (more than 30% above historical average)
    mockData.isHigh = mockData.average > (gasHistoricalData.average * 1.3);
    
    // Cache the gas prices
    gasPriceCache = {
      timestamp: now,
      data: mockData
    };
    
    return mockData;
  }
  
  try {
    // Try to get standard gas price first (should work on all networks)
    const gasPrice = await provider.getGasPrice();
    const gasPriceGwei = Number(gasPrice) / 1e9;
    
    console.log(`Current gas price: ${gasPriceGwei} gwei`);
    
    // Calculate slow, average, and fast gas prices
    const slow = Math.max(1, Math.round(gasPriceGwei * 0.8));
    const average = Math.round(gasPriceGwei);
    const fast = Math.round(gasPriceGwei * 1.2);
    
    // Try to get EIP-1559 fee data if available
    let maxFeePerGas = null;
    let maxPriorityFeePerGas = null;
    
    try {
      const feeData = await provider.getFeeData();
      if (feeData.maxFeePerGas) {
        maxFeePerGas = Number(feeData.maxFeePerGas) / 1e9;
      }
      if (feeData.maxPriorityFeePerGas) {
        maxPriorityFeePerGas = Number(feeData.maxPriorityFeePerGas) / 1e9;
      }
    } catch (feeError) {
      console.log("Network doesn't support EIP-1559 fee data, using legacy gas price only");
    }
    
    // Get ETH price for USD conversion (simplified, in a real implementation you would use an oracle)
    const ethPrice = 3000; // Use CoinGecko for this
    const standardTxGas = 21000; // Standard ETH transfer gas
    const gweiToEth = 1e-9;
    
    // Calculate USD costs
    const slowUsd = (slow * gweiToEth * standardTxGas * ethPrice).toFixed(2);
    const averageUsd = (average * gweiToEth * standardTxGas * ethPrice).toFixed(2);
    const fastUsd = (fast * gweiToEth * standardTxGas * ethPrice).toFixed(2);
    
    // Determine if gas prices are high (more than 30% above historical average)
    const isHigh = average > (gasHistoricalData.average * 1.3);
    
    const gasPriceData = {
      slow,
      average,
      fast,
      maxFeePerGas,
      maxPriorityFeePerGas,
      slowUsd,
      averageUsd,
      fastUsd,
      isHigh,
      _source: 'blockchain',
      supportsEIP1559: maxFeePerGas !== null && maxPriorityFeePerGas !== null
    };
    
    // Cache the gas prices
    gasPriceCache = {
      timestamp: now,
      data: gasPriceData
    };
    
    return gasPriceData;
  } catch (error) {
    console.error("Failed to get gas prices:", error);
    
    // Generate mock gas prices as fallback
    const mockData = {
      slow: gasHistoricalData.slow,
      average: gasHistoricalData.average,
      fast: gasHistoricalData.fast,
      slowUsd: "1.50",
      averageUsd: "2.10",
      fastUsd: "3.00",
      isHigh: false,
      _source: 'mock',
      supportsEIP1559: false
    };
    
    // Cache the gas prices
    gasPriceCache = {
      timestamp: now,
      data: mockData
    };
    
    return mockData;
  }
}

/**
 * Estimates gas fees for a transaction
 * @param {number} ethPrice - The current ETH price in USD
 * @returns {Promise<Object>} Gas fee estimates
 */
async function estimateGasFees(ethPrice = null) {
  try {
    const gasPrices = await getCurrentGasPrices();
    
    // If ethPrice is provided, update the USD costs
    if (ethPrice && ethPrice > 0) {
      const swapTransferGas = 250000;
      
      // Calculate USD costs for different operation types
      const calculateUsdCost = (gasPrice) => {
        // Convert gas price from Gwei to ETH
        const gasPriceInEth = gasPrice * 1e-9;
        // Calculate gas cost in ETH
        const gasCostInEth = gasPriceInEth * swapTransferGas;
        // Convert to USD
        return (gasCostInEth * ethPrice).toFixed(2);
      };
      
      gasPrices.usdCost = {
        slow: calculateUsdCost(gasPrices.slow),
        average: calculateUsdCost(gasPrices.average),
        fast: calculateUsdCost(gasPrices.fast)
      };
      
      gasPrices.ethPrice = ethPrice;
    }
    
    return gasPrices;
  } catch (error) {
    console.error("Error estimating gas fees:", error);
    
    // Provide sensible defaults
    return {
      slow: 50,
      average: 70,
      fast: 100,
      unit: 'gwei',
      usdCost: {
        slow: '1.50',
        average: '2.10',
        fast: '3.00'
      },
      gasLimit: 250000,
      ethPrice: ethPrice || 3000,
      isDefault: true
    };
  }
}

/**
 * Gets a quote for token conversion
 * @param {string} sourceToken - The source token address or symbol
 * @param {number} amount - The amount to convert
 * @param {string} targetToken - The target token (defaults to stablecoin)
 * @returns {Promise} - The quote data
 */
async function getConversionQuote(sourceToken, amount, targetToken = null) {
  try {
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      throw new Error("Invalid amount provided");
    }

    // Make sure we have a valid source token
    if (!sourceToken) {
      throw new Error("Invalid source token");
    }

    // Get target token address (default to stablecoin)
    const targetTokenAddress = targetToken || STABLECOIN_ADDRESS || "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Default to USDC on Polygon

    // Check cache (30 second TTL for quotes)
    const cacheKey = `quote_${sourceToken}_${amount}_${targetTokenAddress}`;
    const cachedQuote = cache.get(cacheKey);
    if (cachedQuote) {
      console.log("Using cached conversion quote");
      return cachedQuote;
    }

    if (useSimulation || !contract) {
      // In simulation mode, provide a reasonable quote
      console.log(`SIMULATION: Getting quote for ${amount} of token ${sourceToken}`);
      
      // Simulate a slight delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simple mock conversion (1:1 for same token, or based on preset values)
      let convertedAmount;
      
      if (sourceToken === targetTokenAddress) {
        // Same token, 1:1 conversion
        convertedAmount = parseFloat(amount);
      } else {
        // Mock different exchange rates based on token types
        const mockRates = {
          "ETH": 3000,
          "WETH": 3000,
          "MATIC": 0.75,
          "WMATIC": 0.75,
          "USDC": 1.0,
          "USDT": 1.0,
          "DAI": 1.0
        };
        
        // Try to determine source and target rates
        let sourceRate = 1.0;
        let targetRate = 1.0;
        
        // Extract symbol from address or use as is
        const sourceSymbol = sourceToken.startsWith("0x") ? "UNKNOWN" : sourceToken;
        const targetSymbol = targetTokenAddress.startsWith("0x") ? "USDC" : targetTokenAddress;
        
        if (mockRates[sourceSymbol]) sourceRate = mockRates[sourceSymbol];
        if (mockRates[targetSymbol]) targetRate = mockRates[targetSymbol];
        
        // Calculate conversion
        convertedAmount = parseFloat(amount) * sourceRate / targetRate;
        
        // Add some randomness for realism (±2%)
        const randomFactor = 0.98 + Math.random() * 0.04;
        convertedAmount *= randomFactor;
      }
      
      const result = {
        sourceAmount: amount,
        convertedAmount: convertedAmount.toFixed(6),
        sourceToken: sourceToken,
        targetToken: targetTokenAddress,
        _source: 'simulation'
      };
      
      // Cache the result for 30 seconds
      cache.set(cacheKey, result, 30);
      
      return result;
    }

    console.log(`Getting conversion quote for ${amount} of token ${sourceToken}`);
    
    // Try contract-based quote
    try {
      const amountInWei = ethers.parseUnits(amount.toString(), 18);
      const quoteWei = await contract.getConversionQuote(sourceToken, amountInWei);
      const convertedAmount = ethers.formatUnits(quoteWei, 18);
      
      // Validate the converted amount
      if (quoteWei.toString() === '0' || parseFloat(convertedAmount) === 0) {
        throw new Error("Got zero conversion quote from contract");
      }
      
      const result = {
        sourceAmount: amount,
        convertedAmount: convertedAmount,
        sourceToken: sourceToken,
        targetToken: targetTokenAddress,
        _source: 'blockchain'
      };
      
      // Cache the result for 30 seconds
      cache.set(cacheKey, result, 30);
      
      return result;
    } catch (error) {
      console.error("Failed to get conversion quote from contract:", error.message);
      
      // Fall back to a simulation-based quote
      const mockResult = {
        sourceAmount: amount,
        convertedAmount: parseFloat(amount).toFixed(6),
        sourceToken: sourceToken,
        targetToken: targetTokenAddress,
        _source: 'fallback',
        error: error.message
      };
      
      // Cache the fallback for a shorter time
      cache.set(cacheKey, mockResult, 15);
      
      return mockResult;
    }
  } catch (error) {
    console.error("Error in getConversionQuote:", error);
    throw error;
  }
}

/**
 * Sends a remittance to the blockchain with token conversion
 * @param {string} recipient - The recipient's address
 * @param {string} sourceToken - The source token address
 * @param {number} amount - The amount to send
 * @param {number} minAmountOut - Optional minimum amount to receive after conversion
 * @returns {Promise} - The transaction data
 */
async function sendRemittance(recipient, sourceToken, amount, minAmountOut = null) {
  try {
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      throw new Error("Invalid amount provided");
    }

    if (useSimulation || !contract) {
      console.log(`SIMULATION: Sending remittance to ${recipient} for amount ${amount} from token ${sourceToken}`);
      // Simulate the blockchain transaction
      const mockTxHash = "0x" + Math.random().toString(16).substring(2) + Math.random().toString(16).substring(2);
      const mockBlockNumber = Math.floor(Math.random() * 1000000);
      const mockRemittanceId = Math.floor(Math.random() * 1000);
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`SIMULATION: Generated mock transaction: ${mockTxHash}`);
      return {
        txHash: mockTxHash,
        blockNumber: mockBlockNumber,
        sourceToken: sourceToken,
        targetToken: STABLECOIN_ADDRESS || "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        remittanceId: mockRemittanceId,
        _source: 'simulation'
      };
    }

    console.log(`Sending remittance to ${recipient} for amount ${amount} from token ${sourceToken}`);
    const amountInWei = ethers.parseUnits(amount.toString(), 18);
    
    let tx;
    if (minAmountOut !== null) {
      // Use slippage protection
      const minAmountOutWei = ethers.parseUnits(minAmountOut.toString(), 18);
      tx = await contract.sendWithConversionAndSlippage(
        sourceToken,
        amountInWei,
        recipient,
        minAmountOutWei
      );
    } else {
      // Use regular conversion
      tx = await contract.sendWithConversion(
        sourceToken,
        amountInWei,
        recipient
      );
    }
    
    console.log(`Transaction sent: ${tx.hash}`);
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    // Extract remittance ID from event logs
    let remittanceId = 0;
    try {
      // Look for RemittanceSent event in the logs
      for (const log of receipt.logs) {
        try {
          const event = contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (event && event.name === "RemittanceSent") {
            remittanceId = Number(event.args.remittanceId);
            break;
          }
        } catch (e) {
          // Skip logs that aren't RemittanceSent events
          continue;
        }
      }
    } catch (error) {
      console.warn("Could not extract remittanceId from logs:", error);
    }

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      sourceToken: sourceToken,
      targetToken: STABLECOIN_ADDRESS,
      remittanceId: remittanceId,
      _source: 'blockchain'
    };
  } catch (error) {
    console.error("Remittance failed:", error);
    throw new Error(`Failed to send remittance: ${error.message}`);
  }
}

/**
 * Gets the status of a remittance transaction
 * @param {string} remittanceId - The remittance ID
 * @returns {Promise} - The transaction status
 */
async function getRemittanceStatus(remittanceId) {
  try {
    if (useSimulation || !contract) {
      console.log(`SIMULATION: Checking status for remittance: ${remittanceId}`);
      // Simulate a blockchain query
      await new Promise(resolve => setTimeout(resolve, 300));
      // Return mock data for the status
      return {
        status: "completed",
        statusCode: 2,
        confirmations: 12,
        blockHash: "0x" + Math.random().toString(16).substring(2),
        timestamp: new Date().toISOString(),
        remittanceId: remittanceId,
        _source: 'simulation'
      };
    }

    console.log(`Checking status for remittance ID: ${remittanceId}`);
    const statusCode = await contract.getRemittanceStatus(remittanceId);
    
    // Map the numeric status to a descriptive string
    const statusMap = {
      0: "pending",
      1: "processing",
      2: "completed",
      3: "failed"
    };
    const status = statusMap[statusCode] || "unknown";
    
    // Get full remittance details if available
    let details = null;
    try {
      details = await contract.getRemittance(remittanceId);
    } catch (detailsError) {
      console.warn("Could not fetch remittance details:", detailsError);
    }
    
    return {
      status,
      statusCode,
      remittanceId: remittanceId,
      details: details,
      _source: 'blockchain'
    };
  } catch (error) {
    console.error("Failed to get remittance status:", error);
    return {
      status: "error",
      error: error.message,
      remittanceId: remittanceId,
      _source: 'error'
    };
  }
}

module.exports = {
  initializeBlockchain,
  checkContractStatus,
  sendRemittance,
  getRemittanceStatus,
  getConversionQuote,
  estimateGasFees,
  getCurrentGasPrices,
  cache // Export cache to allow direct manipulation
};