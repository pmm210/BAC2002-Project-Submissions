import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-light py-3 mt-auto">
      <Container>
        <Row className="align-items-center">
          <Col className="text-center">
            <p className="text-muted small mb-0">
              &copy; {currentYear} Remittance Platform. All rights reserved.
            </p>
            <ul className="list-inline mb-0 mt-2">
              <li className="list-inline-item">
                <Link to="/faq" className="text-decoration-none text-muted">FAQ</Link>
              </li>
            </ul>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;