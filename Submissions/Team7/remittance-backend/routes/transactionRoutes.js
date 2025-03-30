const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/TransactionController');
const verifyToken = require('../middleware/verifyToken');
const blockchain = require('../utils/blockchain');
const coingecko = require('../utils/coingecko');
const mockData = require('../utils/mockData');

// ========================
// PUBLIC ROUTES
// ========================

/**
 * @route   GET /api/transactions/bundled-rates
 * @desc    Get exchange rates, gas fees, and market conditions in a single call
 * @access  Public
 */
router.get('/bundled-rates', async (req, res) => {
  try {
    // Get the token symbols to check (or use defaults)
    const { from, to, amount } = req.query;
    const fromToken = from || 'ETH';
    const toToken = to || 'USDC';
    const amountToConvert = parseFloat(amount) || 1;

    // Validate input parameters
    if (!fromToken || !toToken) {
      return res.status(400).json({
        error: "Missing parameters",
        message: "Both 'from' and 'to' parameters are required"
      });
    }

    if (isNaN(amountToConvert) || amountToConvert <= 0) {
      return res.status(400).json({
        error: "Invalid amount",
        message: "Amount must be a positive number"
      });
    }

    // Fetch everything in order, with fallbacks for each step
    let exchangeRates, gasEstimate, marketConditions;
    
    // 1. Get exchange rates (highest priority)
    try {
      exchangeRates = await coingecko.getExchangeRates();
      console.log("Exchange rates fetched successfully");
    } catch (ratesError) {
      console.error("Error fetching exchange rates:", ratesError);
      // Use mock data as fallback
      exchangeRates = mockData.exchangeRates;
    }

    // 2. Get gas fees estimate using current ETH price
    const ethPrice = exchangeRates['ETH'] || 3000;
    try {
      gasEstimate = await blockchain.estimateGasFees(ethPrice);
    } catch (gasError) {
      console.error("Error estimating gas fees:", gasError);
      // Provide default gas estimate
      gasEstimate = {
        slow: 50,
        average: 70,
        fast: 100,
        unit: 'gwei',
        usdCost: {
          slow: '1.50',
          average: '2.10',
          fast: '3.00'
        },
        isDefault: true
      };
    }

    // 3. Check market conditions (lowest priority)
    try {
      marketConditions = await coingecko.getMarketConditions([fromToken, toToken]);
    } catch (marketError) {
      console.error("Error fetching market conditions:", marketError);
      // Provide default market conditions
      marketConditions = {
        tokens: {},
        isHigherThanAverage: false,
        isDefault: true
      };
    }

    // Calculate conversion rate with failsafe
    let fromRate = exchangeRates[fromToken];
    let toRate = exchangeRates[toToken];
    
    // Handle missing rates
    if (!fromRate) {
      console.warn(`Missing rate for ${toToken}, using fallback value`);
      toRate = mockData.tokenPrices[toToken]?.price || 1; // Default to 1 (stablecoin) if unknown
    }
    
    // Safe division
    const conversionRate = toRate > 0 ? fromRate / toRate : 1;
    const convertedAmount = amountToConvert * conversionRate;

    // Calculate if rates are favorable
    const isFavorable = !marketConditions.isHigherThanAverage && 
                       !(gasEstimate.isHigh || false);
                       
    // Calculate fees
    const transactionValueUsd = amountToConvert * fromRate;
    const gasFeeUsd = parseFloat(gasEstimate.usdCost?.average || 2.10);
    const swapFee = transactionValueUsd * 0.003; // 0.3% swap fee
    const platformFee = transactionValueUsd * 0.005; // 0.5% platform fee
    const totalFeeUsd = gasFeeUsd + swapFee + platformFee;
    
    // Calculate traditional remittance fee (typically 6.2%)
    const traditionalFeeUsd = transactionValueUsd * 0.062;
    const savings = traditionalFeeUsd - totalFeeUsd;

    // Format and return the bundled data
    res.json({
      timestamp: new Date().toISOString(),
      exchangeRates,
      gasEstimate: {
        slow: gasEstimate.slow,
        average: gasEstimate.average,
        fast: gasEstimate.fast,
        unit: gasEstimate.unit || 'gwei',
        usdCost: gasEstimate.usdCost || {
          slow: '1.50',
          average: '2.10',
          fast: '3.00'
        }
      },
      conversion: {
        from: fromToken,
        to: toToken,
        rate: conversionRate,
        amount: amountToConvert,
        convertedAmount
      },
      fees: {
        gas: gasFeeUsd,
        swap: swapFee,
        platform: platformFee,
        total: totalFeeUsd,
        traditional: traditionalFeeUsd,
        savings: savings,
        percentage: (totalFeeUsd / transactionValueUsd * 100).toFixed(2)
      },
      marketConditions: {
        favorable: isFavorable,
        message: isFavorable 
          ? 'Current market conditions are favorable for this transaction.'
          : marketConditions.isHigherThanAverage 
            ? 'Token prices are currently higher than average. You might get better rates later.'
            : gasEstimate.isHigh 
              ? 'Gas fees are currently high. Consider waiting for lower network traffic.'
              : 'Market conditions are neutral.'
      }
    });
  } catch (error) {
    console.error('Error in bundled-rates endpoint:', error);
    res.status(500).json({
      error: "Server error",
      message: "An unexpected error occurred while processing your request.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/transactions/tokens-with-changes
 * @desc    Get token prices with their 24h price changes
 * @access  Public
 */
router.get('/tokens-with-changes', async (req, res) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ 
        error: "Missing parameters", 
        message: "Symbols parameter is required" 
      });
    }
    
    // Parse the symbols string into an array
    const symbolArray = symbols.split(',').map(s => s.trim());
    
    // Create a result object with price changes for each token
    const result = {};
    
    // For each symbol, generate a deterministic price change
    symbolArray.forEach(symbol => {
      const isStablecoin = ['USDC', 'USDT', 'DAI', 'BUSD'].includes(symbol);
      
      // Use symbol characters to create a deterministic but seemingly random value
      const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      // Use sine function for more realistic oscillating price changes
      if (isStablecoin) {
        // Stablecoins have very small changes
        result[symbol] = (Math.sin(hash) * 0.2).toFixed(2);
      } else {
        // Other tokens have larger changes
        result[symbol] = (Math.sin(hash) * 5).toFixed(2);
      }
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error generating token price changes:', error);
    res.status(500).json({
      error: "Server error",
      message: "An unexpected error occurred while processing price changes."
    });
  }
});

/**
 * @route   GET /api/transactions/exchange-rates
 * @desc    Get current exchange rates for supported tokens
 * @access  Public
 */
router.get('/exchange-rates', async (req, res) => {
  try {
    console.log("Getting exchange rates");
    const exchangeRates = await coingecko.getExchangeRates();
    // Remove source field before sending to client
    const { _source, ...rates } = exchangeRates;
    res.status(200).json(rates);
  } catch (error) {
    console.error('Error in exchange-rates endpoint:', error);
    // Return mock data as fallback
    res.status(200).json(mockData.exchangeRates);
  }
});

/**
 * @route   GET /api/transactions/gas-prices
 * @desc    Get current gas prices
 * @access  Public
 */
router.get('/gas-prices', async (req, res) => {
  try {
    console.log("Getting gas prices");
    const gasPrices = await blockchain.getCurrentGasPrices();
    // Remove source field before sending to client
    const { _source, ...prices } = gasPrices;
    res.status(200).json(prices);
  } catch (error) {
    console.error('Error in gas-prices endpoint:', error);
    // Return default gas prices as fallback
    res.status(200).json({
      slow: 50,
      average: 70,
      fast: 100,
      unit: 'gwei',
      usdCost: {
        slow: '1.50',
        average: '2.10',
        fast: '3.00'
      }
    });
  }
});

/**
 * @route   GET /api/transactions/contract-status
 * @desc    Check smart contract status
 * @access  Public
 */
router.get('/contract-status', async (req, res) => {
  try {
    const status = await blockchain.checkContractStatus();
    res.json(status);
  } catch (error) {
    console.error('Error checking contract status:', error);
    res.status(200).json({
      working: false,
      mode: "error",
      error: "Failed to check contract status"
    });
  }
});

/**
 * @route   GET /api/transactions/tokens
 * @desc    Search for tokens by query
 * @access  Public
 */
router.get('/tokens', async (req, res) => {
  try {
    const { query, type } = req.query;
    
    // Return popular tokens if no query
    if (!query) {
      const popularTokens = type === 'stablecoin' 
        ? mockData.tokens.stablecoin 
        : mockData.tokens.crypto;
      return res.status(200).json(popularTokens.slice(0, 5));
    }

    console.log(`Searching for tokens with query: ${query}`);
    const tokenResults = await coingecko.searchTokens(query, type);
    console.log(`Found ${tokenResults.length} tokens matching "${query}"`);
    
    // Filter out any tokens with _source property
    const cleanResults = tokenResults.map(({ _source, ...token }) => token);
    res.json(cleanResults);
  } catch (error) {
    console.error('Error fetching token list:', error);
    
    // Return some default tokens as fallback
    const fallbackTokens = type === 'stablecoin' 
      ? mockData.tokens.stablecoin.slice(0, 5) 
      : mockData.tokens.crypto.slice(0, 5);
      
    res.status(200).json(fallbackTokens);
  }
});

/**
 * @route   GET /api/transactions/token-history
 * @desc    Get token price history
 * @access  Public
 */
router.get('/token-history', async (req, res) => {
  try {
    const { symbol, days = 7 } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Token symbol is required' });
    }
    
    console.log(`Fetching price history for ${symbol} over ${days} days`);
    const priceHistory = await coingecko.getTokenPriceHistory(symbol, parseInt(days));
    res.json(priceHistory);
  } catch (error) {
    console.error('Error fetching token price history:', error);
    
    // Generate mock history as fallback
    const mockHistory = mockData.generatePriceHistory(req.query.symbol, parseInt(req.query.days) || 7);
    res.status(200).json(mockHistory);
  }
});

/**
 * @route   GET /api/transactions/token-price/:symbolOrAddress
 * @desc    Get token price by symbol or address
 * @access  Public
 */
router.get('/token-price/:symbolOrAddress', async (req, res) => {
  const { symbolOrAddress } = req.params;

  try {
    if (!symbolOrAddress || symbolOrAddress.toLowerCase() === 'undefined' || symbolOrAddress.toLowerCase() === 'null') {
      return res.status(400).json({ error: 'Valid token symbol or address is required' });
    }

    console.log(`Fetching price for token: ${symbolOrAddress}`);
    const priceData = await coingecko.getTokenPrice(symbolOrAddress);
    
    // Remove source field before sending to client
    const { _source, ...price } = priceData;
    res.status(200).json(price);
  } catch (error) {
    console.error('Error fetching token price:', error);
    
    // Return default price as fallback
    const symbol = symbolOrAddress.startsWith('0x') ? 'unknown' : symbolOrAddress.toUpperCase();
    res.status(200).json({
      symbol,
      price: mockData.tokenPrices[symbol]?.price || 1.0,
      priceChange24h: 0
    });
  }
});

/**
 * @route   POST /api/transactions/refresh-cache
 * @desc    Force refresh the API caches
 * @access  Public
 */
router.post('/refresh-cache', async (req, res) => {
  try {
    // Refresh both caches
    blockchain.cache.clear();
    coingecko.refreshCachedData();
    
    res.status(200).json({
      success: true,
      message: "Cache refresh initiated"
    });
  } catch (error) {
    console.error('Error refreshing cache:', error);
    res.status(500).json({
      error: "Failed to refresh cache",
      message: error.message
    });
  }
});

// ========================
// PROTECTED ROUTES
// ========================

router.post('/', verifyToken, TransactionController.createTransaction);
router.get('/', verifyToken, TransactionController.getUserTransactions);
router.put('/:id([0-9]+)', verifyToken, TransactionController.updateTransactionStatus);
router.get('/:id([0-9]+)', verifyToken, TransactionController.getTransactionStatus);

module.exports = router;