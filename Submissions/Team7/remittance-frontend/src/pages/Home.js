import React from "react";
import { Container, Card, Button, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";
import ExchangeRatesDisplay from "../components/ExchangeRatesDisplay";
import PageWrapper from "../components/PageWrapper";

const Home = ({ user }) => {
  return (
    <PageWrapper>
      <Container className="py-4">
        <h1 className="mb-4">Welcome, {user?.username || "User"}!</h1>
        
        <div className="mb-4">
          <h2>Market Overview</h2>
          <p className="lead">
            View the latest cryptocurrency exchange rates. To transfer money, please use the New Transfer page.
          </p>
          
          <div className="mb-4">
            <Link to="/send-money">
              <Button variant="primary">New Transfer</Button>
            </Link>
          </div>
        </div>
        
        {/* Exchange Rates Display */}
        <ExchangeRatesDisplay />
        
        {/* Fee Advantage Card */}
        <Card className="mt-4 mb-4 border-0 bg-primary bg-opacity-10">
          <Card.Body>
            <Card.Title className="fs-4 mb-3">One-Stop Solution: Bundled Fees in a Single Transaction</Card.Title>
            
            <Row className="align-items-center">
              <Col md={7}>
                <h5 className="text-primary">Traditional Remittance Process:</h5>
                <ol className="mb-4">
                  <li>Deposit money (fee #1)</li>
                  <li>Currency conversion (fee #2 + exchange rate markup)</li>
                  <li>International transfer (fee #3)</li>
                  <li>Withdrawal for recipient (fee #4)</li>
                  <li><strong>Total: 4 separate fees + waiting time between steps</strong></li>
                </ol>
                
                <h5 className="text-primary">Our Platform's Approach:</h5>
                <ol className="mb-4">
                  <li>Select any cryptocurrency and recipient</li>
                  <li>Our smart contract automatically handles conversion and transfer</li>
                  <li>Single low fee (0.5% platform fee + minimal network costs)</li>
                  <li><strong>Everything happens in one atomic transaction</strong></li>
                </ol>
                
                <p>Our platform uses blockchain technology to bundle conversion and transfer into a single transaction, dramatically reducing fees and processing time compared to traditional remittance services.</p>
              </Col>
              <Col md={5}>
                <div className="fee-comparison-graphic text-center p-3 bg-white rounded shadow-sm">
                  <div className="fee-comparison-item mb-4">
                    <h6 className="text-danger">Traditional Method</h6>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="fee-step">Fee #1</div>
                      <div className="fee-arrow">→</div>
                      <div className="fee-step">Fee #2</div>
                      <div className="fee-arrow">→</div>
                      <div className="fee-step">Fee #3</div>
                      <div className="fee-arrow">→</div>
                      <div className="fee-step">Fee #4</div>
                    </div>
                    <div className="text-danger fw-bold">Average Total: 6.2% of transfer amount</div>
                    <div className="text-muted">1-5 days processing time</div>
                  </div>
                  
                  <div className="fee-comparison-item">
                    <h6 className="text-success">Our Platform</h6>
                    <div className="d-flex justify-content-center align-items-center mb-2">
                      <div className="fee-bundled">All steps in one transaction</div>
                    </div>
                    <div className="text-success fw-bold">Average Total: 0.5-1% of transfer amount</div>
                    <div className="text-muted">Processing time: minutes</div>
                  </div>
                </div>
              </Col>
            </Row>
            
            <div className="text-center mt-3">
              <Link to="/send-money">
                <Button variant="primary">Experience Bundled Transactions Now</Button>
              </Link>
            </div>
          </Card.Body>
        </Card>
        
        {/* Educational Card */}
        <Card className="mt-4 bg-light border-0">
          <Card.Body>
            <Card.Title>Why Use Our Platform?</Card.Title>
            <Card.Text>
              Traditional remittance services charge high fees (averaging 6.2%) and often have hidden currency conversion costs.
              Our blockchain-based platform eliminates intermediaries and significantly reduces operational costs, 
              allowing us to offer much lower fees while maintaining instant or near-instant transfers.
            </Card.Text>
            
            <Card.Text className="mb-0">
              <strong>Key Benefits:</strong>
            </Card.Text>
            <ul>
              <li><strong>Lower fees</strong> - Save up to 92% compared to traditional services</li>
              <li><strong>Faster transfers</strong> - Receive funds in minutes instead of days</li>
              <li><strong>Transparency</strong> - See real-time exchange rates and gas fees</li>
              <li><strong>Market alerts</strong> - Get notified when market conditions are favorable</li>
            </ul>
            
            <Link to="/faq">
              <Button variant="outline-primary" size="sm">Learn More in FAQ</Button>
            </Link>
          </Card.Body>
        </Card>
      </Container>
      
      <style jsx="true">{`
        .fee-step {
          background-color: #f8d7da;
          border: 1px solid #f5c2c7;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .fee-arrow {
          color: #dc3545;
          font-weight: bold;
        }
        
        .fee-bundled {
          background-color: #d1e7dd;
          border: 1px solid #badbcc;
          padding: 12px 20px;
          border-radius: 4px;
          font-weight: bold;
          width: 80%;
        }
        
        .fee-comparison-graphic {
          max-width: 400px;
          margin: 0 auto;
        }
      `}</style>
    </PageWrapper>
  );
};

export default Home;