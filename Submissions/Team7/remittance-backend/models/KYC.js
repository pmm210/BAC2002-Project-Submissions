const pool = require("../config/db");

const KYCModel = {
    /**
     * Get KYC status by user ID
     * @param {number} userId - User ID
     * @returns {Promise<Object>} - KYC status object
     */
    async getKYCStatusByUserId(userId) {
        try {
            console.log(`Getting KYC status for user ${userId}`);
            
            // Check if kyc_status table exists
            const tableExists = await this.checkTableExists('kyc_status');
            
            if (tableExists) {
                // First check if user exists in kyc_status table
                const statusResult = await pool.query(
                    "SELECT * FROM kyc_status WHERE user_id = $1",
                    [userId]
                );
                
                // If user has a KYC status record
                if (statusResult.rows.length > 0) {
                    const kycStatus = statusResult.rows[0];
                    console.log(`Found KYC status for user ${userId}:`, kycStatus);
                    
                    // Check if the completed_steps field is present in the returned record
                    let completedSteps = [];
                    
                    // If there's a completed_steps column in the kyc_status table
                    if (kycStatus.completed_steps) {
                        // Check if it's an array, parse it if it's a string
                        if (typeof kycStatus.completed_steps === 'string') {
                            try {
                                completedSteps = JSON.parse(kycStatus.completed_steps);
                            } catch (e) {
                                console.warn("Error parsing completed_steps JSON:", e);
                                completedSteps = [];
                            }
                        } else if (Array.isArray(kycStatus.completed_steps)) {
                            completedSteps = kycStatus.completed_steps;
                        }
                    }
                    
                    return {
                        verified: kycStatus.verified || false,
                        pendingVerification: kycStatus.pending_verification || false,
                        completedSteps
                    };
                }
            }
            
            // If no table or no record exists, return default values
            console.log(`No KYC status found for user ${userId}`);
            return {
                verified: false,
                pendingVerification: false,
                completedSteps: []
            };
        } catch (error) {
            console.error(`Error getting KYC status for user ${userId}:`, error);
            
            // Return default values on error to avoid breaking the UI
            return {
                verified: false,
                pendingVerification: false,
                completedSteps: [],
                error: error.message
            };
        }
    },

    /**
     * Helper method to check if a table exists in the database
     * @param {string} tableName - Name of the table to check
     * @returns {Promise<boolean>} - True if table exists, false otherwise
     */
    async checkTableExists(tableName) {
        try {
            const result = await pool.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
                [tableName]
            );
            return result.rows[0].exists;
        } catch (error) {
            console.error(`Error checking if table ${tableName} exists:`, error);
            return false;
        }
    },

    /**
     * Watch for KYC status changes by user ID
     * @param {number} userId - User ID
     * @returns {Promise<Object>} - Current KYC status
     */
    async watchKYCStatus(userId) {
        try {
            // Get the current KYC status
            return await this.getKYCStatusByUserId(userId);
        } catch (error) {
            console.error(`Error watching KYC status for user ${userId}:`, error);
            return {
                verified: false,
                pendingVerification: false,
                completedSteps: [],
                error: error.message
            };
        }
    },

    /**
     * Complete a verification step
     * @param {number} userId - User ID
     * @param {string} stepName - Name of the step
     * @returns {Promise<Object>} - Updated KYC status
     */
    async completeStep(userId, stepName) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if the kyc_status table exists
            const tableExists = await this.checkTableExists('kyc_status');
            
            if (!tableExists) {
                // Create the table if it doesn't exist
                await client.query(`
                    CREATE TABLE IF NOT EXISTS kyc_status (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL UNIQUE,
                        verified BOOLEAN DEFAULT FALSE,
                        pending_verification BOOLEAN DEFAULT FALSE,
                        completed_steps TEXT DEFAULT '[]',
                        rejection_reason TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            }
            
            // First check if user has a kyc_status entry
            const statusCheck = await client.query(
                "SELECT * FROM kyc_status WHERE user_id = $1",
                [userId]
            );
            
            let completedSteps = [];
            
            // If entry exists, get current completed steps
            if (statusCheck.rows.length > 0) {
                const currentSteps = statusCheck.rows[0].completed_steps;
                if (currentSteps) {
                    try {
                        if (typeof currentSteps === 'string') {
                            completedSteps = JSON.parse(currentSteps);
                        } else if (Array.isArray(currentSteps)) {
                            completedSteps = currentSteps;
                        }
                    } catch (e) {
                        console.warn("Error parsing completed_steps:", e);
                    }
                }
            }
            
            // Add new step if not already present
            if (!completedSteps.includes(stepName)) {
                completedSteps.push(stepName);
            }
            
            const completedStepsJson = JSON.stringify(completedSteps);
            
            let pendingVerification = false;
            // Set pending_verification to true if this is the final step
            if (stepName === "document_verification" || completedSteps.length >= 4) {
                pendingVerification = true;
            }
            
            if (statusCheck.rows.length === 0) {
                // Insert a new record
                await client.query(
                    `INSERT INTO kyc_status 
                    (user_id, verified, pending_verification, completed_steps) 
                    VALUES ($1, false, $2, $3)`,
                    [userId, pendingVerification, completedStepsJson]
                );
            } else {
                // Update existing record
                await client.query(
                    `UPDATE kyc_status 
                    SET pending_verification = $1, completed_steps = $2, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $3`,
                    [pendingVerification, completedStepsJson, userId]
                );
            }
            
            await client.query('COMMIT');
            
            // Return the updated status
            return await this.getKYCStatusByUserId(userId);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error completing KYC step for user ${userId}:`, error);
            return {
                verified: false,
                pendingVerification: false,
                completedSteps: [],
                error: error.message
            };
        } finally {
            client.release();
        }
    }
};

module.exports = KYCModel;