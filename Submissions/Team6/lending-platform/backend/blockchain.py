# backend/blockchain.py

import os
import json
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

WEB3_PROVIDER_URL = os.getenv("WEB3_PROVIDER_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
FORWARDER_ADDRESS = os.getenv("FORWARDER_ADDRESS", None)

w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URL))
if not w3.is_connected():
    raise Exception("Failed to connect to blockchain")

# Helper to load ABI files with error handling
def load_contract_abi(filename):
    try:
        # Try first path
        import_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "abi", filename)
        if os.path.exists(import_path):
            with open(import_path, "r") as abi_file:
                artifact = json.load(abi_file)
                if isinstance(artifact, dict) and "abi" in artifact:
                    return artifact["abi"]
                else:
                    return artifact
        
        # Try alternative path
        alternative_path = os.path.join(os.path.dirname(__file__), "..", "contracts", filename)
        if os.path.exists(alternative_path):
            with open(alternative_path, "r") as abi_file:
                artifact = json.load(abi_file)
                if isinstance(artifact, dict) and "abi" in artifact:
                    return artifact["abi"]
                else:
                    return artifact
                
        # If we get here, neither path worked
        print(f"Warning: Could not find ABI file: {filename}")
        return None
        
    except Exception as e:
        print(f"Error loading ABI file {filename}: {e}")
        return None

# Load Lending Platform ABI
lending_abi = load_contract_abi("LendingPlatform.json")
if lending_abi:
    # Initialize lending contract
    lending_contract = w3.eth.contract(
        address=Web3.to_checksum_address(CONTRACT_ADDRESS),
        abi=lending_abi
    )
    print(f"Lending contract initialized at {CONTRACT_ADDRESS}")
else:
    print("Warning: Failed to initialize lending contract. ABI not found.")
    lending_contract = None

# Initialize forwarder contract if address is provided
forwarder_contract = None
if FORWARDER_ADDRESS:
    forwarder_abi = load_contract_abi("MinimalForwarder.json")
    if forwarder_abi:
        forwarder_contract = w3.eth.contract(
            address=Web3.to_checksum_address(FORWARDER_ADDRESS),
            abi=forwarder_abi
        )
        print(f"Forwarder contract initialized at {FORWARDER_ADDRESS}")
    else:
        # Provide a minimal ABI for basic functionality
        print("Warning: Using minimal forwarder ABI as file was not found")
        minimal_forwarder_abi = [
            {
                "inputs": [{"internalType": "address", "name": "", "type": "address"}],
                "name": "nonces",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "address", "name": "from", "type": "address"}],
                "name": "getNonce",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }
        ]
        
        forwarder_contract = w3.eth.contract(
            address=Web3.to_checksum_address(FORWARDER_ADDRESS),
            abi=minimal_forwarder_abi
        )
        print(f"Forwarder contract initialized with minimal ABI at {FORWARDER_ADDRESS}")

# Optional: Expose helpers to fetch information from contracts
def get_contract_admin():
    """Get admin address from the lending contract"""
    if lending_contract:
        try:
            return lending_contract.functions.admin().call()
        except Exception as e:
            print(f"Error getting admin: {e}")
    return None

def get_forwarder_nonce(user_address):
    """Get current nonce for a user from the forwarder contract"""
    if forwarder_contract:
        try:
            return forwarder_contract.functions.nonces(user_address).call()
        except Exception:
            # Try alternative function name
            try:
                return forwarder_contract.functions.getNonce(user_address).call()
            except Exception as e:
                print(f"Error fetching nonce: {e}")
    return None

# Print connection info at startup
print("Chain ID:", w3.eth.chain_id)
print(f"Connected to {WEB3_PROVIDER_URL}")
print(f"Lending contract at {CONTRACT_ADDRESS}")