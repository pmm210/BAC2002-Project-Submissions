import React, { useState, useEffect } from "react";
import { login, register } from "../api/auth";
import { useNavigate, useLocation } from "react-router-dom";
import { Form, Button, Container, Tabs, Tab, Row, Col, Card, Alert } from "react-bootstrap";
import { toast } from "react-toastify";
import PageWrapper from "../components/PageWrapper";

const AuthPage = ({ setUser }) => {
    const [activeTab, setActiveTab] = useState("login");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState(""); // For register only
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    const navigate = useNavigate();
    const location = useLocation();

    // Parse URL query parameter for initial tab
    useEffect(() => {
        // Check if there's a tab parameter in the URL
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'login' || tab === 'register') {
            setActiveTab(tab);
        }
    }, [location]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        
        try {
            const result = await login(email, password);
            if (result.token) {
                setUser(result.user);
                localStorage.setItem("token", result.token);
                toast.success("Login successful!");
                navigate("/home"); // Redirect to Home after login
            } else {
                const errorMessage = result.error || result.message || "Login failed";
                setError(errorMessage);
                toast.error(`Login failed: ${errorMessage}`);
            }
        } catch (err) {
            console.error("Login error:", err);
            const errorMessage = err.response?.data?.error || 
                                err.response?.data?.message || 
                                err.message || 
                                "Login failed";
            setError(errorMessage);
            toast.error(`Login failed: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };    

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        
        if (password.length < 6) {
            const errorMessage = "Password must be at least 6 characters long";
            setError(errorMessage);
            toast.error(`Registration failed: ${errorMessage}`);
            setLoading(false);
            return;
        }
        
        try {
            console.log("Attempting registration with:", { email, username, password: "****" });
            const result = await register(email, username, password);
            console.log("Registration result:", result);
            
            if (result.status === 201 || result.message === "Registration successful") {
                toast.success("Registration successful! Please log in.");
                // Clear form fields
                setPassword("");
                // Automatically switch to login tab after successful registration
                setActiveTab("login");
            } else {
                const errorMessage = result.error || result.message || "Registration failed";
                setError(errorMessage);
                toast.error(`Registration failed: ${errorMessage}`);
            }
        } catch (err) {
            console.error("Registration error caught:", err);
            
            // Extract the most specific error message
            let errorMessage = "Registration failed";
            
            if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
            toast.error(`Registration failed: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageWrapper>
            <Container className="py-5">
                <Row className="justify-content-center">
                    <Col md={6}>
                        <Card className="shadow-sm">
                            <Card.Body className="p-4">
                                <h2 className="text-center mb-4">Welcome to RemitFlow</h2>
                                
                                {error && (
                                    <Alert variant="danger" onClose={() => setError("")} dismissible>
                                        {error}
                                    </Alert>
                                )}
                                
                                <Tabs 
                                    activeKey={activeTab} 
                                    onSelect={(k) => setActiveTab(k)} 
                                    className="mb-4"
                                    fill
                                >
                                    <Tab eventKey="login" title="Login">
                                        <Form onSubmit={handleLogin}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Email</Form.Label>
                                                <Form.Control 
                                                    type="email" 
                                                    value={email} 
                                                    onChange={(e) => setEmail(e.target.value)} 
                                                    placeholder="Enter your email"
                                                    required 
                                                    disabled={loading}
                                                />
                                            </Form.Group>
                                            <Form.Group className="mb-4">
                                                <Form.Label>Password</Form.Label>
                                                <Form.Control 
                                                    type="password" 
                                                    value={password} 
                                                    onChange={(e) => setPassword(e.target.value)} 
                                                    placeholder="Enter your password"
                                                    required 
                                                    disabled={loading}
                                                />
                                            </Form.Group>
                                            <Button 
                                                variant="primary" 
                                                type="submit" 
                                                className="w-100 py-2"
                                                disabled={loading}
                                            >
                                                {loading ? "Logging in..." : "Login"}
                                            </Button>
                                        </Form>
                                        <div className="text-center mt-3">
                                            <p className="mb-0">Don't have an account? <a href="#" onClick={(e) => {e.preventDefault(); setActiveTab("register")}}>Register here</a></p>
                                        </div>
                                    </Tab>

                                    <Tab eventKey="register" title="Register">
                                        <Form onSubmit={handleRegister}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Email</Form.Label>
                                                <Form.Control 
                                                    type="email" 
                                                    value={email} 
                                                    onChange={(e) => setEmail(e.target.value)} 
                                                    placeholder="Enter your email"
                                                    required 
                                                    disabled={loading}
                                                />
                                            </Form.Group>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Username</Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    value={username} 
                                                    onChange={(e) => setUsername(e.target.value)} 
                                                    placeholder="Choose a username"
                                                    required 
                                                    disabled={loading}
                                                />
                                            </Form.Group>
                                            <Form.Group className="mb-4">
                                                <Form.Label>Password</Form.Label>
                                                <Form.Control 
                                                    type="password" 
                                                    value={password} 
                                                    onChange={(e) => setPassword(e.target.value)} 
                                                    placeholder="Create a password"
                                                    required 
                                                    disabled={loading}
                                                />
                                                <Form.Text className="text-muted">
                                                    Password must be at least 6 characters long.
                                                </Form.Text>
                                            </Form.Group>
                                            <Button 
                                                variant="success" 
                                                type="submit" 
                                                className="w-100 py-2"
                                                disabled={loading}
                                            >
                                                {loading ? "Registering..." : "Register"}
                                            </Button>
                                        </Form>
                                        <div className="text-center mt-3">
                                            <p className="mb-0">Already have an account? <a href="#" onClick={(e) => {e.preventDefault(); setActiveTab("login")}}>Login here</a></p>
                                        </div>
                                    </Tab>
                                </Tabs>
                            </Card.Body>
                        </Card>
                        
                        <Card className="mt-4 border-0 bg-light">
                            <Card.Body className="text-center">
                                <h4>Why Choose Our Remittance Platform?</h4>
                                <Row className="mt-3">
                                    <Col md={4}>
                                        <div className="mb-3">
                                            <i className="bi bi-lightning-charge text-primary display-6"></i>
                                        </div>
                                        <h5>Fast Transfers</h5>
                                        <p className="small text-muted">Minutes instead of days</p>
                                    </Col>
                                    <Col md={4}>
                                        <div className="mb-3">
                                            <i className="bi bi-piggy-bank text-primary display-6"></i>
                                        </div>
                                        <h5>Low Fees</h5>
                                        <p className="small text-muted">Save up to 92% on fees</p>
                                    </Col>
                                    <Col md={4}>
                                        <div className="mb-3">
                                            <i className="bi bi-shield-check text-primary display-6"></i>
                                        </div>
                                        <h5>Secure</h5>
                                        <p className="small text-muted">Blockchain-powered security</p>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </PageWrapper>
    );
};

export default AuthPage;