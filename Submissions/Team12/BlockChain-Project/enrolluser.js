const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

async function main() {
    try {
        // Create a new file system-based wallet for managing identities
        const walletPath = path.join(__dirname, 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Load the connection profile for Org1
        const ccpPath = path.resolve(__dirname, 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        // Enroll the admin user to get its identity
        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            console.log('Admin identity not found in wallet. Enrolling admin...');
            const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: 'Org1MSP',
                type: 'X.509',
            };
            await wallet.put('admin', x509Identity);
            console.log('Successfully enrolled admin and imported it into the wallet');
        }

        // Get the admin identity
        const provider = wallet.getProviderRegistry().getProvider('X.509');
        const adminUser = await provider.getUserContext(await wallet.get('admin'), 'admin');

        // Function to register and enroll a user
        async function registerAndEnrollUser(userName, role) {
            // Check if the user already exists in the wallet
            const userIdentity = await wallet.get(userName);
            if (userIdentity) {
                console.log(`${userName} identity already exists in the wallet`);
                return;
            }

            // Register the user with the CA
            const secret = await ca.register({
                affiliation: 'org1.department1',
                enrollmentID: userName,
                role: 'client',
                attrs: [{ name: 'role', value: role, ecert: true }],
            }, adminUser);
            console.log(`Registered ${userName} with secret: ${secret}`);

            // Enroll the user to generate their certificate and private key
            const enrollment = await ca.enroll({
                enrollmentID: userName,
                enrollmentSecret: secret,
                attr_reqs: [{ name: 'role', optional: false }],
            });

            // Create the identity
            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: 'Org1MSP',
                type: 'X.509',
            };

            // Import the identity into the wallet
            await wallet.put(userName, x509Identity);
            console.log(`Successfully enrolled ${userName} and imported it into the wallet`);
        }

        // Register and enroll users for each role
        await registerAndEnrollUser('companyUser', 'company');
        await registerAndEnrollUser('auditorUser', 'auditor');
        await registerAndEnrollUser('regulatorUser', 'regulator');

    } catch (error) {
        console.error(`Failed to enroll users: ${error}`);
        process.exit(1);
    }
}

main();