import React from "react";
import { Container, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import PageWrapper from "../components/PageWrapper";

const NotFound = () => {
  return (
    <PageWrapper>
      <Container className="text-center py-5">
        <h1 className="display-1 fw-bold">404</h1>
        <h2 className="mb-4">Page Not Found</h2>
        <p className="lead mb-5">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button variant="primary" size="lg">
            Return to Home
          </Button>
        </Link>
      </Container>
    </PageWrapper>
  );
};

export default NotFound;