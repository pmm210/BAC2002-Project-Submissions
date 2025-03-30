import React, { useState, useEffect } from "react";
import { Container, Card, Form, Button, Alert, Spinner, ProgressBar, Row, Col } from "react-bootstrap";
import { toast } from "react-toastify";
import PageWrapper from "../components/PageWrapper";
import axios from "axios";
import socket from "../socket";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const KYCPage = ({ user, kycStatus, setKycStatus }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState("basic_info");
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    nationality: "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
    documentType: "passport",
    documentFile: null
  });
  const [submitLoading, setSubmitLoading] = useState(false);

  // Fetch KYC status when component mounts
  useEffect(() => {
    fetchKYCStatus();

    // Listen for KYC step completion
    socket.on("kycStepComplete", (data) => {
      console.log("KYC step completed:", data);
      // Update local KYC status if provided
      if (data.kycStatus) {
        setKycStatus(data.kycStatus);
      }
      
      toast.success(`KYC step ${data.step} completed successfully`);
    });

    // Listen for KYC status updates (used for verification status changes)
    socket.on("kycStatusUpdate", (data) => {
      console.log("KYC status update received:", data);
      
      if (data.status) {
        setKycStatus(data.status);
        
        // If verification was approved
        if (data.status.verified && !kycStatus?.verified) {
          toast.success("Your KYC verification has been approved! You can now make transactions.", {
            position: "top-center",
            autoClose: 8000
          });
        }
      }
    });

    return () => {
      socket.off("kycStepComplete");
      socket.off("kycStatusUpdate");
    };
  }, []);

  // Fetch KYC status
  const fetchKYCStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/kyc/status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log("KYC status response:", response.data);
      setKycStatus(response.data);
      
      // Set active step based on completed steps
      if (response.data.completedSteps && response.data.completedSteps.length > 0) {
        const steps = ["basic_info", "personal_details", "address_verification", "document_verification"];
        const completedSteps = response.data.completedSteps;
        
        // Find the first incomplete step
        const nextStep = steps.find(step => !completedSteps.includes(step));
        if (nextStep) {
          setActiveStep(nextStep);
        } else {
          // All steps completed
          setActiveStep("review");
        }
      }
    } catch (error) {
      console.error("Error fetching KYC status:", error);
      setError("Failed to fetch KYC status");
      toast.error("Error loading verification status");
    } finally {
      setLoading(false);
    }
  };

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "documentFile" && files && files.length > 0) {
      setFormData({
        ...formData,
        documentFile: files[0]
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Handle step submission
  const handleSubmitStep = async (step) => {
    setSubmitLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required");
        setSubmitLoading(false);
        return;
      }

      // Different handling based on the step
      if (step === "document_verification" && formData.documentFile) {
        // For document upload
        const formDataObj = new FormData();
        formDataObj.append("document", formData.documentFile);
        formDataObj.append("documentType", formData.documentType);

        await axios.post(`${API_BASE_URL}/kyc/upload-document`, formDataObj, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          }
        });
      }

      // Always send the complete-step request
      const response = await axios.post(
        `${API_BASE_URL}/kyc/complete-step`,
        { stepName: step },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (response.data.kycStatus) {
        setKycStatus(response.data.kycStatus);
      }

      toast.success(`Step completed successfully`);

      // Move to the next step
      const steps = ["basic_info", "personal_details", "address_verification", "document_verification", "review"];
      const currentIndex = steps.indexOf(step);
      
      if (currentIndex < steps.length - 1) {
        setActiveStep(steps[currentIndex + 1]);
      }
    } catch (error) {
      console.error(`Error submitting step ${step}:`, error);
      setError(error.response?.data?.error || "Failed to submit verification data");
      toast.error("Error submitting verification data");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Render verification status indicator
  const renderVerificationStatus = () => {
    if (!kycStatus) return null;

    let variant = "info";
    let message = "Start your verification process";

    if (kycStatus.verified) {
      variant = "success";
      message = "Your identity has been verified successfully!";
    } else if (kycStatus.pendingVerification) {
      variant = "warning";
      message = "Your verification is pending review. This typically takes 1-2 business days.";
    } else if (kycStatus.completedSteps && kycStatus.completedSteps.length > 0) {
      variant = "info";
      message = `${kycStatus.completedSteps.length}/4 verification steps completed`;
    }

    return (
      <Alert variant={variant} className="mb-4">
        <Alert.Heading>Verification Status</Alert.Heading>
        <p>{message}</p>
        {kycStatus.completedSteps && kycStatus.completedSteps.length > 0 && !kycStatus.verified && !kycStatus.pendingVerification && (
          <ProgressBar 
            now={(kycStatus.completedSteps.length / 4) * 100} 
            variant={variant} 
            className="mt-2"
          />
        )}
      </Alert>
    );
  };

  // Render form step based on active step
  const renderStep = () => {
    // If already verified, show success message
    if (kycStatus?.verified) {
      return (
        <Card className="bg-light border-success">
          <Card.Body className="text-center">
            <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "3rem" }}></i>
            <h4 className="mt-3">Verification Complete</h4>
            <p>Your identity has been verified successfully. You can now make transactions on the platform.</p>
          </Card.Body>
        </Card>
      );
    }

    // If pending verification, show waiting message
    if (kycStatus?.pendingVerification) {
      return (
        <Card className="bg-light">
          <Card.Body className="text-center">
            <i className="bi bi-hourglass-split text-warning" style={{ fontSize: "3rem" }}></i>
            <h4 className="mt-3">Verification In Progress</h4>
            <p>Your verification is currently being reviewed. This process typically takes 1-2 business days.</p>
            <p>You will be notified once your verification is complete.</p>
          </Card.Body>
        </Card>
      );
    }

    // Otherwise show the appropriate form step
    switch (activeStep) {
      case "basic_info":
        return (
          <Card>
            <Card.Header>Step 1: Basic Information</Card.Header>
            <Card.Body>
              <Form onSubmit={(e) => { e.preventDefault(); handleSubmitStep("basic_info"); }}>
                <Form.Group className="mb-3">
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Date of Birth</Form.Label>
                  <Form.Control
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Nationality</Form.Label>
                  <Form.Control
                    type="text"
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Submitting...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        );
      case "personal_details":
        return (
          <Card>
            <Card.Header>Step 2: Personal Details</Card.Header>
            <Card.Body>
              <Form onSubmit={(e) => { e.preventDefault(); handleSubmitStep("personal_details"); }}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Phone Number</Form.Label>
                      <Form.Control
                        type="tel"
                        name="phoneNumber"
                        placeholder="+1 123 456 7890"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Tax Identification Number (Optional)</Form.Label>
                      <Form.Control
                        type="text"
                        name="taxId"
                        placeholder="Enter TIN/SSN/Tax ID"
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Submitting...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        );
      case "address_verification":
        return (
          <Card>
            <Card.Header>Step 3: Address Verification</Card.Header>
            <Card.Body>
              <Form onSubmit={(e) => { e.preventDefault(); handleSubmitStep("address_verification"); }}>
                <Form.Group className="mb-3">
                  <Form.Label>Address Line</Form.Label>
                  <Form.Control
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>City</Form.Label>
                      <Form.Control
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Postal Code</Form.Label>
                      <Form.Control
                        type="text"
                        name="postalCode"
                        value={formData.postalCode}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>Country</Form.Label>
                  <Form.Control
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Submitting...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        );
      case "document_verification":
        return (
          <Card>
            <Card.Header>Step 4: Document Verification</Card.Header>
            <Card.Body>
              <Form onSubmit={(e) => { e.preventDefault(); handleSubmitStep("document_verification"); }}>
                <Form.Group className="mb-3">
                  <Form.Label>Document Type</Form.Label>
                  <Form.Select
                    name="documentType"
                    value={formData.documentType}
                    onChange={handleChange}
                    required
                  >
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver's License</option>
                    <option value="national_id">National ID Card</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Upload Document</Form.Label>
                  <Form.Control
                    type="file"
                    name="documentFile"
                    onChange={handleChange}
                    required
                    accept=".jpg,.jpeg,.png,.pdf"
                  />
                  <Form.Text className="text-muted">
                    Please upload a clear image of your document. Accepted formats: JPG, PNG, PDF. Max size: 5MB.
                  </Form.Text>
                </Form.Group>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitLoading || !formData.documentFile}
                >
                  {submitLoading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Uploading...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        );
      case "review":
        return (
          <Card>
            <Card.Header>Verification Submitted</Card.Header>
            <Card.Body className="text-center">
              <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "3rem" }}></i>
              <h4 className="mt-3">All Steps Completed</h4>
              <p>
                Your verification information has been submitted successfully. Our team will
                review your details and documents. You will be notified once your verification
                is complete.
              </p>
              <p className="text-muted">
                This process typically takes 1-2 business days.
              </p>
            </Card.Body>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <PageWrapper>
      <Container className="py-4">
        <h1 className="mb-4">Identity Verification</h1>
        
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-3">Loading verification status...</p>
          </div>
        ) : (
          <>
            {renderVerificationStatus()}
            {renderStep()}
          </>
        )}
      </Container>
    </PageWrapper>
  );
};

export default KYCPage;