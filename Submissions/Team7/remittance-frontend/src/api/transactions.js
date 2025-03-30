import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Creates a new transaction
 * @param {string} token - JWT token
 * @param {string} recipient - Recipient address
 * @param {string} tokenSymbol - Token symbol (e.g., "USDC")
 * @param {number} amount - Amount to send
 * @param {string} receiveTokenSymbol - Token symbol the recipient will receive (e.g., "USDC")
 * @param {string} txHash - Blockchain transaction hash (optional)
 * @returns {Promise<Object>} - Transaction data
 */
export const createTransaction = async (token, recipient, tokenSymbol, amount, receiveTokenSymbol = "USDC", txHash = null) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/transactions`,
      { 
        recipient, 
        token: tokenSymbol, 
        amount,
        receiveToken: receiveTokenSymbol,
        txHash
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw new Error(error.response?.data?.message || 'Failed to create transaction');
  }
};

/**
 * Gets all transactions for the current user
 * @param {string} token - JWT token
 * @param {number} page - Page number (optional)
 * @param {number} limit - Results per page (optional)
 * @returns {Promise<Object>} - Transactions data with pagination
 */
export const getTransactions = async (token, page = 1, limit = 10) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transactions`, {
      params: { page, limit },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch transactions');
  }
};

/**
 * Gets a single transaction by ID
 * @param {string} token - JWT token
 * @param {number} id - Transaction ID
 * @returns {Promise<Object>} - Transaction data
 */
export const getTransaction = async (token, id) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transactions/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching transaction ${id}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to fetch transaction');
  }
};