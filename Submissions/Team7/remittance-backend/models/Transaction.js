const pool = require("../config/db");
const axios = require('axios');

/**
 * Execute a database query with retry logic
 * @param {Function} queryFn - Function that performs the database query
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<any>} - Query result
 */
async function executeWithRetry(queryFn, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;
            
            // Check if the error is transient and can be retried
            const isTransientError = 
                error.code === 'ECONNRESET' || 
                error.code === 'ETIMEDOUT' || 
                error.code === 'ECONNREFUSED' ||
                error.message.includes('Connection terminated unexpectedly');
            
            if (!isTransientError || attempt === maxRetries) {
                console.error(`Query failed after ${attempt} attempts:`, error);
                throw error;
            }
            
            // Exponential backoff with jitter
            const baseDelay = 100; // ms
            const maxDelay = 2000; // 2 seconds max
            const delay = Math.min(
                Math.floor(Math.random() * baseDelay * Math.pow(2, attempt)),
                maxDelay
            );
            
            console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

/**
 * Validates if a value is a positive integer
 * @param {any} value - Value to check
 * @returns {boolean} - True if value is a positive integer
 */
function isPositiveInteger(value) {
    // Convert to number if it's a string
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    // Check if it's a positive integer
    return Number.isInteger(num) && num > 0;
}

/**
 * Check transaction status on Polygonscan
 * @param {string} txHash - Transaction hash to check
 * @param {boolean} isTestnet - Whether to use testnet (Amoy) or mainnet
 * @returns {Promise<Object>} - Status information
 */
async function checkTransactionOnPolygonscan(txHash, isTestnet = true) {
    try {
        if (!txHash || txHash.startsWith("pending_")) {
            return { status: "pending", confirmations: 0 };
        }
        
        // Choose the appropriate API URL
        const apiUrl = isTestnet
            ? `https://api-amoy.polygonscan.com/api`
            : `https://api.polygonscan.com/api`;
        
        // Use Polygonscan API to check transaction status
        const apiKey = process.env.POLYGONSCAN_API_KEY || "UTRWBFJQX1FCU5TYNCC1AZYENUU5H8QMZG";
        
        const response = await axios.get(apiUrl, {
            params: {
                module: 'transaction',
                action: 'gettxreceiptstatus',
                txhash: txHash,
                apikey: apiKey
            },
            timeout: 5000 // 5 second timeout
        });
        
        if (response.data && response.data.result) {
            // Status 1 = success, 0 = failure/pending
            const txStatus = parseInt(response.data.result.status, 10);
            
            if (txStatus === 1) {
                return { status: "completed", confirmations: 1 };
            } else if (txStatus === 0) {
                // For failed transactions
                return { status: "failed", confirmations: 0 };
            }
        }
        
        // If we can't determine status, try getting transaction receipt
        const receiptResponse = await axios.get(apiUrl, {
            params: {
                module: 'proxy',
                action: 'eth_getTransactionReceipt',
                txhash: txHash,
                apikey: apiKey
            },
            timeout: 5000
        });
        
        if (receiptResponse.data && receiptResponse.data.result) {
            const receipt = receiptResponse.data.result;
            
            if (receipt.status === "0x1") {
                return { status: "completed", confirmations: 1 };
            } else if (receipt.status === "0x0") {
                return { status: "failed", confirmations: 0 };
            }
        }
        
        // Default to pending if we couldn't determine status
        return { status: "pending", confirmations: 0 };
    } catch (error) {
        console.error(`Error checking transaction ${txHash} on Polygonscan:`, error);
        return { status: "unknown", error: error.message };
    }
}

const Transaction = {
    /**
     * Creates a new transaction with support for receive_token and converted_amount
     * Uses fallback methods if columns don't exist
     * 
     * @param {number} sender - Sender user ID
     * @param {string} recipient - Recipient wallet address
     * @param {string} token - Token symbol being sent
     * @param {number} amount - Amount being sent
     * @param {string} txHash - Transaction hash
     * @param {string} receiveToken - Token the recipient receives (default is dynamic)
     * @param {number} convertedAmount - Converted amount after exchange (optional)
     * @returns {Promise<Object>} - Created transaction object
     */
    async createTransaction(sender, recipient, token, amount, txHash, receiveToken, convertedAmount = null) {
        const result = await executeWithRetry(async () => {
            console.log(`Creating transaction: sender=${sender}, recipient=${recipient}, token=${token}, amount=${amount}, receiveToken=${receiveToken}, convertedAmount=${convertedAmount}`);
            
            let status = "pending";
            
            // If transaction has a valid hash, check its status on Polygonscan
            if (txHash && !txHash.startsWith("pending_")) {
                const txStatus = await checkTransactionOnPolygonscan(txHash);
                if (txStatus.status === "completed") {
                    status = "completed";
                } else if (txStatus.status === "failed") {
                    status = "failed";
                }
            }
            
            // Try the most complete query first with all columns
            try {
                const newTransaction = await pool.query(
                    `INSERT INTO transactions 
                     (sender, recipient, token, amount, status, tx_hash, receive_token, converted_amount) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                    [sender, recipient, token, amount, status, txHash, receiveToken, convertedAmount]
                );
                
                console.log("Transaction created with all columns:", newTransaction.rows[0]);
                return newTransaction.rows[0];
            } catch (error) {
                // If the error is about missing receive_token column
                if (error.message.includes("column \"receive_token\" of relation \"transactions\" does not exist")) {
                    console.log("receive_token column doesn't exist, trying without it");
                    
                    // Try inserting without receive_token and converted_amount
                    const newTransaction = await pool.query(
                        `INSERT INTO transactions 
                         (sender, recipient, token, amount, status, tx_hash) 
                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                        [sender, recipient, token, amount, status, txHash]
                    );
                    
                    // Add the missing fields to the returned object
                    const result = {
                        ...newTransaction.rows[0],
                        receive_token: receiveToken,
                        converted_amount: convertedAmount
                    };
                    
                    console.log("Transaction created with manual fields:", result);
                    return result;
                } 
                // If the error is about missing converted_amount but receive_token exists
                else if (error.message.includes("column \"converted_amount\" of relation \"transactions\" does not exist")) {
                    console.log("converted_amount column doesn't exist, trying without it");
                    
                    // Try inserting with receive_token but without converted_amount
                    const newTransaction = await pool.query(
                        `INSERT INTO transactions 
                         (sender, recipient, token, amount, status, tx_hash, receive_token) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                        [sender, recipient, token, amount, status, txHash, receiveToken]
                    );
                    
                    // Add the missing field to the returned object
                    const result = {
                        ...newTransaction.rows[0],
                        converted_amount: convertedAmount
                    };
                    
                    console.log("Transaction created with manual converted_amount:", result);
                    return result;
                } else {
                    // Re-throw any other errors
                    throw error;
                }
            }
        });
        
        // Set up an automatic status check for the transaction if it has a valid hash
        if (result && result.tx_hash && !result.tx_hash.startsWith("pending_") && result.status === "pending") {
            this.setupStatusCheck(result.id, result.tx_hash);
        }
        
        return result;
    },

    /**
     * Set up periodic status check for a transaction
     * @param {number} transactionId - Transaction ID 
     * @param {string} txHash - Transaction hash
     */
    async setupStatusCheck(transactionId, txHash) {
        // Initial delay before first check (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check the transaction status on Polygonscan
        const txStatus = await checkTransactionOnPolygonscan(txHash);
        console.log(`Auto-checking transaction ${transactionId} (${txHash}): ${JSON.stringify(txStatus)}`);
        
        if (txStatus.status === "completed") {
            // Update transaction to completed
            await this.updateTransactionStatus(transactionId, "completed");
            console.log(`Transaction ${transactionId} auto-updated to completed`);
            return;
        } else if (txStatus.status === "failed") {
            // Update transaction to failed
            await this.updateTransactionStatus(transactionId, "failed");
            console.log(`Transaction ${transactionId} auto-updated to failed`);
            return;
        }
        
        // If still pending, check again in 15 seconds
        // Only check a few times to avoid infinite loops
        const maxChecks = 4; // Maximum 4 checks (initial + 3 more)
        
        for (let check = 0; check < maxChecks; check++) {
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second interval
            
            const latestStatus = await checkTransactionOnPolygonscan(txHash);
            console.log(`Auto-checking transaction ${transactionId} (${txHash}) attempt ${check + 1}/${maxChecks}: ${JSON.stringify(latestStatus)}`);
            
            if (latestStatus.status === "completed") {
                await this.updateTransactionStatus(transactionId, "completed");
                console.log(`Transaction ${transactionId} auto-updated to completed`);
                return;
            } else if (latestStatus.status === "failed") {
                await this.updateTransactionStatus(transactionId, "failed");
                console.log(`Transaction ${transactionId} auto-updated to failed`);
                return;
            }
        }
        
        console.log(`Auto-check complete for transaction ${transactionId} without status change`);
    },

    async getUserTransactions(userId, limit = 10, offset = 0) {
        // Validate userId to prevent SQL injection
        if (!isPositiveInteger(userId)) {
            console.error(`Invalid user ID: ${userId}`);
            throw new Error("Invalid user ID provided");
        }
        
        return executeWithRetry(async () => {
            // Convert userId to integer if it's not already
            const userIdInt = parseInt(userId, 10);
            console.log(`Getting transactions for user ${userIdInt}, limit=${limit}, offset=${offset}`);
            
            // Check what columns exist in the transactions table
            const columnsResult = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='transactions' AND table_schema='public'
            `);
            
            const existingColumns = columnsResult.rows.map(row => row.column_name);
            const hasReceiveToken = existingColumns.includes('receive_token');
            const hasConvertedAmount = existingColumns.includes('converted_amount');
            
            console.log("Existing columns check:", {
                hasReceiveToken,
                hasConvertedAmount
            });
            
            // Build columns for SELECT based on what exists
            const selectColumns = `
                t.id, 
                t.sender, 
                t.recipient, 
                t.token, 
                t.amount, 
                t.status, 
                t.tx_hash,
                t.created_at,
                ${hasReceiveToken ? 't.receive_token,' : ''}
                ${hasConvertedAmount ? 't.converted_amount,' : ''}
                u.username AS sender_name
            `.trim();
            
            // Get total count of user's transactions
            const totalCountQuery = await pool.query(
                `SELECT COUNT(*) FROM transactions WHERE sender = $1`,
                [userIdInt]
            );
            const totalCount = parseInt(totalCountQuery.rows[0].count, 10);
            
            // Calculate total pages
            const totalPages = Math.ceil(totalCount / limit);
            
            // Execute the query
            const queryText = `
                SELECT ${selectColumns}
                FROM transactions t
                JOIN users u ON t.sender = u.id
                WHERE t.sender = $1
                ORDER BY t.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            console.log("Executing query with columns:", selectColumns);
            
            const transactions = await pool.query(queryText, [userIdInt, limit, offset]);
            
            // If columns don't exist in DB, add them to the result objects
            let processedTransactions = transactions.rows;
            
            if (!hasReceiveToken || !hasConvertedAmount) {
                processedTransactions = transactions.rows.map(tx => {
                    const result = { ...tx };
                    
                    // Add default receive_token if the column doesn't exist
                    if (!hasReceiveToken && !result.receive_token) {
                        result.receive_token = "USDC"; // Default
                    }
                    
                    // Add null converted_amount if the column doesn't exist
                    if (!hasConvertedAmount && result.converted_amount === undefined) {
                        result.converted_amount = null;
                    }
                    
                    return result;
                });
            }
            
            // Check and update pending transactions with valid tx_hash
            for (const tx of processedTransactions) {
                if (tx.status === "pending" && tx.tx_hash && !tx.tx_hash.startsWith("pending_")) {
                    const txStatus = await checkTransactionOnPolygonscan(tx.tx_hash);
                    
                    if (txStatus.status === "completed" || txStatus.status === "failed") {
                        // Update transaction status in database
                        await this.updateTransactionStatus(tx.id, txStatus.status);
                        // Update the status in our results
                        tx.status = txStatus.status;
                    }
                }
            }
            
            console.log(`Found ${processedTransactions.length} transactions for user ${userIdInt}`);
            
            // Return paginated result
            return {
                transactions: processedTransactions,
                total: totalCount,
                page: Math.floor(offset / limit) + 1,
                pages: totalPages,
                limit
            };
        });
    },

    async updateTransactionStatus(id, status) {
        // Validate ID to prevent SQL injection
        if (!isPositiveInteger(id)) {
            console.error(`Invalid transaction ID: ${id}`);
            throw new Error("Invalid transaction ID provided");
        }
        
        return executeWithRetry(async () => {
            console.log(`Updating transaction ${id} status to ${status}`);
            const updatedTransaction = await pool.query(
                "UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *",
                [status, id]
            );
            
            if (updatedTransaction.rows.length === 0) {
                throw new Error(`Transaction with ID ${id} not found`);
            }
            
            console.log("Transaction updated:", updatedTransaction.rows[0]);
            return updatedTransaction.rows[0];
        });
    },
    
    async getTransactionById(id) {
        // Validate ID to prevent SQL injection and errors
        if (!isPositiveInteger(id)) {
            console.error(`Invalid transaction ID: ${id}`);
            throw new Error("Invalid transaction ID provided");
        }
        
        return executeWithRetry(async () => {
            console.log(`Getting transaction by ID: ${id}`);
            
            // Check what columns exist in the transactions table
            const columnsResult = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='transactions' AND table_schema='public'
            `);
            
            const existingColumns = columnsResult.rows.map(row => row.column_name);
            const hasReceiveToken = existingColumns.includes('receive_token');
            const hasConvertedAmount = existingColumns.includes('converted_amount');
            
            const transaction = await pool.query(
                "SELECT * FROM transactions WHERE id = $1",
                [id]
            );
            
            if (transaction.rows.length === 0) {
                return null;
            }
            
            // Add virtual columns if they don't exist in DB
            let result = transaction.rows[0];
            
            if (!hasReceiveToken && !result.receive_token) {
                result.receive_token = "USDC"; // Default
            }
            
            if (!hasConvertedAmount && result.converted_amount === undefined) {
                result.converted_amount = null;
            }
            
            // Check if we need to update the status by checking blockchain
            if (result.status === "pending" && result.tx_hash && !result.tx_hash.startsWith("pending_")) {
                const txStatus = await checkTransactionOnPolygonscan(result.tx_hash);
                
                if (txStatus.status === "completed" || txStatus.status === "failed") {
                    // Update transaction status in database
                    await this.updateTransactionStatus(id, txStatus.status);
                    // Update the status in our result
                    result.status = txStatus.status;
                }
            }
            
            console.log("Transaction found:", result);
            return result;
        });
    }
};

module.exports = Transaction;