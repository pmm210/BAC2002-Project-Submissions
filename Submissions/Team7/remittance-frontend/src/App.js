import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import socket from "./socket";
import axios from "axios";

// Components
import AppNavbar from "./components/AppNavbar";
import Footer from "./components/Footer";
import { WalletProvider } from "./components/WalletManager";

// Pages
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import SendMoney from "./pages/SendMoney";
import Transactions from "./pages/Transactions";
import KYCPage from "./pages/KYCPage";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState(null);

  // Decode JWT token to get user info
  const decodeToken = (token) => {
    try {
      console.log("Decoding token:", token);
      
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.error("Invalid token format");
        return null;
      }
      
      const payloadBase64 = tokenParts[1];
      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = atob(base64);
      const payload = JSON.parse(jsonPayload);
      
      console.log("Decoded token payload:", payload);
      return payload;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  };

  useEffect(() => {
    const checkAuth = () => {
      setLoading(true);
      
      try {
        const token = localStorage.getItem("token");
        
        if (!token) {
          console.log("No token found in localStorage");
          setUser(null);
          setLoading(false);
          return;
        }
        
        const payload = decodeToken(token);
        
        if (!payload) {
          localStorage.removeItem("token");
          setUser(null);
          toast.error("Your session has expired. Please log in again.");
          setLoading(false);
          return;
        }
        
        setUser({
          id: payload.id,
          username: payload.username,
          email: payload.email
        });
        
        console.log("User set to:", payload.username);
      } catch (error) {
        console.error("Auth error:", error);
        localStorage.removeItem("token");
        setUser(null);
        toast.error("Authentication error. Please log in again.");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Set up WebSocket connection and event listeners
    socket.on("connect", () => {
      console.log("Connected to WebSocket server");
      
      // Register user with socket if authenticated
      if (user && user.id) {
        socket.emit("register", user.id);
        console.log(`Registered user ${user.id} with WebSocket`);
      }
    });

    // Listen for KYC status updates
    socket.on("kycStatusUpdate", (data) => {
      console.log("Received KYC status update:", data);
      
      if (data.status) {
        setKycStatus(data.status);
      }
      
      // Show notification if provided
      if (data.notification) {
        const { type, message } = data.notification;
        
        if (type === 'kyc_verification_success') {
          toast.success(message, {
            position: "top-center",
            autoClose: 8000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            icon: "✅"
          });
        }
      }
    });

    // Listen for transaction status updates
    socket.on("transactionUpdate", (updatedTransaction) => {
      console.log("Transaction update received:", updatedTransaction);
      
      // Show notification for status change
      if (updatedTransaction.status === "completed") {
        toast.success(`Transaction #${updatedTransaction.id} is now complete!`);
        
        // Show Polygonscan link if tx_hash exists and isn't a pending hash
        if (updatedTransaction.tx_hash && !updatedTransaction.tx_hash.startsWith("pending_")) {
          const isTestnet = true; // Use testnet for now
          const baseUrl = isTestnet 
            ? "https://amoy.polygonscan.com/tx/" 
            : "https://polygonscan.com/tx/";
          
          const polygonscanLink = `${baseUrl}${updatedTransaction.tx_hash}`;
          
          toast.info(
            <div>
              Transaction confirmed
              <br />
              <a href={polygonscanLink} target="_blank" rel="noopener noreferrer">
                View on Polygonscan
              </a>
            </div>,
            { autoClose: 10000 }
          );
        }
      } else if (updatedTransaction.status === "failed") {
        toast.error(`Transaction #${updatedTransaction.id} has failed`);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("kycStatusUpdate");
      socket.off("transactionUpdate");
    };
  }, []); // Empty dependency array to run only on mount

  // Register with WebSocket server when user changes
  useEffect(() => {
    if (user && user.id && socket.connected) {
      socket.emit("register", user.id);
      console.log(`Registered user ${user.id} with WebSocket`);
    }
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    setKycStatus(null);
    localStorage.removeItem("token");
    toast.info("You have been logged out");
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <WalletProvider>
        <div className="d-flex flex-column min-vh-100">
          <AppNavbar user={user} handleLogout={handleLogout} />
          
          <main className="flex-grow-1">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={user ? <Navigate to="/home" /> : <LandingPage />} />
              <Route path="/login" element={user ? <Navigate to="/home" /> : <AuthPage setUser={setUser} />} />
              <Route path="/register" element={<Navigate to="/login?tab=register" />} />
              <Route path="/faq" element={<FAQ />} />
              
              {/* Protected routes */}
              <Route path="/home" element={user ? <Home user={user} kycStatus={kycStatus} /> : <Navigate to="/" />} />
              <Route path="/send-money" element={user ? <SendMoney user={user} kycStatus={kycStatus} /> : <Navigate to="/" />} />
              <Route path="/transactions" element={user ? <Transactions user={user} /> : <Navigate to="/" />} />
              <Route path="/kyc" element={user ? <KYCPage user={user} kycStatus={kycStatus} setKycStatus={setKycStatus} /> : <Navigate to="/" />} />
              
              {/* 404 Not Found */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          
          <Footer />
          
          <ToastContainer 
            position="bottom-right" 
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </div>
      </WalletProvider>
    </Router>
  );
};

export default App;