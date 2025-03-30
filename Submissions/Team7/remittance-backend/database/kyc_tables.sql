-- Create kyc_status table for storing user verification information
CREATE TABLE IF NOT EXISTS kyc_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL DEFAULT 0, -- 0: None, 1: Basic, 2: Intermediate, 3: Advanced
    verified BOOLEAN NOT NULL DEFAULT false,
    pending_verification BOOLEAN NOT NULL DEFAULT false,
    rejection_reason TEXT,
    completed_steps JSONB DEFAULT '[]'::jsonb,
    user_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_kyc_status_user_id ON kyc_status(user_id);

-- Create transfers_limits table to define limits based on KYC level
CREATE TABLE IF NOT EXISTS transfer_limits (
    id SERIAL PRIMARY KEY,
    kyc_level INTEGER NOT NULL UNIQUE, -- Add UNIQUE constraint here
    daily_limit DECIMAL(18, 8) NOT NULL,
    monthly_limit DECIMAL(18, 8) NOT NULL,
    transaction_limit DECIMAL(18, 8) NOT NULL,
    fee_percentage DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default transfer limits for each KYC level
INSERT INTO transfer_limits (kyc_level, daily_limit, monthly_limit, transaction_limit, fee_percentage)
VALUES 
    (0, 500, 2000, 200, 1.00),     -- No KYC: $500 daily, $2000 monthly, $200 per transaction, 1.0% fee
    (1, 1000, 5000, 500, 0.75),    -- Basic KYC: $1000 daily, $5000 monthly, $500 per transaction, 0.75% fee
    (2, 10000, 50000, 5000, 0.50), -- Intermediate KYC: $10,000 daily, $50,000 monthly, $5000 per transaction, 0.5% fee
    (3, 50000, 200000, 25000, 0.25) -- Advanced KYC: $50,000 daily, $200,000 monthly, $25000 per transaction, 0.25% fee
ON CONFLICT (kyc_level) DO UPDATE
SET 
    daily_limit = EXCLUDED.daily_limit,
    monthly_limit = EXCLUDED.monthly_limit,
    transaction_limit = EXCLUDED.transaction_limit,
    fee_percentage = EXCLUDED.fee_percentage,
    updated_at = CURRENT_TIMESTAMP;

-- Create kyc_documents table to track document uploads
CREATE TABLE IF NOT EXISTS kyc_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'id_front', 'id_back', 'selfie', 'proof_of_address'
    file_path VARCHAR(255) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    rejection_reason TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP
);

-- Create index for faster lookups by user_id and document_type
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_document_type ON kyc_documents(document_type);
