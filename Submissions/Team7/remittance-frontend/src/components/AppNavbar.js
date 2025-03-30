import React from "react";
import { Navbar, Nav, Container, Button, Dropdown, Badge } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import WalletManager from "./WalletManager";

const AppNavbar = ({ user, handleLogout }) => {
  const navigate = useNavigate();

  // Handle protected route access attempts while not logged in
  const handleProtectedRouteClick = () => {
    toast.info("Please log in to access this feature", {
      position: "top-center",
      autoClose: 3000
    });
    navigate("/login");
  };

  return (
    <Navbar bg="light" expand="lg" className="shadow-sm">
      <Container>
        {/* Brand links to different places based on auth status */}
        <Navbar.Brand as={Link} to={user ? "/home" : "/"}>
          RemitFlow
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {user ? (
              // Logged in navigation
              <>
                <Nav.Link as={Link} to="/home">Dashboard</Nav.Link>
                <Nav.Link as={Link} to="/send-money">New Transfer</Nav.Link>
                <Nav.Link as={Link} to="/transactions">Transactions</Nav.Link>
                <Nav.Link as={Link} to="/kyc">
                  <Badge bg="warning" className="me-1">New</Badge>
                  Verify Identity
                </Nav.Link>
                <Nav.Link as={Link} to="/faq">FAQ</Nav.Link>
              </>
            ) : (
              // Guest navigation
              <>
                <Nav.Link onClick={handleProtectedRouteClick}>New Transfer</Nav.Link>
                <Nav.Link as={Link} to="/faq">FAQ</Nav.Link>
              </>
            )}
          </Nav>
          
          {user ? (
            // User dropdown for logged in users
            <Dropdown align="end">
              <Dropdown.Toggle variant="outline-primary" id="user-dropdown">
                <i className="bi bi-person-circle me-1"></i>
                {user.username || "User"}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {/* Only show WalletManager in dropdown */}
                <WalletManager />
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>Logout</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            // Login/Register buttons for guests
            <div className="d-flex gap-2">
              <Button 
                variant="outline-primary" 
                onClick={() => navigate("/login?tab=login")}
              >
                Login
              </Button>
              <Button 
                variant="primary" 
                onClick={() => navigate("/login?tab=register")}
              >
                Register
              </Button>
            </div>
          )}
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;