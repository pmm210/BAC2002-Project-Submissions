import React, { useState, useEffect, useRef } from 'react';
import { Spinner, Badge } from 'react-bootstrap';
import axios from 'axios';
import './TokenSelector.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TokenSelector = ({ 
  onSelect, 
  defaultToken, 
  type = "crypto",  // "crypto" or "stablecoin"
  placeholder = "Search for a token",
  showFullDropdown = false,
  disabled = false,
  id = Math.random().toString(36).substring(2, 10) // Unique ID for each instance
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState(defaultToken || null);
  const [showResults, setShowResults] = useState(false);
  const [exchangeRates, setExchangeRates] = useState({});
  const selectorRef = useRef(null);

  // Default popular tokens for Polygon Amoy Testnet
  const defaultPolygonCryptos = [
    { symbol: "BTC", name: "Bitcoin", price: 83745.00, address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6" },
    { symbol: "ETH", name: "Ethereum", price: 2025.53, address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
    { symbol: "MATIC", name: "Polygon", price: 0.24, address: "0x0000000000000000000000000000000000001010" },
    { symbol: "WETH", name: "Wrapped Ethereum", price: 2025.53, address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" },
    { symbol: "WMATIC", name: "Wrapped Matic", price: 0.24, address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" },
    { symbol: "LINK", name: "Chainlink", price: 13.75, address: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39" },
    { symbol: "AAVE", name: "Aave", price: 92.50, address: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B" }
  ];

  const defaultPolygonStablecoins = [
    { symbol: "USDC", name: "USD Coin", price: 1.00, address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" },
    { symbol: "USDT", name: "Tether", price: 1.00, address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
    { symbol: "DAI", name: "Dai Stablecoin", price: 1.00, address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063" },
    { symbol: "BUSD", name: "Binance USD", price: 1.00, address: "0xdAb529f40E671A1D4bF91361c21bf9f0C9712ab7" }
  ];

  // Known supported tokens on Polygon Amoy Testnet
  const polygonAmoyTestnetTokens = {
    // Bitcoin representation on Polygon
    "BTC": { address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", decimals: 18 },
    "WBTC": { address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", decimals: 8 },
    
    // Native token
    "ETH": { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    "MATIC": { address: "0x0000000000000000000000000000000000001010", decimals: 18 },
    
    // ERC-20 tokens that are commonly available on Polygon testnet
    "WETH": { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18 },
    "WMATIC": { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", decimals: 18 },
    "USDC": { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
    "USDT": { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    "DAI": { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
    "LINK": { address: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", decimals: 18 },
    "AAVE": { address: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B", decimals: 18 },
    "BUSD": { address: "0xdAb529f40E671A1D4bF91361c21bf9f0C9712ab7", decimals: 18 },
    "TUSD": { address: "0x4c19596f5aaff459fa38b0f7ed92f11ae6543784", decimals: 18 }
  };

  // Check if a token is supported on Polygon Amoy Testnet
  const isTokenSupported = (symbol) => {
    return polygonAmoyTestnetTokens.hasOwnProperty(symbol.toUpperCase());
  };

  // Get token address for a symbol
  const getTokenAddress = (symbol) => {
    const tokenInfo = polygonAmoyTestnetTokens[symbol.toUpperCase()];
    return tokenInfo ? tokenInfo.address : null;
  };

  // Load initial token list and exchange rates
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      
      try {
        // Fetch exchange rates to get token prices
        const ratesResponse = await axios.get(`${API_BASE_URL}/transactions/exchange-rates`);
        const exchangeRates = ratesResponse.data;
        setExchangeRates(exchangeRates);
        
        console.log("Exchange rates fetched:", exchangeRates);
        
        // Dynamically create token list based on exchange rates
        const exchangeRateTokens = Object.keys(exchangeRates).map(symbol => {
          // If this token exists in our supported tokens list
          if (isTokenSupported(symbol)) {
            return {
              symbol,
              name: getTokenName(symbol),
              price: exchangeRates[symbol],
              address: getTokenAddress(symbol)
            };
          }
          return null;
        }).filter(token => token !== null);
        
        console.log("Tokens created from exchange rates:", exchangeRateTokens);
        
        // Filter out stablecoin or crypto tokens based on type
        const filteredExchangeTokens = exchangeRateTokens.filter(token => 
          type === "stablecoin" ? isStablecoin(token.symbol) : !isStablecoin(token.symbol)
        );
        
        // If we have tokens from exchange rates, use them
        if (filteredExchangeTokens.length > 0) {
          setTokens(filteredExchangeTokens);
          setFilteredTokens(filteredExchangeTokens);
          
          // Set default token if not provided
          if (!defaultToken && filteredExchangeTokens.length > 0) {
            // Default token selection based on type
            let preferredDefault = type === "stablecoin" ? "USDC" : "ETH";
            let foundToken = filteredExchangeTokens.find(t => t.symbol === preferredDefault);
            
            // Fallback to first token if preferred default not found
            if (!foundToken) {
              foundToken = filteredExchangeTokens[0];
            }
            
            setSelectedToken(foundToken);
            if (onSelect) onSelect(foundToken);
          }
        } else {
          // Fall back to static lists if no tokens were found
          const defaultList = type === "stablecoin" ? defaultPolygonStablecoins : defaultPolygonCryptos;
          
          // Enhance tokens with prices from exchange rates or use default prices
          const tokensWithPrices = defaultList.map(token => {
            const apiPrice = exchangeRates[token.symbol];
            return {
              ...token,
              // Use API price if available and valid, otherwise use the default price
              price: apiPrice !== undefined && apiPrice > 0 ? apiPrice : token.price
            };
          });
          
          setTokens(tokensWithPrices);
          setFilteredTokens(tokensWithPrices);
          
          // Set default token if not provided
          if (!defaultToken && tokensWithPrices.length > 0) {
            // Default token selection based on type
            let preferredDefault = type === "stablecoin" ? "USDC" : "ETH";
            let foundToken = tokensWithPrices.find(t => t.symbol === preferredDefault);
            
            // Fallback to first token if preferred default not found
            if (!foundToken) {
              foundToken = tokensWithPrices[0];
            }
            
            setSelectedToken(foundToken);
            if (onSelect) onSelect(foundToken);
          }
        }
      } catch (error) {
        console.error('Error loading initial token data:', error);
        
        // Fallback to default lists with their hardcoded prices
        const defaultList = type === "stablecoin" ? defaultPolygonStablecoins : defaultPolygonCryptos;
        setTokens(defaultList);
        setFilteredTokens(defaultList);
        
        // Set a default token if needed
        if (!defaultToken && defaultList.length > 0) {
          const fallbackToken = defaultList[0];
          setSelectedToken(fallbackToken);
          if (onSelect) onSelect(fallbackToken);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, defaultToken, onSelect]);

  // Set selected token when default token changes
  useEffect(() => {
    if (defaultToken) {
      setSelectedToken(defaultToken);
    }
  }, [defaultToken]);

  // Search for tokens when search term changes
  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      // Reset to default list when search is cleared
      setFilteredTokens(tokens);
      return;
    }
    
    const searchTokens = async () => {
      try {
        setLoading(true);
        
        // Only search if term is at least 2 chars
        if (searchTerm.length < 2) {
          const filtered = tokens.filter(token => 
            token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
            token.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
          setFilteredTokens(filtered);
          setLoading(false);
          return;
        }
        
        // First, check if the search term matches any known supported tokens
        const searchTermUpper = searchTerm.toUpperCase();
        const knownTokenSymbols = Object.keys(polygonAmoyTestnetTokens);
        
        const matchingTokens = knownTokenSymbols
          .filter(symbol => 
            (type === "stablecoin" ? isStablecoin(symbol) : !isStablecoin(symbol)) && 
            symbol.includes(searchTermUpper)
          )
          .map(symbol => {
            // Get token info
            const tokenInfo = polygonAmoyTestnetTokens[symbol];
            // Get price from exchange rates or use a default
            const price = exchangeRates[symbol] || 
                        (isStablecoin(symbol) ? 1.00 : null);
            
            return {
              symbol,
              name: getTokenName(symbol),
              address: tokenInfo.address,
              price
            };
          });
          
        if (matchingTokens.length > 0) {
          setFilteredTokens(matchingTokens);
          setLoading(false);
          return;
        }
        
        // If no known tokens match, try the API
        try {
          const response = await axios.get(`${API_BASE_URL}/transactions/tokens`, {
            params: { 
              query: searchTerm,
              type: type
            }
          });
          
          // Filter to only return supported tokens on Polygon Amoy
          let searchResults = response.data;
          searchResults = searchResults
            .filter(token => isTokenSupported(token.symbol))
            .map(token => ({
              ...token,
              address: getTokenAddress(token.symbol),
              price: exchangeRates[token.symbol.toUpperCase()] || 
                    (isStablecoin(token.symbol) ? 1.00 : null)
            }));
          
          setFilteredTokens(searchResults);
        } catch (apiError) {
          console.warn('API token search failed, using local filter:', apiError);
          // Fall back to local filtering of known tokens
          setFilteredTokens(matchingTokens);
        }
      } catch (error) {
        console.error('Error searching tokens:', error);
        
        // Fallback to local filtering on error
        const filtered = tokens.filter(token => 
          token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
          token.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredTokens(filtered);
      } finally {
        setLoading(false);
      }
    };
    
    const debounceSearch = setTimeout(() => {
      searchTokens();
    }, 300); // Debounce search to avoid too many requests
    
    return () => clearTimeout(debounceSearch);
  }, [searchTerm, tokens, type, exchangeRates]);

  // Helper to determine if a token is a stablecoin
  const isStablecoin = (symbol) => {
    const stablecoins = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USDS', 'USDP', 'GUSD', 'FRAX'];
    return stablecoins.includes(symbol.toUpperCase()) || symbol.toUpperCase().includes('USD');
  };

  // Helper to get a human-readable token name
  const getTokenName = (symbol) => {
    const nameMap = {
      'BTC': 'Bitcoin',
      'WBTC': 'Wrapped Bitcoin',
      'ETH': 'Ethereum',
      'MATIC': 'Polygon',
      'WETH': 'Wrapped Ethereum',
      'WMATIC': 'Wrapped Matic',
      'USDC': 'USD Coin',
      'USDT': 'Tether',
      'DAI': 'Dai Stablecoin',
      'BUSD': 'Binance USD',
      'LINK': 'Chainlink',
      'AAVE': 'Aave',
      'TUSD': 'True USD'
    };
    
    return nameMap[symbol.toUpperCase()] || symbol;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle dropdown state across multiple TokenSelectors
  useEffect(() => {
    if (showResults) {
      // When opening this dropdown, close all other dropdowns
      const event = new CustomEvent('token-selector-opened', { detail: { id } });
      document.dispatchEvent(event);
    }
    
    // Listen for other dropdowns opening
    const handleOtherDropdownOpen = (event) => {
      // If another dropdown opened (not this one), close this one
      if (event.detail.id !== id && showResults) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('token-selector-opened', handleOtherDropdownOpen);
    
    return () => {
      document.removeEventListener('token-selector-opened', handleOtherDropdownOpen);
    };
  }, [id, showResults]);

  const handleTokenSelect = (token) => {
    // If user selects a custom token, make sure it has a proper address if it's a known token
    if (token && token.symbol && !token.address) {
      const address = getTokenAddress(token.symbol);
      if (address) {
        token.address = address;
      }
    }
    
    setSelectedToken(token);
    setShowResults(false);
    setSearchTerm('');
    if (onSelect) onSelect(token);
  };

  const handleToggleDropdown = () => {
    if (disabled) return;
    
    // Toggle dropdown state
    setShowResults(!showResults);
  };

  // Get token icon/emoji based on symbol
  const getTokenIcon = (symbol = '') => {
    const iconMap = {
      "BTC": "₿",
      "WBTC": "₿",
      "ETH": "Ξ",
      "WETH": "Ξ",
      "MATIC": "⬡",
      "WMATIC": "⬡",
      "USDC": "⚪",
      "USDT": "₮",
      "BUSD": "💲",
      "TUSD": "🌟",
      "DAI": "◈",
      "USDS": "💵",
      "USDP": "💲",
      "GUSD": "💲",
      "FRAX": "💲",
      "SGD": "🇸🇬",
      "SOL": "◎",
      "AVAX": "🔺",
      "DOT": "●",
      "LINK": "⚓",
      "NEAR": "Ⓝ",
      "UNI": "🦄",
      "AAVE": "👻"
    };
    
    return iconMap[symbol.toUpperCase()] || "🪙";
  };

  // Get category/type badge for a token
  const getTokenCategory = (token) => {
    // Map of token symbols to categories
    const categoryMap = {
      // Crypto
      "BTC": "Crypto",
      "WBTC": "Wrapped",
      // Native
      "ETH": "Native",
      "MATIC": "Native",
      // Stablecoins
      "USDT": "Stablecoin",
      "USDC": "Stablecoin",
      "DAI": "Stablecoin",
      "BUSD": "Stablecoin",
      "TUSD": "Stablecoin",
      "USDS": "Stablecoin",
      "USDP": "Stablecoin",
      "GUSD": "Stablecoin",
      "FRAX": "Stablecoin",
      // Fiat-backed
      "SGD": "Fiat-backed",
      // Wrapped
      "WETH": "Wrapped",
      "WMATIC": "Wrapped",
      // DeFi
      "LINK": "DeFi",
      "AAVE": "DeFi",
      // Default
      "default": token && type === "stablecoin" ? "Stablecoin" : "Token"
    };
    
    return token?.symbol ? (categoryMap[token.symbol.toUpperCase()] || categoryMap.default) : "";
  };

  // Format price for display
  const formatPrice = (price) => {
    if (price === undefined || price === null) return null;
    
    try {
      const numPrice = parseFloat(price);
      
      if (isNaN(numPrice)) return null;
      
      if (numPrice > 1000) {
        return numPrice.toLocaleString(undefined, { maximumFractionDigits: 0 });
      } else if (numPrice > 1) {
        return numPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        return numPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
      }
    } catch (e) {
      return null;
    }
  };

  return (
    <div 
      className={`token-selector-container ${type}`} 
      ref={selectorRef} 
      id={`token-selector-${id}`} 
      data-type={type}
    >
      {/* Selected token display */}
      <div 
        className={`token-selected-display ${disabled ? 'disabled' : ''}`}
        onClick={handleToggleDropdown}
      >
        {selectedToken ? (
          <>
            <span className="token-icon">{getTokenIcon(selectedToken.symbol)}</span>
            <span className="token-symbol">{selectedToken.symbol}</span>
            {selectedToken.price && (
              <Badge bg="light" text="dark" className="token-price">
                ${formatPrice(selectedToken.price)}
              </Badge>
            )}
          </>
        ) : (
          <span className="token-symbol">{type === "stablecoin" ? "Select stablecoin" : "Select token"}</span>
        )}
        <span className="dropdown-arrow">{showResults ? '▲' : '▼'}</span>
      </div>

      {/* Search and dropdown */}
      {showResults && (
        <div className="token-dropdown-container">
          <div className="token-search-container">
            <input
              type="text"
              className="token-search-input"
              placeholder={`Search for ${type === "stablecoin" ? "stablecoins" : "tokens"}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()} // Prevent dropdown from closing
            />
          </div>

          <div className="token-list-container">
            {loading ? (
              <div className="token-loading">
                <Spinner animation="border" size="sm" />
                <span>Loading tokens...</span>
              </div>
            ) : filteredTokens.length > 0 ? (
              filteredTokens.map((token, index) => (
                <div
                  key={`${token.symbol}-${index}`} // Using index to handle potential duplicates
                  className={`token-list-item ${selectedToken?.symbol === token.symbol ? 'selected' : ''}`}
                  onClick={() => handleTokenSelect(token)}
                >
                  <span className="token-icon">{getTokenIcon(token.symbol)}</span>
                  <div className="token-info">
                    <span className="token-symbol">{token.symbol}</span>
                    <span className="token-name">{token.name || token.symbol}</span>
                  </div>
                  <div className="token-metadata">
                    {getTokenCategory(token) && (
                      <Badge 
                        bg={isStablecoin(token.symbol) ? "success" : "info"} 
                        className="category-badge me-2"
                      >
                        {getTokenCategory(token)}
                      </Badge>
                    )}
                    <span className="token-price">
                      {token.price !== undefined && token.price !== null ? 
                        `$${formatPrice(token.price)}` : 
                        'Price N/A'}
                    </span>
                  </div>
                  {selectedToken?.symbol === token.symbol && (
                    <span className="token-selected-check">✓</span>
                  )}
                </div>
              ))
            ) : (
              <div className="token-no-results">
                {searchTerm.length > 0 ? (
                  <>
                    <div>No supported tokens found for "{searchTerm}"</div>
                    <div className="mt-2 small text-muted">
                      Only tokens available on Polygon Amoy Testnet are supported
                    </div>
                  </>
                ) : (
                  <div>No {type === "stablecoin" ? "stablecoins" : "tokens"} found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector;