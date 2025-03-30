/**
 * Mock data for token prices, exchange rates, and other API-dependent data
 */

// Mock exchange rates
const exchangeRates = {
    // Major cryptocurrencies
    BTC: 87324.00,
    ETH: 2025.53,
    MATIC: 0.238411,
    
    // Stablecoins
    USDC: 1.00,
    USDT: 1.00,
    DAI: 1.00,
    SGD: 0.74,
    BUSD: 1.0,
    TUSD: 1.0,
    
    // Wrapped tokens
    WBTC: 87324.00,   // Same as BTC
    WETH: 2025.53,    // Same as ETH
    
    // Other popular tokens
    SOL: 168.45,
    AVAX: 26.32,
    DOT: 7.15,
    LINK: 12.85,
    UNI: 8.47,
    AAVE: 93.21,
    
    // Other stablecoins
    USDS: 1.0,
    USDP: 1.0,
    GUSD: 1.0,
    FRAX: 1.0
};
  
// Mock token prices with 24h changes
const tokenPrices = {
    BTC: { price: 87324.00, priceChange: 2.1 },
    ETH: { price: 2025.53, priceChange: 1.5 },
    MATIC: { price: 0.238411, priceChange: -0.8 },
    USDC: { price: 1.0, priceChange: 0.01 },
    USDT: { price: 1.0, priceChange: 0.02 },
    DAI: { price: 1.0, priceChange: 0.05 },
    SGD: { price: 0.74, priceChange: -0.3 },
    WBTC: { price: 87324.00, priceChange: 2.1 },
    WETH: { price: 2025.53, priceChange: 1.5 },
    SOL: { price: 168.45, priceChange: 3.2 },
    AVAX: { price: 26.32, priceChange: -1.8 },
    DOT: { price: 7.15, priceChange: 0.9 },
    LINK: { price: 12.85, priceChange: 1.7 },
    UNI: { price: 8.47, priceChange: -0.5 },
    AAVE: { price: 93.21, priceChange: 2.3 }
};
  
// Token metadata
const tokens = {
  crypto: [
    { symbol: "ETH", name: "Ethereum", price: 2025.53, address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" },
    { symbol: "BTC", name: "Bitcoin", price: 87324.00, address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6" },
    { symbol: "WETH", name: "Wrapped Ethereum", price: 2025.53, address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" },
    { symbol: "WBTC", name: "Wrapped Bitcoin", price: 87324.00, address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6" },
    { symbol: "MATIC", name: "Polygon", price: 0.238411, address: "0x0000000000000000000000000000000000001010" },
    { symbol: "LINK", name: "Chainlink", price: 12.85, address: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39" },
    { symbol: "UNI", name: "Uniswap", price: 8.47, address: "0xb33EaAd8d922B1083446DC23f610c2567fB5180f" },
    { symbol: "AAVE", name: "Aave", price: 93.21, address: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B" },
    { symbol: "SOL", name: "Solana", price: 168.45, address: "0xsolana_placeholder_address" },
    { symbol: "AVAX", name: "Avalanche", price: 26.32, address: "0xavax_placeholder_address" },
    { symbol: "DOT", name: "Polkadot", price: 7.15, address: "0xdot_placeholder_address" }
  ],
  stablecoin: [
    { symbol: "USDC", name: "USD Coin", price: 1.0, address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" },
    { symbol: "USDT", name: "Tether", price: 1.0, address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
    { symbol: "DAI", name: "Dai Stablecoin", price: 1.0, address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063" },
    { symbol: "SGD", name: "Singapore Dollar", price: 0.74, address: "0xDC3326e71D45186F113a2F448984CA0e8D201995" },
    { symbol: "BUSD", name: "Binance USD", price: 1.0, address: "0xdAb529f40E671A1D4bF91361c21bf9f0C9712ab7" },
    { symbol: "TUSD", name: "TrueUSD", price: 1.0, address: "0x4c19596f5aaff459fa38b0f7ed92f11ae6543784" },
    { symbol: "USDS", name: "USDS", price: 1.0, address: "0x45ac379f019e48ca5dac02d0c261e328a28d2d2a" },
    { symbol: "USDP", name: "Pax Dollar", price: 1.0, address: "0x8e870d67f660d95d5be530380d0ec0bd388289e1" },
    { symbol: "GUSD", name: "Gemini Dollar", price: 1.0, address: "0x056fd409e1d7a124bd7017459dfea2f387b6d5cd" },
    { symbol: "FRAX", name: "Frax", price: 1.0, address: "0x853d955acef822db058eb8505911ed77f175b99e" }
  ]
};
  
// CoinGecko ID to symbol mapping
const coinGeckoIdMap = {
    'bitcoin': 'BTC',
    'ethereum': 'ETH',
    'matic-network': 'MATIC',
    'usd-coin': 'USDC',
    'tether': 'USDT',
    'dai': 'DAI',
    'sgd-tracker': 'SGD',
    'wrapped-bitcoin': 'WBTC',
    'weth': 'WETH',
    'solana': 'SOL',
    'avalanche-2': 'AVAX',
    'polkadot': 'DOT',
    'chainlink': 'LINK',
    'uniswap': 'UNI',
    'aave': 'AAVE'
};
  
// Symbol to CoinGecko ID mapping
const symbolToCoinGeckoId = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'MATIC': 'matic-network',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'DAI': 'dai',
    'SGD': 'sgd-tracker',
    'WBTC': 'wrapped-bitcoin',
    'WETH': 'weth',
    'SOL': 'solana',
    'AVAX': 'avalanche-2',
    'DOT': 'polkadot',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'AAVE': 'aave'
};
  
/**
 * Generate mock price history
 * @param {string} symbol - Token symbol
 * @param {number} days - Number of days of history
 * @returns {Object} - Price history data
 */
const generatePriceHistory = (symbol, days = 7) => {
    const basePrice = tokenPrices[symbol]?.price || 100;
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    const prices = [];
    const market_caps = [];
    const total_volumes = [];
    
    // Generate data points with random fluctuation
    for (let i = days; i >= 0; i--) {
        const timestamp = now - (i * oneDayMs);
        
        // Add random fluctuation (±5%)
        const fluctuation = 0.05;
        const randomFactor = 1 + (Math.random() * fluctuation * 2 - fluctuation);
        const price = basePrice * randomFactor;
        
        prices.push([timestamp, price]);
        market_caps.push([timestamp, price * 1000000000]); // Mock market cap
        total_volumes.push([timestamp, price * 100000000]); // Mock volume
    }
    
    return {
        prices,
        market_caps,
        total_volumes
    };
};
  
/**
 * Search for tokens by query
 * @param {string} query - Search query
 * @param {string} type - Token type filter
 * @returns {Array} - Matching tokens
 */
const searchTokens = (query, type = null) => {
    // Determine which token list to search
    let tokenList;
    if (type === 'stablecoin') {
        tokenList = tokens.stablecoin;
    } else if (type === 'crypto') {
        tokenList = tokens.crypto;
    } else {
        tokenList = [...tokens.crypto, ...tokens.stablecoin];
    }
    
    if (!query) return tokenList;
    
    const lowerQuery = query.toLowerCase();
    return tokenList.filter(token => 
        token.symbol.toLowerCase().includes(lowerQuery) || 
        token.name.toLowerCase().includes(lowerQuery)
    );
};
  
/**
 * Get token price by address
 * @param {string} address - Token address
 * @returns {Object} - Token price data
 */
const getTokenPrice = (address) => {
    // Common token addresses
    const addressMap = {
        "0x0000000000000000000000000000000000001010": { price: 0.238411, symbol: "MATIC" }, // MATIC
        "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": { price: 1.0, symbol: "USDC" }, // USDC
        "0xc2132D05D31c914a87C6611C10748AEb04B58e8F": { price: 1.0, symbol: "USDT" }, // USDT
        "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619": { price: 2025.53, symbol: "WETH" }, // WETH
        "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6": { price: 87324.00, symbol: "WBTC" }, // WBTC
        "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063": { price: 1.0, symbol: "DAI" }, // DAI
        "0xDC3326e71D45186F113a2F448984CA0e8D201995": { price: 0.74, symbol: "SGD" }, // XSGD
        "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39": { price: 12.85, symbol: "LINK" }, // Chainlink
        "0xb33EaAd8d922B1083446DC23f610c2567fB5180f": { price: 8.47, symbol: "UNI" }, // Uniswap
        "0xD6DF932A45C0f255f85145f286eA0b292B21C90B": { price: 93.21, symbol: "AAVE" } // Aave
    };
    
    return addressMap[address] || { price: null, symbol: "UNKNOWN" };
};
  
module.exports = {
    exchangeRates,
    tokenPrices,
    tokens,
    coinGeckoIdMap,
    symbolToCoinGeckoId,
    generatePriceHistory,
    searchTokens,
    getTokenPrice
};