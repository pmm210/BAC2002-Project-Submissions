import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, ProgressBar, Button, Tooltip, OverlayTrigger } from 'react-bootstrap';
import axios from 'axios';
import './TransactionFeesDisplay.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TransactionFeesDisplay = ({ fromToken, toToken, amount, triggerRefresh = false, showComparison = true }) => {
  const [feeData, setFeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFeeData = async () => {
      // Skip if required parameters are missing
      if (!fromToken || !toToken || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        setFeeData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`${API_BASE_URL}/transactions/bundled-rates`, {
          params: {
            from: fromToken,
            to: toToken,
            amount: parseFloat(amount)
          }
        });

        if (response.data) {
          // Process API response to calculate fees
          const data = response.data;
          const usdValue = parseFloat(amount) * (data.exchangeRates?.[fromToken] || 3000);
          
          // Calculate individual fee components
          const gasFeeUsd = parseFloat(data.gasEstimate?.usdCost?.average || 3);
          const swapFeeUsd = usdValue * 0.003; // 0.3% swap fee
          const platformFeeUsd = usdValue * 0.005; // 0.5% platform fee
          const totalFeeUsd = gasFeeUsd + swapFeeUsd + platformFeeUsd;
          
          // Traditional fee would be around 6.2%
          const traditionalFeeUsd = usdValue * 0.062;
          const savings = traditionalFeeUsd - totalFeeUsd;
          
          // Calculate fee percentages of total
          const totalPercentage = (totalFeeUsd / usdValue * 100).toFixed(2);
          const gasPercentage = (gasFeeUsd / totalFeeUsd * 100).toFixed(2);
          const swapPercentage = (swapFeeUsd / totalFeeUsd * 100).toFixed(2);
          const platformPercentage = (platformFeeUsd / totalFeeUsd * 100).toFixed(2);
          
          // Add the fee breakdown to the data
          const processedData = {
            ...data,
            fees: {
              gas: gasFeeUsd,
              swap: swapFeeUsd,
              platform: platformFeeUsd,
              total: totalFeeUsd,
              traditional: traditionalFeeUsd,
              savings: savings,
              percentage: totalPercentage,
              distribution: {
                gas: gasPercentage,
                swap: swapPercentage,
                platform: platformPercentage
              }
            }
          };
          
          setFeeData(processedData);
        }
      } catch (error) {
        console.error("Error fetching fee data:", error);
        setError("Could not fetch fee information. Using estimated values.");
        
        // Provide fallback data when API fails
        const usdValue = parseFloat(amount) * (fromToken === "ETH" ? 3000 : 1); // Rough estimate
        
        // Simple fallback calculations
        const gasFeeUsd = Math.min(5, usdValue * 0.01); // 1% or max $5
        const swapFeeUsd = usdValue * 0.003; // 0.3% swap fee
        const platformFeeUsd = usdValue * 0.005; // 0.5% platform fee
        const totalFeeUsd = gasFeeUsd + swapFeeUsd + platformFeeUsd;
        
        // Traditional fee would be around 6.2%
        const traditionalFeeUsd = usdValue * 0.062;
        const savings = traditionalFeeUsd - totalFeeUsd;
        
        // Conversion rate for display
        const conversionRate = fromToken === toToken ? 1 : 
                               (fromToken === "ETH" && toToken === "USDC") ? 3000 :
                               (fromToken === "USDC" && toToken === "ETH") ? 1/3000 : 1;
                               
        // Calculate fee percentages of total
        const totalPercentage = (totalFeeUsd / usdValue * 100).toFixed(2);
        const gasPercentage = (gasFeeUsd / totalFeeUsd * 100).toFixed(2);
        const swapPercentage = (swapFeeUsd / totalFeeUsd * 100).toFixed(2);
        const platformPercentage = (platformFeeUsd / totalFeeUsd * 100).toFixed(2);
        
        setFeeData({
          timestamp: new Date().toISOString(),
          gasEstimate: {
            average: 70,
            usdCost: {
              average: gasFeeUsd.toFixed(2)
            }
          },
          conversion: {
            from: fromToken,
            to: toToken,
            amount: parseFloat(amount),
            convertedAmount: parseFloat(amount) * conversionRate
          },
          fees: {
            gas: gasFeeUsd,
            swap: swapFeeUsd,
            platform: platformFeeUsd,
            total: totalFeeUsd,
            traditional: traditionalFeeUsd,
            savings: savings,
            percentage: totalPercentage,
            distribution: {
              gas: gasPercentage,
              swap: swapPercentage,
              platform: platformPercentage
            }
          },
          marketConditions: {
            favorable: true,
            message: "Current market conditions are favorable for this transaction."
          },
          _source: 'fallback'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFeeData();
  }, [fromToken, toToken, amount, triggerRefresh]);

  // Helper functions for formatting
  const formatNumber = (value, decimals = 2) => {
    if (value === undefined || value === null) return 'N/A';
    return Number(value).toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const formatUsd = (value) => {
    if (value === undefined || value === null) return '$0.00';
    return `$${formatNumber(value, 2)}`;
  };

  // Tooltip rendering function
  const renderTooltip = (content) => (props) => (
    <Tooltip id="fee-tooltip" {...props}>
      {content}
    </Tooltip>
  );

  // Don't render anything if there's not enough data
  if (!fromToken || !toToken || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return (
      <Card className="mb-4">
        <Card.Header>Transaction Fee Breakdown</Card.Header>
        <Card.Body className="text-center text-muted">
          <p>Select tokens and enter amount to see fee breakdown</p>
        </Card.Body>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="mb-4">
        <Card.Header>Transaction Fee Breakdown</Card.Header>
        <Card.Body className="text-center">
          <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span>Calculating fees...</span>
        </Card.Body>
      </Card>
    );
  }

  if (error && !feeData) {
    return (
      <Card className="mb-4 fee-display-card border-warning">
        <Card.Body>
          <Card.Title>Fee Information Unavailable</Card.Title>
          <p className="text-muted">{error}</p>
        </Card.Body>
      </Card>
    );
  }

  if (feeData) {
    const { fees } = feeData;
    
    // Format the total percentage with badge
    const totalBadge = (
      <Badge bg="success" className="ms-2">
        Total: {fees.percentage}% ({formatUsd(fees.total)})
      </Badge>
    );
    
    return (
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Transaction Fee Breakdown</h5>
          {totalBadge}
        </Card.Header>
        <Card.Body>
          {error && (
            <div className="alert alert-warning">{error}</div>
          )}
          
          {/* Market Conditions Alert */}
          {feeData.marketConditions && (
            <div className="alert alert-success mb-3">
              <strong>Favorable Market Conditions</strong>
              <p className="mb-0">{feeData.marketConditions.message}</p>
            </div>
          )}
          
          {/* Gas Fee Options */}
          <Row className="mb-3">
            <Col xs={12}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-secondary me-2" style={{ width: '20px', height: '20px' }}></div>
                  <span>Network Gas Fee</span>
                </div>
                <span className="fw-bold">{formatUsd(fees.gas)}</span>
              </div>
              
              {/* Gas Speed Options */}
              <div className="gas-options bg-light p-2 rounded">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted">Slow</span>
                  <div>
                    <Badge bg="light" text="dark" className="border">
                      {feeData.gasEstimate?.slow || 50} gwei
                    </Badge>
                    <span className="ms-2 text-muted">
                      (${formatNumber(feeData.gasEstimate?.usdCost?.slow || fees.gas * 0.7, 2)})
                    </span>
                  </div>
                </div>
                
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted">Average</span>
                  <div>
                    <Badge bg="primary">
                      {feeData.gasEstimate?.average || 70} gwei
                    </Badge>
                    <span className="ms-2 text-muted">
                      (${formatNumber(feeData.gasEstimate?.usdCost?.average || fees.gas, 2)})
                    </span>
                  </div>
                </div>
                
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted">Fast</span>
                  <div>
                    <Badge bg="success">
                      {feeData.gasEstimate?.fast || 90} gwei
                    </Badge>
                    <span className="ms-2 text-muted">
                      (${formatNumber(feeData.gasEstimate?.usdCost?.fast || fees.gas * 1.3, 2)})
                    </span>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
          
          <Row className="mb-3 align-items-center">
            <Col xs={4} md={3}>
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-primary me-2" style={{ width: '20px', height: '20px' }}></div>
                <span>Swap Fee (0.3%)</span>
              </div>
            </Col>
            <Col xs={8} md={9} className="text-end">
              <span className="fw-bold">{formatUsd(fees.swap)}</span>
            </Col>
          </Row>
          
          <Row className="mb-3 align-items-center">
            <Col xs={4} md={3}>
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-success me-2" style={{ width: '20px', height: '20px' }}></div>
                <span>Platform Fee (0.5%)</span>
              </div>
            </Col>
            <Col xs={8} md={9} className="text-end">
              <span className="fw-bold">{formatUsd(fees.platform)}</span>
            </Col>
          </Row>
          
          {/* Fee Distribution Bar */}
          <Row className="mb-4">
            <Col xs={12}>
              <div className="text-muted mb-2">Fee Distribution</div>
              <div className="fee-breakdown-bar">
                <div 
                  className="fee-component fee-gas" 
                  style={{ width: `${fees.distribution.gas}%` }}
                  title={`Network Gas: ${fees.distribution.gas}%`}
                >
                  {fees.distribution.gas > 15 ? `${formatUsd(fees.gas)}` : ""}
                </div>
                <div 
                  className="fee-component fee-swap" 
                  style={{ width: `${fees.distribution.swap}%` }}
                  title={`Swap Fee: ${fees.distribution.swap}%`}
                >
                  {fees.distribution.swap > 15 ? `${formatUsd(fees.swap)}` : ""}
                </div>
                <div 
                  className="fee-component fee-platform" 
                  style={{ width: `${fees.distribution.platform}%` }}
                  title={`Platform Fee: ${fees.distribution.platform}%`}
                >
                  {fees.distribution.platform > 15 ? `${formatUsd(fees.platform)}` : ""}
                </div>
              </div>
              <div className="text-end mt-1">
                <small className="text-muted">{formatUsd(fees.total)} total</small>
              </div>
            </Col>
          </Row>
          
          {/* Transaction Summary */}
          <div className="fee-summary-container rounded bg-light p-3 mb-4">
            <Row>
              <Col md={4} className="mb-3 mb-md-0">
                <div className="fee-summary-item">
                  <div className="text-muted mb-1">You Send</div>
                  <div className="h5 mb-0">
                    {formatNumber(feeData.conversion?.amount)} {fromToken}
                  </div>
                  <div className="small text-muted">
                    ≈ {formatUsd(parseFloat(amount) * (feeData.exchangeRates?.[fromToken] || 3000))}
                  </div>
                </div>
              </Col>
              <Col md={4} className="mb-3 mb-md-0">
                <div className="fee-summary-item text-center">
                  <div className="text-muted mb-1">Fees</div>
                  <div className="h5 mb-0">
                    {fees.percentage}%
                  </div>
                  <div className="small text-muted">
                    {formatUsd(fees.total)}
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <div className="fee-summary-item text-end">
                  <div className="text-muted mb-1">Recipient Gets</div>
                  <div className="h5 mb-0">
                    {formatNumber(feeData.conversion?.convertedAmount)} {toToken}
                  </div>
                  <div className="small text-muted">
                    Exchange Rate: 1 {fromToken} = {formatNumber(feeData.conversion?.rate || 1)} {toToken}
                  </div>
                </div>
              </Col>
            </Row>
          </div>
          
          {/* Comparison with traditional remittance */}
          {showComparison && (
            <div className="mt-3">
              <h6>Comparison with Traditional Remittance</h6>
              
              <Row className="mb-2">
                <Col xs={12}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span>Traditional (avg 6.2%)</span>
                    <span className="fw-bold">{formatUsd(fees.traditional)}</span>
                  </div>
                  <ProgressBar 
                    variant="secondary" 
                    now={100} 
                    style={{ height: '12px' }}
                  />
                </Col>
              </Row>
              
              <Row className="mb-3">
                <Col xs={12}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span>Our Platform ({fees.percentage}%)</span>
                    <span className="fw-bold">{formatUsd(fees.total)}</span>
                  </div>
                  <ProgressBar 
                    variant="success" 
                    now={fees.total / fees.traditional * 100} 
                    style={{ height: '12px' }}
                  />
                </Col>
              </Row>
              
              <div className="saving-highlight text-center bg-success bg-opacity-10 rounded p-2 mt-3">
                <div>You save approximately <span className="fw-bold text-success">{formatUsd(fees.savings)}</span> with our platform!</div>
                <div className="small">({formatNumber(fees.savings / fees.traditional * 100, 0)}% less in fees)</div>
              </div>
            </div>
          )}
          
          <div className="mt-3 d-flex justify-content-end">
            <Button 
              variant="outline-secondary" 
              size="sm" 
              onClick={() => setLoading(true)}
            >
              Refresh
            </Button>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return null;
};

export default TransactionFeesDisplay;