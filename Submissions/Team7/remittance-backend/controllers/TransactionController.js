const Transaction = require("../models/Transaction");
const KYCModel = require("../models/KYC"); // Import KYC model to check verification status
const { sendRemittance, getRemittanceStatus, getConversionQuote } = require("../utils/blockchain");
const mockData = require("../utils/mockData");
const axios = require('axios');

const TransactionController = {
  /**
   * Creates a new transaction - with KYC verification check
   */
  async createTransaction(req, res) {
    try {
      const { recipient, token, amount, receiveToken, txHash } = req.body;
      const sender = req.user.id;

      if (!recipient || !token || !amount) {
        return res.status(400).json({ error: "Recipient, token, and amount are required" });
      }
      
      if (!Number.isFinite(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number" });
      }

      // Validate recipient address
      if (!recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: "Invalid recipient address format" });
      }
      
      // === CHECK KYC VERIFICATION STATUS ===
      // This is the new code to check if user is verified before allowing transactions
      const kycStatus = await KYCModel.getKYCStatusByUserId(sender);
      
      // If KYC status doesn't exist or user is not verified, prevent transaction
      if (!kycStatus || !kycStatus.verified) {
        return res.status(403).json({ 
          error: "KYC verification required",
          message: "You must complete KYC verification before making transactions",
          kycStatus: kycStatus || {
            verified: false,
            pendingVerification: false,
            completedSteps: []
          }
        });
      }

      // Log the complete transaction details
      console.log(`Creating transaction: ${amount} ${token} to ${recipient}, receive in ${receiveToken || 'USDC'}`);

      // Get conversion quote first
      let convertedAmount = null;
      try {
        const quoteResult = await getConversionQuote(token, amount);
        convertedAmount = quoteResult.convertedAmount;
        console.log(`Converted amount: ${amount} ${token} = ${convertedAmount} ${receiveToken || 'USDC'}`);
        
        // Handle case where conversion quote is 0 or invalid
        if (!convertedAmount || convertedAmount <= 0) {
          console.warn("Received invalid convertedAmount, using fallback calculation");
          // Use mock data as fallback
          const tokenPrice = mockData.tokenPrices[token]?.price || 1;
          const receiveTokenPrice = mockData.tokenPrices[receiveToken || 'USDC']?.price || 1;
          
          // Simple conversion based on token prices
          if (receiveTokenPrice > 0) {
            convertedAmount = (parseFloat(amount) * tokenPrice / receiveTokenPrice).toFixed(6);
            console.log(`Fallback converted amount: ${amount} ${token} = ${convertedAmount} ${receiveToken || 'USDC'}`);
          }
        }
      } catch (error) {
        console.warn("Error calculating converted amount:", error);
        // Fallback conversion calculation
        try {
          const tokenPrice = mockData.tokenPrices[token]?.price || 1;
          const receiveTokenPrice = mockData.tokenPrices[receiveToken || 'USDC']?.price || 1;
          
          if (receiveTokenPrice > 0) {
            convertedAmount = (parseFloat(amount) * tokenPrice / receiveTokenPrice).toFixed(6);
            console.log(`Fallback converted amount: ${amount} ${token} = ${convertedAmount} ${receiveToken || 'USDC'}`);
          }
        } catch (fallbackError) {
          console.error("Fallback conversion also failed:", fallbackError);
          // Last resort fallback (1:1 conversion)
          convertedAmount = parseFloat(amount).toFixed(6);
        }
      }

      // Send remittance to blockchain
      let finalTxHash = txHash || "0x";
      let blockNumber = 0;
      let remittanceId = 0;
      try {
        if (!txHash) {
          const result = await sendRemittance(recipient, token, amount);
          finalTxHash = result.txHash;
          blockNumber = result.blockNumber;
          remittanceId = result.remittanceId || 0;
          console.log(`Blockchain remittance successful: TX=${finalTxHash}, Block=${blockNumber}, ID=${remittanceId}`);
        } else {
          console.log(`Using provided transaction hash: ${finalTxHash}`);
        }
      } catch (blockchainError) {
        console.error("Blockchain interaction failed:", blockchainError);
        // Continue with database transaction, flagging as pending
        finalTxHash = finalTxHash || "pending_" + Date.now();
      }

      // Create transaction in database
      const newTransaction = await Transaction.createTransaction(
        sender,
        recipient,
        token,
        amount,
        finalTxHash,
        receiveToken || "USDC", // Use specified receive token or default to USDC
        convertedAmount
      );

      // Add remittance ID to the transaction object for the response
      newTransaction.remittanceId = remittanceId;
      console.log("Transaction created:", newTransaction);

      // Notify connected user via WebSocket
      const io = req.app.get("io");
      if (io && io.sendRealTimeUpdate) {
        const notificationSent = io.sendRealTimeUpdate(sender, "transactionCreated", newTransaction);
        if (notificationSent) {
          console.log(`Notification sent to user ${sender}`);
        } else {
          console.log(`User ${sender} not connected to WebSocket, no notification sent`);
        }
      }

      res.status(201).json(newTransaction);
    } catch (err) {
      console.error("Transaction creation error:", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  },

  /**
   * Gets all transactions for a user
   */
  async getUserTransactions(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query; // Default: 10 transactions per page
      
      // Validate pagination parameters
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: "Page must be a positive integer" });
      }
      
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({ error: "Limit must be between 1 and 100" });
      }
      
      const offset = (pageNum - 1) * limitNum;
      console.log(`Fetching transactions for user ${userId}, page ${pageNum}, limit ${limitNum}`);
      
      const transactions = await Transaction.getUserTransactions(userId, limitNum, offset);
      console.log(`Found ${transactions.transactions?.length || 0} transactions`);
      res.json(transactions);
    } catch (err) {
      console.error("Error fetching user transactions:", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  },

  /**
   * Updates a transaction's status
   */
  async updateTransactionStatus(req, res) {
    try {
      const { status } = req.body;
      const { id } = req.params;
      
      // Validate transaction ID
      if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: "Invalid transaction ID" });
      }
      
      if (!["pending", "processing", "completed", "failed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      console.log(`Updating transaction ${id} status to ${status}`);
      const updatedTransaction = await Transaction.updateTransactionStatus(id, status);
      
      // Notify user about status update via WebSocket
      const io = req.app.get("io");
      if (updatedTransaction && io && io.sendRealTimeUpdate) {
        const userId = updatedTransaction.sender;
        const notificationSent = io.sendRealTimeUpdate(userId, "transactionUpdate", updatedTransaction);
        if (notificationSent) {
          console.log(`Status update notification sent to user ${userId}`);
        }
      }
      
      res.json(updatedTransaction);
    } catch (err) {
      console.error("Error updating transaction status:", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  },

  /**
   * Gets the status of a specific transaction
   */
  async getTransactionStatus(req, res) {
    try {
      const { id } = req.params;
      
      // Validate transaction ID
      if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: "Invalid transaction ID" });
      }
      
      console.log(`Checking status for transaction ${id}`);
      const transaction = await Transaction.getTransactionById(id);
      
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      // If transaction exists and has blockchain_id, get status from blockchain
      let blockchainStatus = null;
      if (transaction.tx_hash && !transaction.tx_hash.startsWith("pending_")) {
        try {
          const remittanceId = transaction.remittance_id || 0;
          blockchainStatus = await getRemittanceStatus(remittanceId);
        } catch (blockchainError) {
          console.warn("Could not get blockchain status:", blockchainError);
          blockchainStatus = { status: "unknown", confirmations: 0 };
        }
      }

      res.json({ ...transaction, blockchainStatus });
    } catch (err) {
      console.error("Error checking transaction status:", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  },

  /**
   * Gets a conversion quote for a token pair
   */
  async getConversionQuote(req, res) {
    try {
      const { sourceToken, amount, targetToken = "USDC" } = req.query;
      
      if (!sourceToken || !amount) {
        return res.status(400).json({ error: "Source token and amount are required" });
      }
      
      if (!Number.isFinite(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number" });
      }
      
      console.log(`Getting conversion quote for ${amount} of ${sourceToken} to ${targetToken}`);
      
      try {
        // Try blockchain conversion first
        const quoteResult = await getConversionQuote(sourceToken, amount);
        
        // Check if the result is valid
        if (quoteResult && quoteResult.convertedAmount && parseFloat(quoteResult.convertedAmount) > 0) {
          console.log(`Conversion quote successful: ${amount} ${sourceToken} = ${quoteResult.convertedAmount} ${targetToken}`);
          res.json(quoteResult);
          return;
        } else {
          console.warn(`Invalid conversion quote from blockchain: ${JSON.stringify(quoteResult)}`);
          // Fall through to mock data
        }
      } catch (blockchainError) {
        console.warn("Blockchain conversion quote failed:", blockchainError);
        // Fall through to mock data
      }
      
      // Use mock data as fallback
      console.log("Using mock data for conversion quote");
      const sourcePrice = mockData.tokenPrices[sourceToken]?.price || 1;
      const targetPrice = mockData.tokenPrices[targetToken]?.price || 1;
      
      // Calculate conversion based on token prices
      const convertedAmount = targetPrice > 0 ? 
        (parseFloat(amount) * sourcePrice / targetPrice).toFixed(6) : 
        parseFloat(amount).toFixed(6);
      
      console.log(`Mock converted amount: ${amount} ${sourceToken} = ${convertedAmount} ${targetToken}`);
      
      const fallbackResult = {
        sourceAmount: amount,
        convertedAmount: convertedAmount,
        sourceToken: sourceToken,
        targetToken: targetToken,
        _source: 'mock'
      };
      
      res.json(fallbackResult);
    } catch (error) {
      console.error('Error getting conversion quote:', error);
      
      // Last resort fallback
      const fallbackAmount = parseFloat(amount).toFixed(6);
      
      res.json({
        sourceAmount: amount,
        convertedAmount: fallbackAmount,
        sourceToken: sourceToken,
        targetToken: targetToken || "USDC",
        _source: 'fallback',
        error: error.message
      });
    }
  }
};

module.exports = TransactionController;