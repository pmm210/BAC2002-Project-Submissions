import React, { useState, useEffect, useCallback } from "react";
import { Container, Form, Card, Row, Col, Alert, Spinner, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { ethers } from 'ethers';
import TokenSelector from "../components/TokenSelector";
import TransactionFeesDisplay from "../components/TransactionFeesDisplay";
import PageWrapper from "../components/PageWrapper";
import { useWallet } from "../components/WalletManager";
import axios from "axios";
import '../components/ExchangeRates.css';
import RemittanceContractAbi from './RemittanceContract.json';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const SendMoney = ({ user, kycStatus }) => {
  const { wallet, signer, contract } = useWallet();
  const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0xD2085525fF19d8b5381161dD102c04904478A3EA';

  const [recipient, setRecipient] = useState("");
  const [sendToken, setSendToken] = useState(null);
  const [receiveToken, setReceiveToken] = useState(null);
  const [amount, setAmount] = useState("");
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [refreshFees, setRefreshFees] = useState(false);
  const [shouldRefreshRates, setShouldRefreshRates] = useState(false);
  const [contractStatus, setContractStatus] = useState(null);
  const [isLoadingKyc, setIsLoadingKyc] = useState(true);
  const [useSimulationMode, setUseSimulationMode] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState(null);
  const [localKycStatus, setLocalKycStatus] = useState(kycStatus);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const contractResponse = await axios.get(`${API_BASE_URL}/transactions/contract-status`);
        setContractStatus(contractResponse.data);
        console.log("Smart contract status:", contractResponse.data);

        const token = localStorage.getItem('token');
        if (token) {
          try {
            const kycResponse = await axios.get(`${API_BASE_URL}/kyc/status`, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            console.log("KYC status fetched:", kycResponse.data);
            setLocalKycStatus(kycResponse.data);
          } catch (kycError) {
            console.error("Error fetching KYC status:", kycError);
            // Use the kycStatus prop as fallback if API call fails
            setLocalKycStatus(kycStatus);
          }
        } else {
          setLocalKycStatus(kycStatus);
        }
      } catch (err) {
        console.error("Error checking status:", err);
        if (err.response?.status === 403) {
          setError("Your access is restricted. Please complete KYC verification.");
        } else {
          setError("Error checking service status. Please try again later.");
        }
      } finally {
        setIsLoadingKyc(false);
      }
    };

    checkStatus();
  }, [kycStatus]);

  // Update local KYC status when prop changes
  useEffect(() => {
    if (kycStatus) {
      setLocalKycStatus(kycStatus);
    }
  }, [kycStatus]);

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    setRefreshFees(prev => !prev);
    setShouldRefreshRates(true);
    if (sendToken && receiveToken) {
      getConversionQuote(sendToken.address, e.target.value);
    }
  };

  const handleSendTokenChange = (token) => {
    setSendToken(token);
    setRefreshFees(prev => !prev);
    setShouldRefreshRates(true);
    if (amount && receiveToken) {
      getConversionQuote(token.address, amount);
    }
  };

  const handleReceiveTokenChange = (token) => {
    setReceiveToken(token);
    setRefreshFees(prev => !prev);
    setShouldRefreshRates(true);
    if (amount && sendToken) {
      getConversionQuote(sendToken.address, amount);
    }
  };

  useEffect(() => {
    if (shouldRefreshRates) {
      const timer = setTimeout(() => {
        setShouldRefreshRates(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldRefreshRates]);

  const getConversionQuote = useCallback(async (tokenAddress, tokenAmount) => {
    if (!tokenAddress || !tokenAmount || parseFloat(tokenAmount) <= 0) {
      setConvertedAmount(null);
      return;
    }

    try {
      // Try to get conversion from API first since it's more reliable
      console.log("Getting conversion quote from API...");
      try {
        const response = await axios.get(`${API_BASE_URL}/transactions/bundled-rates`, {
          params: {
            from: sendToken?.symbol,
            to: receiveToken?.symbol,
            amount: tokenAmount
          }
        });

        if (response.data && response.data.conversion &&
            response.data.conversion.convertedAmount !== undefined &&
            response.data.conversion.convertedAmount > 0) {
          console.log("API quote:", response.data.conversion.convertedAmount);
          setConvertedAmount(response.data.conversion.convertedAmount);
          return;
        }
      } catch (apiError) {
        console.warn("API conversion failed, trying contract...", apiError);
      }

      // If API fails, try contract
      if (contract && signer) {
        try {
          console.log("Getting conversion quote from contract...");
          const amountInWei = ethers.parseUnits(tokenAmount.toString(), 18);
          const quoteWei = await contract.getConversionQuote(tokenAddress, amountInWei);
          const convertedAmountFromContract = ethers.formatUnits(quoteWei, 18);

          if (quoteWei.toString() !== '0' && parseFloat(convertedAmountFromContract) > 0) {
            console.log("Contract quote:", convertedAmountFromContract);
            setConvertedAmount(convertedAmountFromContract);
            return;
          } else {
            console.warn("Contract returned zero or invalid value");
            setError("Could not get accurate conversion quote. Please try a different token or amount.");
          }
        } catch (contractError) {
          console.warn("Error getting conversion from contract:", contractError);
          setError("Could not calculate conversion rate. Using simulation mode instead.");
        }
      }

      // If all else fails, use a simple approximation
      const sourcePrice = sendToken?.price || 1;
      const targetPrice = receiveToken?.price || 1;
      const estimatedAmount = parseFloat(tokenAmount) * sourcePrice / targetPrice;
      console.log("Using estimated conversion:", estimatedAmount);
      setConvertedAmount(estimatedAmount.toFixed(6));
      
    } catch (error) {
      console.error("Error getting conversion quote:", error);
      setError("Could not calculate conversion. Please try again later.");
      setConvertedAmount(null);
    }
  }, [contract, signer, sendToken, receiveToken]);

  const isNativeToken = (token) => {
    if (!token) return false;
    if (token.symbol === "ETH" || token.symbol === "MATIC" || token.symbol === "POL") return true;
    if (token.address?.toLowerCase() === "0x0000000000000000000000000000000000001010" ||
        token.address?.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return true;
    return false;
  };

  const toggleSimulationMode = () => {
    setUseSimulationMode(prev => !prev);
    toast.info(useSimulationMode ? 
      "Switched to blockchain mode" : 
      "Switched to simulation mode (transactions will be processed via API)"
    );
  };

  // Function to update transaction status
  const updateTransactionStatus = async (transactionId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }
      
      console.log(`Updating transaction ${transactionId} to status: ${newStatus}`);
      
      const response = await axios.put(
        `${API_BASE_URL}/transactions/${transactionId}`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("Transaction status updated:", response.data);
      toast.success(`Transaction status updated to: ${newStatus}`);
      
      return true;
    } catch (error) {
      console.error("Error updating transaction status:", error);
      toast.error("Failed to update transaction status");
      return false;
    }
  };

  const processTransactionViaAPI = async (txHash = null) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }
      
      console.log("Processing transaction via API", txHash ? "with hash: " + txHash : "simulation mode");
      const response = await axios.post(
        `${API_BASE_URL}/transactions`,
        {
          recipient,
          token: sendToken.symbol,
          amount: parseFloat(amount),
          receiveToken: receiveToken.symbol,
          txHash: txHash || null
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("Transaction created:", response.data);
      toast.success(txHash ? "Transaction recorded successfully" : "Transaction processed in simulation mode");
      
      // Store the transaction ID for status updates
      if (response.data && response.data.id) {
        setCurrentTransactionId(response.data.id);
      }
      
      // Reset form
      setRecipient("");
      setAmount("");
      return response.data;
    } catch (apiError) {
      console.error("API transaction error:", apiError);
      toast.error(apiError.response?.data?.message || "Failed to process transaction");
      return null;
    }
  };

  const getPolygonscanLink = (txHash, isTestnet = true) => {
    if (!txHash) return null;
    
    const baseUrl = isTestnet 
      ? "https://amoy.polygonscan.com/tx/" 
      : "https://polygonscan.com/tx/";
    
    return `${baseUrl}${txHash}`;
  };

  const handleSendMoney = async (e) => {
    e.preventDefault();
    setError(null);
    setCurrentTransactionId(null);

    // Validation
    if (!wallet) return toast.error("Please connect your wallet first.");
    if (!recipient) return toast.error("Please enter a recipient address.");
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return toast.error("Please enter a valid amount.");
    if (!sendToken) return toast.error("Please select a token to send.");
    if (!receiveToken) return toast.error("Please select a token to receive.");
    if (!ethers.isAddress(recipient)) return toast.error("Invalid recipient address format.");

    setIsProcessing(true);

    // If simulation mode is selected, use API only
    if (useSimulationMode) {
      const transaction = await processTransactionViaAPI();
      setIsProcessing(false);
      return;
    }

    try {
      // Get provider and signer using ethers v6 approach
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      
      console.log("User address:", userAddress);
      
      // Create contract instance
      if (!CONTRACT_ADDRESS) {
        throw new Error("Contract address not configured");
      }

      console.log("Using contract at:", CONTRACT_ADDRESS);
      console.log("Sender:", userAddress);
      console.log("Recipient:", recipient);
      console.log("Amount:", amount, sendToken.symbol);
      
      // BTC on Polygon is actually Wrapped Bitcoin (WBTC)
      // We need to use the correct token address based on the token symbol
      let tokenAddress;
      if (sendToken.symbol === "BTC") {
        // WBTC on Polygon Amoy Testnet
        tokenAddress = "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6";
        console.log("Using WBTC address for BTC:", tokenAddress);
      } else if (isNativeToken(sendToken)) {
        // Use the special native token address that the contract recognizes
        tokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        console.log("Using native token special address:", tokenAddress);
      } else {
        tokenAddress = sendToken.address;
        console.log("Using token address:", tokenAddress);
      }

      try {
        // Create a new contract instance directly for this transaction
        const remittanceContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          RemittanceContractAbi.abi,
          signer
        );
        
        // Check if contract is paused
        try {
          const isPaused = await remittanceContract.paused();
          if (isPaused) {
            toast.error("The contract is currently paused. Using simulation mode instead.");
            await processTransactionViaAPI();
            setIsProcessing(false);
            return;
          }
        } catch (pauseError) {
          console.warn("Could not check if contract is paused:", pauseError);
        }
        
        // Different balance check for native token vs. ERC20 token
        if (isNativeToken(sendToken)) {
          const balance = await provider.getBalance(userAddress);
          const balanceInEther = ethers.formatEther(balance);
          console.log(`Native token balance: ${balanceInEther} ${sendToken.symbol}`);
          
          if (parseFloat(balanceInEther) < parseFloat(amount)) {
            throw new Error(`Insufficient ${sendToken.symbol} balance. You have ${balanceInEther} ${sendToken.symbol}.`);
          }
        } else {
          // For ERC-20 tokens (including BTC/WBTC)
          // Handle approval for ERC-20 tokens
          const tokenContract = new ethers.Contract(
            tokenAddress,
            [
              "function approve(address spender, uint256 amount) public returns (bool)",
              "function allowance(address owner, address spender) public view returns (uint256)",
              "function balanceOf(address account) public view returns (uint256)",
              "function decimals() public view returns (uint8)"
            ],
            signer
          );
          
          // Get token decimals (important for correct formatting)
          let decimals = 18; // Default
          try {
            decimals = await tokenContract.decimals();
            console.log(`Token decimals for ${sendToken.symbol}: ${decimals}`);
          } catch (error) {
            console.warn("Could not get token decimals, using default 18:", error);
          }
          
          // Check token balance
          const tokenBalance = await tokenContract.balanceOf(userAddress);
          const formattedBalance = ethers.formatUnits(tokenBalance, decimals);
          console.log(`Token balance: ${formattedBalance} ${sendToken.symbol}`);
          
          if (parseFloat(formattedBalance) < parseFloat(amount)) {
            throw new Error(`Insufficient ${sendToken.symbol} balance. You have ${formattedBalance} ${sendToken.symbol}.`);
          }

          const amountInWei = ethers.parseUnits(amount.toString(), decimals);
          const currentAllowance = await tokenContract.allowance(userAddress, CONTRACT_ADDRESS);

          console.log(`Current allowance: ${ethers.formatUnits(currentAllowance, decimals)} ${sendToken.symbol}`);
          
          if (currentAllowance < amountInWei) {
            toast.info(`Requesting approval to spend your ${sendToken.symbol} tokens. Please confirm in your wallet...`);
            try {
              // Simple approval transaction with high gas
              const approvalTx = await tokenContract.approve(
                CONTRACT_ADDRESS,
                ethers.MaxUint256, // Approving max tokens
                {
                  gasLimit: 100000, // Fixed gas limit for approval
                  gasPrice: ethers.parseUnits("100", "gwei"), // High gas price
                  type: 0 // Legacy transaction
                }
              );
              toast.info(`Approval transaction submitted. Please wait for confirmation...`);
              await approvalTx.wait();
              toast.success(`${sendToken.symbol} tokens approved successfully!`);
            } catch (approvalError) {
              if (approvalError.code === 'ACTION_REJECTED') {
                throw new Error("You rejected the approval transaction");
              } else {
                console.error("Approval error:", approvalError);
                throw new Error(`Error approving tokens: ${approvalError.message}`);
              }
            }
          } else {
            console.log("Token already approved");
          }
        }

        // Prepare transaction parameters
        const decimals = sendToken.symbol === "BTC" ? 8 : 18; // BTC/WBTC uses 8 decimals
        const amountInWei = ethers.parseUnits(amount.toString(), decimals);

        // Use extremely high gas parameters to ensure transaction success
        const fixedGasPrice = ethers.parseUnits("100", "gwei"); // 100 gwei
        const fixedGasLimit = isNativeToken(sendToken) ? 1000000 : 1000000; // Very high limit
        
        console.log("Using fixed gas parameters:");
        console.log(`Gas Price: ${fixedGasPrice.toString()} (100 gwei)`);
        console.log(`Gas Limit: ${fixedGasLimit.toString()}`);

        toast.info("Sending transaction to blockchain. Please confirm in your wallet...");

        let tx;
        // For native token transactions
        if (isNativeToken(sendToken)) {
          console.log("Sending native token transaction with maximal simplicity");
          
          // IMPORTANT: For native token, we must include the exact value parameter
          tx = await remittanceContract.sendWithConversion(
            tokenAddress,  // Native token address
            amountInWei,   // Amount in wei
            recipient,     // Recipient address
            {
              value: amountInWei,  // CRITICAL: Must match amount for native tokens
              gasLimit: fixedGasLimit,
              gasPrice: fixedGasPrice,
              type: 0 // Legacy transaction type (no EIP-1559)
            }
          );
        } 
        // For ERC-20 tokens
        else {
          console.log("Sending ERC-20 token transaction with maximal simplicity");
          
          // For ERC-20, no value parameter needed
          tx = await remittanceContract.sendWithConversion(
            tokenAddress,  // Token address
            amountInWei,   // Amount in wei
            recipient,     // Recipient address
            {
              gasLimit: fixedGasLimit,
              gasPrice: fixedGasPrice,
              type: 0 // Legacy transaction type
            }
          );
        }
        
        toast.info(`Transaction submitted: ${tx.hash}`);
        console.log("Transaction hash:", tx.hash);
        
        // Create a Polygonscan link for the transaction
        const polygonscanLink = getPolygonscanLink(tx.hash, true); // true for Amoy testnet
        
        // Show transaction link to user
        if (polygonscanLink) {
          toast.info(
            <div>
              Transaction submitted
              <br />
              <a href={polygonscanLink} target="_blank" rel="noopener noreferrer">
                View on Polygonscan
              </a>
            </div>,
            { autoClose: 10000 }
          );
        }
        
        // Record transaction in the database with its hash
        const transaction = await processTransactionViaAPI(tx.hash);
        
        // Wait for confirmation
        toast.info("Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log("Transaction receipt:", receipt);
        
        // Update the transaction status to "completed" after confirmation
        if (transaction && transaction.id) {
          await updateTransactionStatus(transaction.id, "completed");
        }
        
        toast.success("Transaction confirmed!");
        
        // Reset form
        setRecipient("");
        setAmount("");
      } catch (contractError) {
        console.error("Contract interaction error:", contractError);
        
        // For user rejection, just show error
        if (contractError.code === 'ACTION_REJECTED') {
          toast.error("Transaction was rejected by user.");
          throw contractError; // Re-throw to prevent simulation mode
        }
        
        // Handle "execution reverted" errors
        if (contractError.message && contractError.message.includes("execution reverted")) {
          toast.error(`Transaction failed: ${contractError.message}`);
          
          // Update transaction status to "failed" if we have a transaction ID
          if (currentTransactionId) {
            await updateTransactionStatus(currentTransactionId, "failed");
          }
          
          // Ask user if they want to try simulation mode
          const useSimulation = window.confirm(
            "The blockchain transaction failed. Would you like to try processing this transaction in simulation mode instead?"
          );
          
          if (useSimulation) {
            await processTransactionViaAPI();
          } else {
            throw new Error("Transaction failed. Please try again with different parameters.");
          }
        } else {
          // For all other errors, try simulation mode
          toast.error("Smart contract interaction failed. Using simulation mode instead.");
          await processTransactionViaAPI();
        }
      }
    } catch (error) {
      console.error("Transaction error:", error);

      let errorMessage = "Transaction failed";
      
      // User rejection
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = "Transaction was rejected by user.";
      } 
      // JSON-RPC errors (usually from the blockchain)
      else if (error.message && error.message.includes('JSON-RPC error')) {
        errorMessage = "Blockchain JSON-RPC error. The network may be congested or the contract may not support this transaction.";
      }
      // Insufficient balance
      else if (error.message && error.message.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for transaction. Please add more MATIC for gas fees.";
      }
      // Contract reversion
      else if (error.message && error.message.includes("execution reverted")) {
        errorMessage = "Smart contract rejected the transaction. This could be due to slippage, invalid parameters, or contract restrictions. Try with a smaller amount.";
      }
      // Our custom errors
      else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      setError(errorMessage);
      
      // Update transaction status to "failed" if we have a transaction ID
      if (currentTransactionId) {
        await updateTransactionStatus(currentTransactionId, "failed");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Render KYC verification required message
  const renderKycVerificationRequired = () => {
    if (isLoadingKyc) {
      return (
        <Card className="mb-4">
          <Card.Body className="text-center">
            <Spinner animation="border" size="sm" className="me-2" />
            <span>Checking verification status...</span>
          </Card.Body>
        </Card>
      );
    }

    if (!localKycStatus || !localKycStatus.verified) {
      return (
        <Alert variant="warning" className="mb-4">
          <Alert.Heading>KYC Verification Required</Alert.Heading>
          <p>
            You must complete KYC verification before making transactions. This is required for
            compliance with financial regulations.
          </p>
          <hr />
          <p className="mb-0">
            {localKycStatus?.pendingVerification ? (
              <>
                Your verification is currently pending review. This process typically takes 1-2 business days.
                You will be notified once your verification is complete.
              </>
            ) : (
              <>
                Please complete the verification process to unlock this feature.
                <div className="mt-3">
                  <Link to="/kyc">
                    <Button variant="primary">
                      Complete Verification
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </p>
        </Alert>
      );
    }

    return null;
  };

  return (
    <PageWrapper>
      <Container className="py-4">
        <h1 className="mb-4">Remittance Transfer</h1>
        
        {error && (
          <Alert variant="danger" className="mb-4" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {renderKycVerificationRequired()}
        
        {contractStatus && !contractStatus.working && (
          <Alert variant="warning" className="mb-4">
            <Alert.Heading>Smart Contract Status</Alert.Heading>
            <p>
              The smart contract is currently in {contractStatus.mode} mode. 
              Your transactions will be processed through the API backend.
            </p>
          </Alert>
        )}
        
        {/* Transaction Fee Breakdown - Shows bundled fees */}
        <TransactionFeesDisplay 
          fromToken={sendToken?.symbol} 
          toToken={receiveToken?.symbol} 
          amount={amount}
          triggerRefresh={refreshFees}
        />
        
        {/* Send Money Form */}
        <Card className="shadow mb-4">
          <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
            <div>Remittance Transfer Form</div>
            <Button 
              variant={useSimulationMode ? "success" : "outline-secondary"} 
              size="sm"
              onClick={toggleSimulationMode}
            >
              {useSimulationMode ? "Simulation Mode: ON" : "Simulation Mode: OFF"}
            </Button>
          </Card.Header>
          <Card.Body>
            <Form onSubmit={handleSendMoney}>
              {/* You Send Section */}
              <Card className="mb-4">
                <Card.Header>You Send</Card.Header>
                <Card.Body>
                  <Row className="align-items-center">
                    <Col md={4} className="mb-3 mb-md-0">
                      <TokenSelector 
                        onSelect={handleSendTokenChange}
                        defaultToken={sendToken}
                        type="crypto"
                        id="send"
                      />
                    </Col>
                    <Col md={8}>
                      <Form.Control
                        type="number"
                        value={amount}
                        onChange={handleAmountChange}
                        placeholder="0.00"
                        required
                        className="form-control-lg"
                        disabled={isProcessing}
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
              
              {/* Recipient Address Input */}
              <Form.Group className="mb-4">
                <Form.Label>Recipient Address</Form.Label>
                <Form.Control
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  required
                  className="form-control-lg"
                  disabled={isProcessing}
                />
              </Form.Group>
              
              {/* Recipient Gets Section */}
              <Card className="mb-4">
                <Card.Header>Recipient Gets</Card.Header>
                <Card.Body>
                  <Row className="align-items-center">
                    <Col md={4} className="mb-3 mb-md-0">
                      <TokenSelector 
                        onSelect={handleReceiveTokenChange}
                        defaultToken={receiveToken}
                        type="stablecoin"
                        id="receive"
                      />
                    </Col>
                    <Col md={8}>
                      <div className="p-2 bg-light rounded d-flex align-items-center justify-content-center border">
                        {convertedAmount !== null ? (
                          <h3 className="mb-0">
                            {parseFloat(convertedAmount).toLocaleString(undefined, { 
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 6
                            })} {receiveToken?.symbol || ""}
                          </h3>
                        ) : (
                          <span className="text-muted">
                            Select both tokens and enter amount to see converted value
                          </span>
                        )}
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
              
              {/* Submit Button */}
              <div className="d-grid">
                <Button 
                  variant="primary" 
                  size="lg" 
                  type="submit"
                  disabled={!wallet || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Processing {useSimulationMode ? "Simulation" : "Blockchain"} Transaction...
                    </>
                  ) : (
                    `Convert & Send via ${useSimulationMode ? "API (Simulation)" : "Blockchain"}`
                  )}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </PageWrapper>
  );
};

export default SendMoney;