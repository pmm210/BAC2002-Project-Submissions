import React, { useState, useCallback, useEffect, useContext } from "react";
import { Spinner } from "react-bootstrap";
import { toast } from "react-toastify";
import { ethers } from 'ethers';
import RemittanceContract from '../pages/RemittanceContract.json';

// Create a context for wallet state that can be used throughout the app
export const WalletContext = React.createContext({
  wallet: null,
  signer: null,
  contract: null,
  connectWallet: () => {},
  disconnectWallet: () => {},
  isConnecting: false
});

// Custom hook to use the wallet context
export const useWallet = () => useContext(WalletContext);

// Provider component to wrap your app
export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Environment variables
  const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0xD2085525fF19d8b5381161dD102c04904478A3EA';

  // Disconnect wallet function 
  const disconnectWallet = useCallback(() => {
    // Ensure isConnecting is reset to false
    setIsConnecting(false);
    setWallet(null);
    setSigner(null);
    setContract(null);
    
    localStorage.removeItem('walletConnected');
    
    toast.info("Wallet disconnected");
  }, []);

  // Connect wallet function
  const connectWallet = useCallback(async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    
    try {
      // Check for MetaMask
      if (!window.ethereum) {
        toast.error("MetaMask not detected. Please install MetaMask.");
        throw new Error("MetaMask not detected. Please install MetaMask to use this feature.");
      }
  
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: "eth_requestAccounts" 
      }).catch((error) => {
        // User denied account access
        toast.error("Failed to connect wallet. Please authorize access.");
        throw error;
      });
  
      if (!accounts || accounts.length === 0) {
        toast.error("No accounts found. Please check your MetaMask connection.");
        throw new Error("No accounts found. Please check your MetaMask connection.");
      }
      
      // Check network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const expectedChainId = '0x13882'; // Polygon Amoy Testnet chain ID in hex
      
      if (chainId !== expectedChainId) {
        try {
          // Attempt to switch network
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: expectedChainId }],
          });
        } catch (switchError) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: expectedChainId,
                  chainName: 'Polygon Amoy Testnet',
                  rpcUrls: ['https://rpc-amoy.polygon.technology/'],
                  nativeCurrency: {
                    name: 'MATIC',
                    symbol: 'MATIC',
                    decimals: 18
                  },
                  blockExplorerUrls: ['https://amoy.polygonscan.com/']
                }]
              });
            } catch (addError) {
              toast.error("Failed to add Polygon Amoy Testnet. Please add manually.");
              throw addError;
            }
          } else {
            toast.error("Failed to switch to Polygon Amoy Testnet.");
            throw switchError;
          }
        }
      }
      
      setWallet(accounts[0]);
      
      // Create a provider using specific configuration for Polygon Amoy
      const provider = new ethers.BrowserProvider(window.ethereum, {
        name: 'Polygon Amoy Testnet',
        chainId: 80002,
        // Use legacy transaction type (no EIP-1559)
        // Enforce type 0 transactions which don't use maxPriorityFeePerGas
        property: { type: 0 } 
      });
      
      // Create a signer from the provider
      const walletSigner = await provider.getSigner();
      setSigner(walletSigner);
      
      console.log("Connecting to contract at address:", CONTRACT_ADDRESS);
      
      // Initialize contract with signer
      if (CONTRACT_ADDRESS) {
        try {
          const contractInstance = new ethers.Contract(
            CONTRACT_ADDRESS,
            RemittanceContract.abi,
            walletSigner
          );
          
          setContract(contractInstance);
          
          // Verify contract connection
          try {
            const feePercentage = await contractInstance.platformFeePercentage();
            console.log("Contract fee percentage:", feePercentage.toString());
            toast.success("Smart contract connected successfully!");
          } catch (feeError) {
            console.warn("Could not get fee percentage:", feeError);
            toast.warning("Connected to wallet but smart contract interaction may be limited. Using simulation mode.");
            // Continue even if this specific call fails
          }
        } catch (contractError) {
          console.error("Contract initialization error:", contractError);
          toast.error(`Failed to initialize contract: ${contractError.message}`);
          throw contractError;
        }
      } else {
        toast.error("Contract address not configured.");
        throw new Error("Contract address not configured");
      }
      
      // Success toast
      toast.success(`Wallet Connected: ${accounts[0].substring(0, 6)}...${accounts[0].slice(-4)}`);
      
      localStorage.setItem('walletConnected', 'true');
    } catch (error) {
      console.error("Wallet connection error:", error);
      setWallet(null);
      setContract(null);
      setSigner(null);
      
      // Detailed error handling
      if (error.code === 4001) {
        toast.error("Connection rejected by user.");
      } else if (error.code === -32002) {
        toast.error("Request already in progress. Please open MetaMask.");
      } else {
        toast.error(error.message || "Wallet connection failed");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [CONTRACT_ADDRESS]);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        // Always reset connection state first
        setIsConnecting(false);
        
        if (accounts.length === 0) {
          // User disconnected their wallet
          disconnectWallet();
        } else if (wallet !== accounts[0]) {
          // User switched accounts
          setWallet(accounts[0]);
          toast.info(`Account changed to: ${accounts[0].substring(0, 6)}...${accounts[0].slice(-4)}`);
          
          // Reconnect with new account
          connectWallet();
        }
      };

      // Also listen for chain changes which should reset connection state
      const handleChainChanged = () => {
        setIsConnecting(false);
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      // Cleanup listeners
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [wallet, disconnectWallet, connectWallet]);

  return (
    <WalletContext.Provider value={{
      wallet,
      signer,
      contract,
      connectWallet,
      disconnectWallet,
      isConnecting
    }}>
      {children}
    </WalletContext.Provider>
  );
};

const WalletManager = () => {
  const { wallet, connectWallet, disconnectWallet, isConnecting } = useWallet();

  // Handler for disconnecting wallet
  const handleDisconnect = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset connecting state first, then disconnect
    disconnectWallet();
    
    // Force UI update
    setTimeout(() => {
      if (isConnecting) {
        window.location.reload();
      }
    }, 500);
  };

  // Handler for connecting wallet
  const handleConnect = (e) => {
    e.preventDefault();
    e.stopPropagation();
    connectWallet();
  };

  return wallet ? (
    <>
      <div className="dropdown-item-text">
        <small className="text-muted">Connected Wallet</small>
        <div className="d-flex align-items-center">
          <span className="text-success me-2">●</span>
          <span className="text-truncate">{wallet.substring(0, 6)}...{wallet.slice(-4)}</span>
        </div>
      </div>
      <div className="dropdown-divider"></div>
      <a
        href="#"
        className="dropdown-item text-danger"
        onClick={handleDisconnect}
        style={{ cursor: 'pointer' }}
      >
        Disconnect Wallet
      </a>
    </>
  ) : (
    <a
      href="#"
      className="dropdown-item"
      onClick={handleConnect}
      style={{ cursor: 'pointer' }}
    >
      {isConnecting ? (
        <>
          <Spinner animation="border" size="sm" className="me-2" />
          Connecting...
        </>
      ) : (
        "Connect Wallet"
      )}
    </a>
  );
};

export default WalletManager;