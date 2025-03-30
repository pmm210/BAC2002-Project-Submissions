import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Alert, Badge, Spinner } from 'react-bootstrap';
import axios from 'axios';
import TokenSparkline from './TokenSparkline';
import './ExchangeRates.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const REFRESH_INTERVAL = 300000; // 5 minutes

const ExchangeRatesDisplay = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exchangeRates, setExchangeRates] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [priceChanges, setPriceChanges] = useState({});
  const [availableTokens, setAvailableTokens] = useState([]);

  // Fetch all necessary data from API
  const fetchData = async () => {
    setLoading(true);
    
    try {
      // Fetch exchange rates
      const ratesResponse = await axios.get(`${API_BASE_URL}/transactions/exchange-rates`);
      const rates = ratesResponse.data;
      setExchangeRates(rates);
      
      // Get all available tokens from the exchange rates
      const tokenSymbols = Object.keys(rates);
      setAvailableTokens(tokenSymbols);
      
      // Fetch price changes from the new API endpoint
      if (tokenSymbols.length > 0) {
        const changesResponse = await axios.get(`${API_BASE_URL}/transactions/tokens-with-changes`, {
          params: { symbols: tokenSymbols.join(',') }
        });
        setPriceChanges(changesResponse.data);
      }
      
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Failed to load market rates. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Set up refresh interval
    const intervalId = setInterval(() => {
      fetchData();
    }, REFRESH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, []);

  // Format price for display
  const formatPrice = (price) => {
    if (price === undefined || price === null) return 'N/A';
    
    try {
      const numPrice = parseFloat(price);
      
      if (isNaN(numPrice)) return 'N/A';
      
      if (numPrice > 1000) {
        return numPrice.toLocaleString(undefined, { maximumFractionDigits: 0 });
      } else if (numPrice > 1) {
        return numPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        return numPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
      }
    } catch (e) {
      return 'N/A';
    }
  };

  // Determine if a token is a stablecoin by its symbol
  const isStablecoin = (symbol) => {
    return /USD|DAI|BUSD|TUSD/.test(symbol);
  };

  // Get an appropriate icon for the token based only on the symbol
  const getTokenIcon = (symbol) => {
    if (symbol.includes('BTC') || symbol === 'BTC') return '₿';
    if (symbol.includes('ETH') || symbol === 'ETH') return 'Ξ';
    if (symbol.includes('MATIC')) return '⬡';
    if (symbol === 'USDC') return '⚪';
    if (symbol === 'USDT') return '₮';
    if (symbol === 'DAI') return '◈';
    if (symbol === 'LINK') return '⚓';
    if (symbol === 'AAVE') return '👻';
    if (symbol.includes('USD') || symbol.includes('DAI') || symbol.includes('BUSD')) return '💲';
    return '🪙'; // Default
  };

  // Determine badge color based on token type
  const getTokenBadgeColor = (symbol) => {
    if (symbol.includes('ETH')) return 'primary';
    if (symbol.includes('MATIC')) return 'info';
    if (isStablecoin(symbol)) return 'success';
    return 'secondary';
  };

  // Get a short description based on the token symbol
  const getTokenDescription = (symbol) => {
    if (symbol === 'ETH') return 'Smart contract platform';
    if (symbol === 'WETH') return 'ERC-20 version of ETH';
    if (symbol === 'MATIC') return 'Ethereum scaling solution';
    if (symbol === 'WMATIC') return 'ERC-20 version of MATIC';
    if (isStablecoin(symbol)) return 'USD-backed stablecoin';
    if (symbol === 'DAI') return 'Decentralized stablecoin';
    if (symbol === 'LINK') return 'Decentralized oracle network';
    if (symbol === 'AAVE') return 'DeFi lending protocol';
    return 'Cryptocurrency';
  };

  // Render token card
  const renderTokenCard = (symbol) => {
    const price = exchangeRates[symbol];
    if (price === undefined) return null;
    
    const icon = getTokenIcon(symbol);
    const badgeColor = getTokenBadgeColor(symbol);
    const description = getTokenDescription(symbol);
    
    const priceChange = priceChanges[symbol] || 0;
    const isPriceUp = parseFloat(priceChange) > 0;
    const isPriceDown = parseFloat(priceChange) < 0;
    
    return (
      <Col key={symbol} xs={6} sm={6} md={4} lg={3} className="mb-3">
        <Card className="token-card h-100">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div className="d-flex align-items-center">
                <span className="token-icon me-2">{icon}</span>
                <span className="token-symbol-large">{symbol}</span>
              </div>
              <Badge bg={badgeColor} className="category-badge">
                {symbol}
              </Badge>
            </div>
            
            <div className="price-container">
              <div className="price-value">
                ${formatPrice(price)}
                <span className={`ms-2 small ${isPriceUp ? 'text-success' : isPriceDown ? 'text-danger' : 'text-muted'}`}>
                  {isPriceUp ? '↑' : isPriceDown ? '↓' : ''}
                  {priceChange}%
                </span>
              </div>
              <div className="text-muted small">{description}</div>
            </div>
            
            {/* Add the sparkline chart with current price */}
            <div className="chart-container mt-2">
              <TokenSparkline 
                symbol={symbol} 
                priceChange={parseFloat(priceChange)}
                currentPrice={parseFloat(price)}
              />
            </div>
          </Card.Body>
        </Card>
      </Col>
    );
  };

  return (
    <Card className="shadow-sm mb-4">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Current Popular Market Rates</h5>
        {lastUpdated && (
          <small className="text-muted">
            Updated: {lastUpdated.toLocaleTimeString()}
            <span className="ms-1">
              (refreshes every {Math.floor(REFRESH_INTERVAL / 60000)} minutes)
            </span>
          </small>
        )}
      </Card.Header>
      
      <Card.Body>
        {error ? (
          <Alert variant="danger">{error}</Alert>
        ) : (
          <>
            <Row>
              {availableTokens.map(token => renderTokenCard(token))}
            </Row>
            
            {loading && (
              <div className="text-center my-3">
                <Spinner animation="border" size="sm" role="status" />
                <span className="ms-2">Refreshing market data...</span>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default ExchangeRatesDisplay;