import React from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import PageWrapper from "../components/PageWrapper";

const LandingPage = () => {
  return (
    <PageWrapper>
      <Container className="mt-5">
        <Row className="mb-5">
          <Col md={6}>
            <h1 className="display-4 mb-4">Fast & Secure Cross-Border Payments</h1>
            <p className="lead">
              Send money internationally with lower fees and faster processing times using
              blockchain technology.
            </p>
            <p className="mb-4">
              Our platform automatically converts any cryptocurrency into the stablecoin of your choice,
              making international remittances simpler and more affordable than traditional methods.
            </p>
            <div className="d-flex gap-3">
              <Link to="/register">
                <Button size="lg" variant="primary">Get Started</Button>
              </Link>
            </div>
          </Col>
          <Col md={6} className="d-flex align-items-center justify-content-center">
            <img 
              src="/crypto.png"
              alt="Global Remittance" 
              className="img-fluid"
              style={{ maxHeight: "350px" }}
            />
          </Col>
        </Row>

        <h2 className="text-center mb-4">How It Works</h2>
        <Row className="mb-5">
          <Col md={4}>
            <Card className="h-100 shadow-sm">
              <Card.Body className="d-flex flex-column">
                <div className="text-center mb-3">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: "60px", height: "60px" }}>
                    <h3 className="m-0">1</h3>
                  </div>
                </div>
                <Card.Title className="text-center">Connect Your Wallet</Card.Title>
                <Card.Text>
                  Securely connect your cryptocurrency wallet using MetaMask.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 shadow-sm">
              <Card.Body className="d-flex flex-column">
                <div className="text-center mb-3">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: "60px", height: "60px" }}>
                    <h3 className="m-0">2</h3>
                  </div>
                </div>
                <Card.Title className="text-center">Select Assets</Card.Title>
                <Card.Text>
                  Choose which cryptocurrency to send and which stablecoin the recipient should receive.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 shadow-sm">
              <Card.Body className="d-flex flex-column">
                <div className="text-center mb-3">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: "60px", height: "60px" }}>
                    <h3 className="m-0">3</h3>
                  </div>
                </div>
                <Card.Title className="text-center">Instant Transfer</Card.Title>
                <Card.Text>
                  Our platform handles the conversion and transfer in a single transaction, saving time and fees.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <h2 className="text-center mb-4">Why Choose Our Platform?</h2>
        <Row className="mb-5">
          <Col md={3}>
            <Card className="h-100 border-0 bg-light">
              <Card.Body className="text-center">
                <h1 className="display-4 text-primary">6.2%</h1>
                <p>Average traditional remittance fees</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="h-100 border-0 bg-light">
              <Card.Body className="text-center">
                <h1 className="display-4 text-primary">0.5%</h1>
                <p>Our platform's average fee</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="h-100 border-0 bg-light">
              <Card.Body className="text-center">
                <h1 className="display-4 text-primary">1-5</h1>
                <p>Days for traditional transfers</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="h-100 border-0 bg-light">
              <Card.Body className="text-center">
                <h1 className="display-4 text-primary">&lt;10</h1>
                <p>Minutes for our transfers</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <div className="text-center mb-5">
          <h2 className="mb-4">Ready to start sending money globally?</h2>
          <Link to="/register">
            <Button size="lg" variant="primary">Create Account</Button>
          </Link>
        </div>
      </Container>
    </PageWrapper>
  );
};

export default LandingPage;