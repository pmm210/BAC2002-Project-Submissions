const express = require('express');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fabric network configuration
const ccpPath = path.resolve(__dirname, 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
const walletPath = path.join(__dirname, 'wallet');

// Initialize wallet
async function initializeWallet() {
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    return wallet;
}

// Connect to the Fabric network with the specified identity
async function connectToNetwork(wallet, identityName) {
    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: identityName,
        discovery: { enabled: true, asLocalhost: true },
    });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('financial_audit');
    return { gateway, contract };
}

// API: Get all claims (All)
app.get('/api/claims', async (req, res) => {
    const role = req.headers['x-user-role'] || 'auditor';
    let identityName;
    if (role === 'auditor') {
        identityName = 'auditorUser';
    } else if (role === 'regulator') {
        identityName = 'regulatorUser';
    } else if (role === 'company') {
        identityName = 'companyUser';
    } else {
        return res.status(403).json({ message: 'Only auditors, regulators, and companies can view claims' });
    }

    try {
        const wallet = await initializeWallet();
        const identity = await wallet.get(identityName);
        if (!identity) {
            throw new Error(`${identityName} identity not found in wallet. Please run enrollUser.js.`);
        }

        const { gateway, contract } = await connectToNetwork(wallet, identityName);
        const result = await contract.evaluateTransaction('QueryAllClaims');
        if (!result || result.length === 0) {
            await gateway.disconnect();
            return res.status(200).json([]); // Return empty array if no claims
        }
        const claims = JSON.parse(result.toString());
        await gateway.disconnect();
        res.json(claims);
    } catch (error) {
        console.error('Error fetching claims:', error);
        res.status(500).json({ message: 'Failed to fetch claims', error: error.message });
    }
});

// API: Get claims by year (Auditor and Regulator only)
app.get('/api/claims/year/:year', async (req, res) => {
    const role = req.headers['x-user-role'] || 'auditor';
    let identityName;
    if (role === 'auditor') {
        identityName = 'auditorUser';
    } else if (role === 'regulator') {
        identityName = 'regulatorUser';
    } else {
        return res.status(403).json({ message: 'Only auditors and regulators can fetch claims by year' });
    }

    try {
        const wallet = await initializeWallet();
        const identity = await wallet.get(identityName);
        if (!identity) {
            throw new Error(`${identityName} identity not found in wallet. Please run enrollUser.js.`);
        }

        const { gateway, contract } = await connectToNetwork(wallet, identityName);
        const result = await contract.evaluateTransaction('QueryClaimsByYear', req.params.year);
        const summary = JSON.parse(result.toString()); // Parse the JSON string
        await gateway.disconnect();
        res.json({
            year: req.params.year,
            totalApprovedAmount: summary.totalAmount,
            totalApprovedClaims: summary.totalApprovedClaims
        });
    } catch (error) {
        console.error('Error fetching claims by year:', error);
        res.status(500).json({ message: 'Failed to fetch claims by year', error: error.message });
    }
});

// API: Submit new claim (Company only)
app.post('/api/claims', async (req, res) => {
    const role = req.headers['x-user-role'] || 'company';
    if (role !== 'company') {
        return res.status(403).json({ message: 'Only companies can submit claims' });
    }

    const identityName = 'companyUser';
    const { id, description, amount, submittedBy } = req.body;
    if (!id || !description || !amount || !submittedBy) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const status = 'Submitted'; // Default status for new claims

    try {
        const wallet = await initializeWallet();
        const identity = await wallet.get(identityName);
        if (!identity) {
            throw new Error(`${identityName} identity not found in wallet. Please run enrollUser.js.`);
        }

        const { gateway, contract } = await connectToNetwork(wallet, identityName);
        await contract.submitTransaction(
            'CreateClaim',
            id,
            description,
            amount.toString(),
            status,
            submittedBy,
            new Date().toISOString()
        );
        await gateway.disconnect();
        res.status(201).json({ message: 'Claim submitted successfully', claim: { id, description, amount, status, submittedBy } });
    } catch (error) {
        console.error('Error submitting claim:', error);
        res.status(500).json({ message: 'Failed to submit claim', error: error.message });
    }
});

// API: Update claim status (Auditor only)
app.put('/api/claims/:id', async (req, res) => {
    const role = req.headers['x-user-role'] || 'auditor';
    if (role !== 'auditor') {
        return res.status(403).json({ message: 'Only auditors can update claims' });
    }

    const identityName = 'auditorUser';
    const { status } = req.body;
    if (!status) {
        return res.status(400).json({ message: 'Status is required' });
    }

    try {
        const wallet = await initializeWallet();
        const identity = await wallet.get(identityName);
        if (!identity) {
            throw new Error(`${identityName} identity not found in wallet. Please run enrollUser.js.`);
        }

        const { gateway, contract } = await connectToNetwork(wallet, identityName);
        await contract.submitTransaction('UpdateClaimStatus', req.params.id, status);
        await gateway.disconnect();
        res.json({ message: 'Claim status updated successfully' });
    } catch (error) {
        console.error('Error updating claim:', error);
        res.status(500).json({ message: 'Failed to update claim', error: error.message });
    }
});

// Fallback: serve role selection page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'role.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});