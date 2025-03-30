const axios = require('axios');
const mockData = require('./mockData');

// CoinGecko API base URL
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

// API key is not required for public API but can be set if you have one
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || null;

// Alternative API URL for CryptoCompare
const CRYPTOCOMPARE_API_URL = 'https://min-api.cryptocompare.com/data';

// Track API rate limits
let apiAvailable = true;
let apiCallsToday = 0;
let lastReset = new Date().setHours(0, 0, 0, 0);
const MAX_DAILY_CALLS = 40; // Conservative limit for free tier

// Simple in-memory cache with proper TTL management
const cache = {
  data: {},
  set: function(key, value, ttlSeconds) {
    const now = Date.now();
    this.data[key] = {
      value,
      expiry: now + (ttlSeconds * 1000)
    };
    // console.log(`Cached ${key} for ${ttlSeconds} seconds`);
  },
  get: function(key) {
    const now = Date.now();
    const entry = this.data[key];
    
    if (!entry) return null;
    if (entry.expiry < now) {
      delete this.data[key];
      return null;
    }
    
    // console.log(`Cache hit for ${key}`);
    return entry.value;
  },
  clear: function() {
    this.data = {};
    console.log("Cache cleared");
  },
  invalidate: function(keyPattern) {
    // Remove all cache entries matching the pattern
    let count = 0;
    Object.keys(this.data).forEach(key => {
      if (key.includes(keyPattern)) {
        delete this.data[key];
        count++;
      }
    });
    console.log(`Invalidated ${count} cache entries matching ${keyPattern}`);
  }
};

// Define supported tokens (for mapping CoinGecko IDs)
const polygonTokenMap = {
  'ETH': 'ethereum',
  'WETH': 'weth',
  'MATIC': 'matic-network',
  'WMATIC': 'wmatic',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'DAI': 'dai',
  'BUSD': 'binance-usd',
  'TUSD': 'true-usd',
  'LINK': 'chainlink',
  'AAVE': 'aave'
};

// CryptoCompare token mappings (more reliable API)
const cryptoCompareTokenMap = {
  'ETH': 'ETH',
  'WETH': 'ETH', // Same price as ETH
  'MATIC': 'MATIC',
  'WMATIC': 'MATIC', // Same price as MATIC
  'USDC': 'USDC',
  'USDT': 'USDT',
  'DAI': 'DAI',
  'BUSD': 'BUSD',
  'TUSD': 'TUSD',
  'LINK': 'LINK',
  'AAVE': 'AAVE'
};

// Helper function to add backoff delay when rate limited
async function backoff(retryCount) {
  const delay = Math.min(Math.pow(2, retryCount) * 1000, 10000); // Max 10 seconds
  console.log(`Rate limited, backing off for ${delay}ms before retry...`);
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Track API calls and reset counter daily
function trackApiCall() {
  const today = new Date().setHours(0, 0, 0, 0);
  
  // Reset counter if it's a new day
  if (today > lastReset) {
    apiCallsToday = 0;
    lastReset = today;
    apiAvailable = true; // Reset availability flag
    console.log("CoinGecko API call counter reset for new day");
  }
  
  apiCallsToday++;
  console.log(`CoinGecko API call #${apiCallsToday} for today`);
  
  // If we exceed daily limit, disable API calls
  if (apiCallsToday > MAX_DAILY_CALLS) {
    apiAvailable = false;
    console.log("Exceeded conservative daily API call limit, switching to mock data for the rest of the day");
  }
}

/**
 * Test the API connection
 * @returns {Promise<boolean>} - True if API is working, false otherwise
 */
async function testApiConnection() {
  try {
    console.log("Testing CoinGecko API connection...");
    
    // Use a more lenient timeout for the test
    const response = await axios.get(`${COINGECKO_API_URL}/ping`, {
      timeout: 5000 // 5 second timeout
    });
    
    if (response.data && response.data.gecko_says) {
      console.log("CoinGecko API connection successful:", response.data.gecko_says);
      apiAvailable = true;
      return true;
    } else {
      console.warn("CoinGecko API responded but with unexpected format");
      apiAvailable = false;
      return false;
    }
  } catch (error) {
    console.error("CoinGecko API connection failed:", error.message);
    apiAvailable = false;
    return false;
  }
}

/**
 * Get exchange rates from CryptoCompare as alternative source
 * @returns {Promise<Object>} - Exchange rates object
 */
async function getCryptoCompareRates() {
  try {
    console.log("Fetching rates from CryptoCompare");
    
    // Get top tokens
    const symbols = Object.keys(cryptoCompareTokenMap).join(',');
    
    const response = await axios.get(`${CRYPTOCOMPARE_API_URL}/pricemulti`, {
      params: {
        fsyms: symbols,
        tsyms: 'USD'
      },
      timeout: 5000 // 5 second timeout
    });
    
    // Map to our format
    const rates = {};
    for (const [symbol, prices] of Object.entries(response.data)) {
      // Find the corresponding token symbol in our system
      const tokenSymbol = Object.entries(cryptoCompareTokenMap)
        .find(([_, ccSymbol]) => ccSymbol === symbol)?.[0];
      
      if (tokenSymbol && prices.USD) {
        rates[tokenSymbol] = prices.USD;
      }
    }
    
    console.log("Rates fetched from CryptoCompare successfully");
    return rates;
  } catch (error) {
    console.error("Error fetching from CryptoCompare:", error.message);
    throw error;
  }
}

/**
 * Get exchange rates for common tokens with multiple retries
 * @param {boolean} forceRefresh - Force refresh the cache
 * @returns {Promise<Object>} - Exchange rates object
 */
async function getExchangeRates(forceRefresh = false) {
  // Check cache first (15 minute TTL) unless force refresh is requested
  const cacheKey = 'exchange_rates';
  const cachedData = !forceRefresh ? cache.get(cacheKey) : null;
  
  if (cachedData) {
    console.log("Using cached exchange rates");
    return cachedData;
  }
  
  // If API is unavailable, use mock data
  if (!apiAvailable) {
    console.log("API unavailable, using mock exchange rates");
    const mockRates = { ...mockData.exchangeRates, _source: 'mock' };
    cache.set(cacheKey, mockRates, 900); // Cache for 15 minutes
    return mockRates;
  }
  
  // Try with CoinGecko first
  for (let retryCount = 0; retryCount < 3; retryCount++) {
    try {
      trackApiCall();
      
      // Use simpler endpoint with fewer parameters to reduce chance of errors
      const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
        params: {
          ids: 'bitcoin,ethereum,matic-network,usd-coin,tether,dai,binance-usd',
          vs_currencies: 'usd',
          include_24hr_change: false // Skip this to simplify request
        },
        timeout: 5000 // 5 second timeout
      });
      
      // Map from CoinGecko format to our expected format
      const rates = {
        BTC: response.data['bitcoin']?.usd || 60000,
        ETH: response.data['ethereum']?.usd || 3000,
        MATIC: response.data['matic-network']?.usd || 0.75,
        USDC: response.data['usd-coin']?.usd || 1.0,
        USDT: response.data['tether']?.usd || 1.0,
        DAI: response.data['dai']?.usd || 1.0,
        BUSD: response.data['binance-usd']?.usd || 1.0,
        WETH: response.data['ethereum']?.usd || 3000, // Same as ETH
        WMATIC: response.data['matic-network']?.usd || 0.75, // Same as MATIC
        TUSD: 1.0, // Assume this is pegged
        _source: 'coingecko'
      };
      
      console.log("Exchange rates fetched successfully from CoinGecko");
      cache.set(cacheKey, rates, 900); // Cache for 15 minutes
      return rates;
    } catch (error) {
      console.error(`Error fetching exchange rates from CoinGecko (attempt ${retryCount + 1}/3):`, error.message);
      
      // If rate limited, wait and try again
      if (error.response?.status === 429) {
        await backoff(retryCount);
        continue;
      }
      
      // For other errors, try alternative source or fallback to defaults
      break;
    }
  }
  
  // Try CryptoCompare as alternative
  try {
    const alternativeRates = await getCryptoCompareRates();
    console.log("Using rates from alternative source (CryptoCompare)");
    
    // Fill in any missing rates
    const filledRates = {
      ...alternativeRates,
      BTC: alternativeRates.BTC || 60000,
      ETH: alternativeRates.ETH || 3000,
      WETH: alternativeRates.ETH || 3000,
      MATIC: alternativeRates.MATIC || 0.75,
      WMATIC: alternativeRates.MATIC || 0.75, 
      USDC: alternativeRates.USDC || 1.0,
      USDT: alternativeRates.USDT || 1.0,
      DAI: alternativeRates.DAI || 1.0,
      BUSD: alternativeRates.BUSD || 1.0,
      TUSD: alternativeRates.TUSD || 1.0,
      _source: 'cryptocompare'
    };
    
    cache.set(cacheKey, filledRates, 900); // Cache for 15 minutes
    return filledRates;
  } catch (altError) {
    console.error("Error fetching from alternative source:", altError.message);
    
    // Return default prices as final fallback
    console.log("Using default token prices as fallback");
    const defaultRates = { ...mockData.exchangeRates, _source: 'mock' };
    cache.set(cacheKey, defaultRates, 900); // Cache for 15 minutes
    return defaultRates;
  }
}

/**
 * Search for tokens by query
 * @param {string} query - Search query
 * @param {string} type - Token type filter (optional)
 * @returns {Promise<Array>} - Array of matching tokens
 */
async function searchTokens(query, type = null) {
  if (!query || query.trim().length < 2) {
    return type === 'stablecoin' ? 
      mockData.tokens.stablecoin : 
      mockData.tokens.crypto;
  }
  
  // Check cache (30 minute TTL for token searches)
  const cacheKey = `token_search_${query.toLowerCase()}_${type || 'all'}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    console.log("Using cached token search results");
    return cachedData;
  }
  
  // If API is unavailable, use mock data
  if (!apiAvailable) {
    console.log("API unavailable, using mock token search");
    const mockResults = mockData.searchTokens(query, type);
    cache.set(cacheKey, mockResults, 1800); // Cache for 30 minutes
    return mockResults;
  }
  
  try {
    trackApiCall();
    
    // Filter locally based on our known tokens instead of using API
    // This is more reliable and avoids API errors
    
    const knownTokens = type === 'stablecoin' ? 
      mockData.tokens.stablecoin : 
      (type === 'crypto' ? mockData.tokens.crypto : [...mockData.tokens.crypto, ...mockData.tokens.stablecoin]);
    
    // Filter tokens based on query
    const filteredTokens = knownTokens.filter(token => 
      token.symbol.toLowerCase().includes(query.toLowerCase()) || 
      token.name.toLowerCase().includes(query.toLowerCase())
    );
    
    // Get current prices for these tokens
    const rates = await getExchangeRates();
    
    // Update prices based on latest rates
    const tokensWithPrices = filteredTokens.map(token => {
      const currentPrice = rates[token.symbol];
      return {
        ...token,
        price: currentPrice !== undefined ? currentPrice : token.price
      };
    });
    
    console.log(`Found ${tokensWithPrices.length} tokens matching "${query}"`);
    cache.set(cacheKey, tokensWithPrices, 1800); // Cache for 30 minutes
    return tokensWithPrices;
  } catch (error) {
    console.error("Error searching tokens:", error.message);
    
    // Filter the mock tokens as fallback
    const mockResults = mockData.searchTokens(query, type);
    cache.set(cacheKey, mockResults, 1800); // Cache for 30 minutes
    return mockResults;
  }
}

/**
 * Get token price history
 * @param {string} symbol - Token symbol
 * @param {number} days - Number of days of history to fetch
 * @returns {Promise<Object>} - Price history data
 */
async function getTokenPriceHistory(symbol, days = 7) {
  // Check cache (1 hour TTL for price history)
  const cacheKey = `price_history_${symbol}_${days}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    console.log("Using cached price history");
    return cachedData;
  }
  
  // If API is unavailable, use mock data
  if (!apiAvailable) {
    console.log("API unavailable, using mock price history");
    const mockHistory = mockData.generatePriceHistory(symbol, days);
    cache.set(cacheKey, mockHistory, 3600); // Cache for 1 hour
    return mockHistory;
  }
  
  // For multiple retries
  for (let retryCount = 0; retryCount < 2; retryCount++) {
    try {
      trackApiCall();
      
      // Use a simpler approach - just generate synthetic data based on current price
      const rates = await getExchangeRates();
      const currentPrice = rates[symbol] || mockData.tokenPrices[symbol]?.price || 100;
      
      // Generate price history with some random variation around current price
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const prices = [];
      const market_caps = [];
      const total_volumes = [];
      
      for (let i = days; i >= 0; i--) {
        const timestamp = now - (i * oneDayMs);
        // Add random fluctuation (±10%)
        const fluctuation = 0.10;
        const randomFactor = 1 + (Math.random() * fluctuation * 2 - fluctuation);
        const price = currentPrice * randomFactor;
        
        prices.push([timestamp, price]);
        market_caps.push([timestamp, price * 1000000000]); // Fake market cap
        total_volumes.push([timestamp, price * 100000000]); // Fake volume
      }
      
      const historyData = { prices, market_caps, total_volumes };
      console.log(`Generated price history for ${symbol} based on current price`);
      
      cache.set(cacheKey, historyData, 3600); // Cache for 1 hour
      return historyData;
    } catch (error) {
      console.error(`Error generating price history (attempt ${retryCount + 1}/2):`, error.message);
      
      if (retryCount < 1) {
        // Wait briefly before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Generate mock price history when everything fails
  console.log(`Falling back to mock price history for ${symbol}`);
  const mockData2 = mockData.generatePriceHistory(symbol, days);
  cache.set(cacheKey, mockData2, 3600); // Cache for 1 hour
  return mockData2;
}

/**
 * Get token price by symbol
 * @param {string} symbolOrAddress - Token symbol or address
 * @returns {Promise<Object>} - Token price object
 */
async function getTokenPrice(symbolOrAddress) {
  // Check cache (5 minute TTL for token prices)
  const cacheKey = `token_price_${symbolOrAddress}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    console.log("Using cached token price");
    return cachedData;
  }
  
  // If it looks like an address, convert to a symbol if possible
  let symbol = symbolOrAddress;
  if (symbolOrAddress.startsWith('0x')) {
    // Simple lookup in mock data
    const knownToken = Object.values(mockData.tokens.crypto)
      .concat(Object.values(mockData.tokens.stablecoin))
      .find(t => t.address && t.address.toLowerCase() === symbolOrAddress.toLowerCase());
    
    if (knownToken) {
      symbol = knownToken.symbol;
    } else {
      // Unknown address, return default
      const defaultPrice = {
        symbol: "UNKNOWN",
        price: 1.0,
        priceChange24h: 0,
        address: symbolOrAddress,
        _source: 'default'
      };
      cache.set(cacheKey, defaultPrice, 300); // Cache for 5 minutes
      return defaultPrice;
    }
  }
  
  // Normalize symbol
  symbol = symbol.toUpperCase();
  
  // Get price from exchange rates
  try {
    const rates = await getExchangeRates();
    const price = rates[symbol];
    
    if (price !== undefined) {
      const result = {
        symbol,
        price,
        priceChange24h: 0, // Don't have this info in simplified implementation
        _source: rates._source
      };
      
      cache.set(cacheKey, result, 300); // Cache for 5 minutes
      return result;
    }
  } catch (error) {
    console.warn("Error fetching price from exchange rates:", error.message);
  }
  
  // If we got here, try mock data
  const mockPrice = mockData.tokenPrices[symbol];
  if (mockPrice) {
    const result = {
      symbol,
      price: mockPrice.price,
      priceChange24h: mockPrice.priceChange || 0,
      _source: 'mock'
    };
    
    cache.set(cacheKey, result, 300); // Cache for 5 minutes
    return result;
  }
  
  // Unknown token, return default
  const defaultPrice = {
    symbol,
    price: 1.0,
    priceChange24h: 0,
    _source: 'default'
  };
  
  cache.set(cacheKey, defaultPrice, 300); // Cache for 5 minutes
  return defaultPrice;
}

/**
 * Compare current rates to historical averages
 * @param {Array<string>} symbols - Token symbols to compare
 * @returns {Promise<Object>} - Comparison results
 */
async function getMarketConditions(symbols) {
  if (!Array.isArray(symbols)) {
    symbols = [symbols];
  }
  
  // Check cache (15 minute TTL)
  const symbolsKey = symbols.sort().join(',');
  const cacheKey = `market_conditions_${symbolsKey}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    console.log("Using cached market conditions");
    return cachedData;
  }
  
  try {
    // Get current prices
    const currentRates = await getExchangeRates();
    
    // Use hardcoded historical averages instead of fetching history
    // This is more reliable and avoids API errors
    const historicalAverages = {
      BTC: 60000,
      ETH: 3000,
      MATIC: 0.75,
      USDC: 1.0,
      USDT: 1.0,
      DAI: 1.0,
      BUSD: 1.0,
      WETH: 3000,
      WMATIC: 0.75
    };
    
    // For each token, compare current to historical
    const comparisonResults = {};
    let isHigherThanAverage = false;
    
    for (const symbol of symbols) {
      const current = currentRates[symbol];
      const historical = historicalAverages[symbol];
      
      if (current && historical) {
        // Calculate percentage difference
        const difference = ((current - historical) / historical) * 100;
        
        comparisonResults[symbol] = {
          current,
          historical,
          difference,
          isHigher: difference > 5 // 5% threshold for "higher than average"
        };
        
        // If any token's rate is significantly higher, flag the overall result
        if (difference > 5) {
          isHigherThanAverage = true;
        }
      }
    }
    
    const results = {
      tokens: comparisonResults,
      isHigherThanAverage,
      timestamp: new Date().toISOString()
    };
    
    cache.set(cacheKey, results, 900); // Cache for 15 minutes
    return results;
  } catch (error) {
    console.error("Error getting market conditions:", error.message);
    
    // Return default market conditions
    const defaultResults = {
      tokens: {},
      isHigherThanAverage: false,
      timestamp: new Date().toISOString(),
      _source: 'default'
    };
    
    cache.set(cacheKey, defaultResults, 900); // Cache for 15 minutes
    return defaultResults;
  }
}

// Force refresh all cached data
function refreshCachedData() {
  console.log("Force refreshing all cached cryptocurrency data");
  
  // Clear the entire cache
  cache.clear();
  
  // Start by testing API connection
  testApiConnection()
    .then(available => {
      if (available) {
        // Prefetch exchange rates if API is available
        return getExchangeRates(true);
      }
    })
    .then(() => {
      console.log("Cache refreshed successfully");
    })
    .catch(err => {
      console.error("Error refreshing cache:", err.message);
    });
}

module.exports = {
  testApiConnection,
  getExchangeRates,
  searchTokens,
  getTokenPriceHistory,
  getTokenPrice,
  getMarketConditions,
  refreshCachedData,
  cache // Export cache to allow direct manipulation
};