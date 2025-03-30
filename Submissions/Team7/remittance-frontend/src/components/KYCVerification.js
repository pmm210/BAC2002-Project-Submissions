import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, ProgressBar, Tabs, Tab, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import axios from 'axios';
import socket from '../socket';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// KYC level definitions
const KYC_LEVELS = {
  NONE: 0,
  BASIC: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3
};

const KYCVerification = ({ user, onComplete }) => {
  // State for KYC status
  const [kycStatus, setKycStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  
  // State for form data
  const [basicInfo, setBasicInfo] = useState({
    fullName: '',
    dateOfBirth: '',
    country: '',
    address: '',
    phoneNumber: ''
  });
  
  const [idVerification, setIdVerification] = useState({
    idType: 'passport',
    idNumber: '',
    idFrontImage: null,
    idBackImage: null
  });
  
  const [advancedVerification, setAdvancedVerification] = useState({
    selfie: null,
    proofOfAddress: null
  });

  // Fetch KYC status on component mount
  useEffect(() => {
    fetchKYCStatus();
    
    // Setup socket listener for KYC status updates
    socket.on("kycStatusUpdate", handleKycStatusUpdate);
    
    return () => {
      socket.off("kycStatusUpdate");
    };
  }, [user?.id]);

  // Handle KYC status update notifications from WebSocket
  const handleKycStatusUpdate = (data) => {
    console.log("Received KYC status update:", data);
    
    if (data.type === "KYC_VERIFICATION") {
      // Show notification to the user
      toast.success(data.message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      });
      
      // Refresh KYC status to get latest data
      fetchKYCStatus();
    }
  };

  // Fetch the current KYC status from the API
  const fetchKYCStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/kyc/status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('KYC status received:', response.data);
      setKycStatus(response.data);
      
      // If KYC status is verified, call the onComplete callback
      if (onComplete && response.data.verified) {
        onComplete(response.data);
      }
      
      // Set active tab based on completed steps
      if (response.data.completedSteps) {
        if (response.data.completedSteps.includes('advanced_verification')) {
          setActiveTab('advanced');
        } else if (response.data.completedSteps.includes('id_verification')) {
          setActiveTab('id');
        } else if (response.data.completedSteps.includes('basic_info')) {
          setActiveTab('id');
        }
      }
      
      // Pre-fill form data if available
      if (response.data.userData && response.data.userData.basicInfo) {
        setBasicInfo(response.data.userData.basicInfo);
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      setError('Failed to load verification status. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Handle basic info form submission
  const handleBasicInfoSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setSubmitting(false);
        return;
      }
      
      const response = await axios.post(
        `${API_BASE_URL}/kyc/basic`,
        basicInfo,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Basic info submitted successfully:', response.data);
      setKycStatus(response.data);
      
      if (onComplete) {
        onComplete(response.data);
      }
      
      toast.success('Basic information submitted successfully!');
      setActiveTab('id');
    } catch (error) {
      console.error('Error submitting basic info:', error);
      setError(error.response?.data?.error || 'Failed to submit basic information. Please try again later.');
      toast.error(error.response?.data?.error || 'Failed to submit basic information');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle ID verification form submission
  const handleIdVerificationSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setSubmitting(false);
        return;
      }
      
      // Create form data for file upload
      const formData = new FormData();
      formData.append('idType', idVerification.idType);
      formData.append('idNumber', idVerification.idNumber);
      
      if (idVerification.idFrontImage) {
        formData.append('idFrontImage', idVerification.idFrontImage);
      }
      
      if (idVerification.idBackImage) {
        formData.append('idBackImage', idVerification.idBackImage);
      }
      
      const response = await axios.post(
        `${API_BASE_URL}/kyc/id-verification`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      console.log('ID verification submitted successfully:', response.data);
      setKycStatus(response.data);
      
      if (onComplete) {
        onComplete(response.data);
      }
      
      toast.success('ID verification submitted successfully!');
      setActiveTab('advanced');
    } catch (error) {
      console.error('Error submitting ID verification:', error);
      setError(error.response?.data?.error || 'Failed to submit ID verification. Please try again later.');
      toast.error(error.response?.data?.error || 'Failed to submit ID verification');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle advanced verification form submission
  const handleAdvancedVerificationSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setSubmitting(false);
        return;
      }
      
      // Create form data for file upload
      const formData = new FormData();
      
      if (advancedVerification.selfie) {
        formData.append('selfie', advancedVerification.selfie);
      }
      
      if (advancedVerification.proofOfAddress) {
        formData.append('proofOfAddress', advancedVerification.proofOfAddress);
      }
      
      const response = await axios.post(
        `${API_BASE_URL}/kyc/advanced-verification`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      console.log('Advanced verification submitted successfully:', response.data);
      setKycStatus(response.data);
      
      if (onComplete) {
        onComplete(response.data);
      }
      
      toast.success('Advanced verification submitted successfully!');
    } catch (error) {
      console.error('Error submitting advanced verification:', error);
      setError(error.response?.data?.error || 'Failed to submit advanced verification. Please try again later.');
      toast.error(error.response?.data?.error || 'Failed to submit advanced verification');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle file input changes
  const handleFileChange = (e, form, field) => {
    if (e.target.files && e.target.files[0]) {
      if (form === 'id') {
        setIdVerification({
          ...idVerification,
          [field]: e.target.files[0]
        });
      } else if (form === 'advanced') {
        setAdvancedVerification({
          ...advancedVerification,
          [field]: e.target.files[0]
        });
      }
    }
  };

  // Display loading state
  if (loading) {
    return (
      <Card className="mb-4">
        <Card.Body className="text-center py-5">
          <Spinner animation="border" variant="primary" className="mb-3" />
          <p className="mb-0">Loading verification status...</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="kyc-verification-container">
      {/* Status summary card */}
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Verification Status</h5>
            {kycStatus && (
              <div>
                {kycStatus.verified ? (
                  <Alert variant="success" className="py-1 px-2 mb-0">
                    <small className="fw-bold">Verified</small>
                  </Alert>
                ) : kycStatus.pendingVerification ? (
                  <Alert variant="warning" className="py-1 px-2 mb-0">
                    <small className="fw-bold">Pending Verification</small>
                  </Alert>
                ) : (
                  <Alert variant="secondary" className="py-1 px-2 mb-0">
                    <small className="fw-bold">Not Verified</small>
                  </Alert>
                )}
              </div>
            )}
          </div>
          
          {kycStatus && (
            <>
              <div className="mb-3">
                <small className="text-muted">Verification Level</small>
                <ProgressBar now={(kycStatus.level / 3) * 100} className="mt-1" />
                <div className="d-flex justify-content-between mt-1">
                  <small className={kycStatus.level >= KYC_LEVELS.NONE ? 'text-success' : 'text-muted'}>None</small>
                  <small className={kycStatus.level >= KYC_LEVELS.BASIC ? 'text-success' : 'text-muted'}>Basic</small>
                  <small className={kycStatus.level >= KYC_LEVELS.INTERMEDIATE ? 'text-success' : 'text-muted'}>Intermediate</small>
                  <small className={kycStatus.level >= KYC_LEVELS.ADVANCED ? 'text-success' : 'text-muted'}>Advanced</small>
                </div>
              </div>
              
              <div>
                <small className="text-muted">Completed Steps</small>
                <div className="d-flex flex-wrap gap-2 mt-1">
                  {kycStatus.completedSteps.includes('basic_info') && (
                    <Badge bg="success" className="rounded-pill py-1 px-2">Basic Info</Badge>
                  )}
                  {kycStatus.completedSteps.includes('id_verification') && (
                    <Badge bg="success" className="rounded-pill py-1 px-2">ID Verification</Badge>
                  )}
                  {kycStatus.completedSteps.includes('advanced_verification') && (
                    <Badge bg="success" className="rounded-pill py-1 px-2">Advanced Verification</Badge>
                  )}
                  {kycStatus.completedSteps.length === 0 && (
                    <span className="text-muted">No steps completed yet</span>
                  )}
                </div>
              </div>
              
              {kycStatus.rejectionReason && (
                <Alert variant="danger" className="mt-3 mb-0">
                  <small>Reason for rejection: {kycStatus.rejectionReason}</small>
                </Alert>
              )}
            </>
          )}
        </Card.Body>
      </Card>
      
      {/* Verification process tabs */}
      <Card>
        <Card.Header>
          <Tabs
            activeKey={activeTab}
            onSelect={(key) => setActiveTab(key)}
            className="mb-0"
          >
            <Tab eventKey="basic" title="Basic Info" disabled={kycStatus?.verified} />
            <Tab 
              eventKey="id" 
              title="ID Verification" 
              disabled={kycStatus?.verified || !kycStatus?.completedSteps?.includes('basic_info')} 
            />
            <Tab 
              eventKey="advanced" 
              title="Advanced Verification" 
              disabled={kycStatus?.verified || !kycStatus?.completedSteps?.includes('id_verification')} 
            />
          </Tabs>
        </Card.Header>
        
        <Card.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {/* Already verified message */}
          {kycStatus?.verified && (
            <Alert variant="success">
              <Alert.Heading>Your account is fully verified!</Alert.Heading>
              <p>You have completed all verification steps and your account has been approved. You now have full access to all platform features.</p>
            </Alert>
          )}
          
          {/* Pending verification message */}
          {!kycStatus?.verified && kycStatus?.pendingVerification && (
            <Alert variant="warning">
              <Alert.Heading>Your verification is pending review</Alert.Heading>
              <p>We're currently reviewing your submitted information. This usually takes 1-2 business days. You'll be notified once the review is complete.</p>
            </Alert>
          )}
          
          {/* Only show forms if not verified */}
          {!kycStatus?.verified && (
            <>
              {/* Basic Information Form */}
              {activeTab === 'basic' && (
                <Form onSubmit={handleBasicInfoSubmit}>
                  <h5 className="mb-3">Basic Information</h5>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Full Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={basicInfo.fullName}
                      onChange={(e) => setBasicInfo({...basicInfo, fullName: e.target.value})}
                      required
                      disabled={kycStatus?.completedSteps?.includes('basic_info') || submitting}
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Date of Birth</Form.Label>
                    <Form.Control
                      type="date"
                      value={basicInfo.dateOfBirth}
                      onChange={(e) => setBasicInfo({...basicInfo, dateOfBirth: e.target.value})}
                      required
                      disabled={kycStatus?.completedSteps?.includes('basic_info') || submitting}
                    />
                    <Form.Text className="text-muted">
                      You must be at least 18 years old to use this service.
                    </Form.Text>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Country</Form.Label>
                    <Form.Control
                      as="select"
                      value={basicInfo.country}
                      onChange={(e) => setBasicInfo({...basicInfo, country: e.target.value})}
                      required
                      disabled={kycStatus?.completedSteps?.includes('basic_info') || submitting}
                    >
                      <option value="">Select your country</option>
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="UK">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="SG">Singapore</option>
                      <option value="IN">India</option>
                      <option value="JP">Japan</option>
                      {/* Add more countries as needed */}
                    </Form.Control>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Address</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={basicInfo.address}
                      onChange={(e) => setBasicInfo({...basicInfo, address: e.target.value})}
                      disabled={kycStatus?.completedSteps?.includes('basic_info') || submitting}
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-4">
                    <Form.Label>Phone Number</Form.Label>
                    <Form.Control
                      type="tel"
                      value={basicInfo.phoneNumber}
                      onChange={(e) => setBasicInfo({...basicInfo, phoneNumber: e.target.value})}
                      disabled={kycStatus?.completedSteps?.includes('basic_info') || submitting}
                    />
                  </Form.Group>
                  
                  <div className="d-grid">
                    <Button 
                      variant="primary" 
                      type="submit"
                      disabled={kycStatus?.completedSteps?.includes('basic_info') || submitting}
                    >
                      {submitting ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Basic Information'
                      )}
                    </Button>
                  </div>
                </Form>
              )}
              
              {/* ID Verification Form */}
              {activeTab === 'id' && (
                <Form onSubmit={handleIdVerificationSubmit}>
                  <h5 className="mb-3">ID Verification</h5>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>ID Type</Form.Label>
                    <Form.Control
                      as="select"
                      value={idVerification.idType}
                      onChange={(e) => setIdVerification({...idVerification, idType: e.target.value})}
                      required
                      disabled={kycStatus?.completedSteps?.includes('id_verification') || submitting}
                    >
                      <option value="passport">Passport</option>
                      <option value="drivers_license">Driver's License</option>
                      <option value="national_id">National ID Card</option>
                    </Form.Control>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>ID Number</Form.Label>
                    <Form.Control
                      type="text"
                      value={idVerification.idNumber}
                      onChange={(e) => setIdVerification({...idVerification, idNumber: e.target.value})}
                      required
                      disabled={kycStatus?.completedSteps?.includes('id_verification') || submitting}
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>ID Front Image</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={(e) => handleFileChange(e, 'id', 'idFrontImage')}
                      required
                      disabled={kycStatus?.completedSteps?.includes('id_verification') || submitting}
                    />
                    <Form.Text className="text-muted">
                      Upload a clear photo or scan of the front of your ID document (JPG, PNG, or PDF, max 5MB).
                    </Form.Text>
                  </Form.Group>
                  
                  <Form.Group className="mb-4">
                    <Form.Label>
                      ID Back Image
                      {idVerification.idType === 'passport' && ' (Optional for passport)'}
                    </Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={(e) => handleFileChange(e, 'id', 'idBackImage')}
                      required={idVerification.idType !== 'passport'}
                      disabled={kycStatus?.completedSteps?.includes('id_verification') || submitting}
                    />
                    <Form.Text className="text-muted">
                      Upload a clear photo or scan of the back of your ID document (JPG, PNG, or PDF, max 5MB).
                    </Form.Text>
                  </Form.Group>
                  
                  <div className="d-grid">
                    <Button 
                      variant="primary" 
                      type="submit"
                      disabled={kycStatus?.completedSteps?.includes('id_verification') || submitting}
                    >
                      {submitting ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Submitting...
                        </>
                      ) : (
                        'Submit ID Verification'
                      )}
                    </Button>
                  </div>
                </Form>
              )}
              
              {/* Advanced Verification Form */}
              {activeTab === 'advanced' && (
                <Form onSubmit={handleAdvancedVerificationSubmit}>
                  <h5 className="mb-3">Advanced Verification</h5>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Selfie Photo</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(e) => handleFileChange(e, 'advanced', 'selfie')}
                      required
                      disabled={kycStatus?.completedSteps?.includes('advanced_verification') || submitting}
                    />
                    <Form.Text className="text-muted">
                      Upload a clear selfie showing your face (JPG or PNG, max 5MB). Make sure your face is clearly visible.
                    </Form.Text>
                  </Form.Group>
                  
                  <Form.Group className="mb-4">
                    <Form.Label>Proof of Address (Optional)</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={(e) => handleFileChange(e, 'advanced', 'proofOfAddress')}
                      disabled={kycStatus?.completedSteps?.includes('advanced_verification') || submitting}
                    />
                    <Form.Text className="text-muted">
                      Upload a utility bill or bank statement from the last 3 months showing your name and address (JPG, PNG, or PDF, max 5MB).
                    </Form.Text>
                  </Form.Group>
                  
                  <div className="d-grid">
                    <Button 
                      variant="primary" 
                      type="submit"
                      disabled={kycStatus?.completedSteps?.includes('advanced_verification') || submitting}
                    >
                      {submitting ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Advanced Verification'
                      )}
                    </Button>
                  </div>
                </Form>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default KYCVerification;