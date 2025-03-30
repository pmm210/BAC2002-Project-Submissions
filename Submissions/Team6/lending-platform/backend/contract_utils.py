import os
import json
from web3 import Web3
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

WEB3_PROVIDER_URL = os.getenv("WEB3_PROVIDER_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")

# Initialize the Web3 provider
w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URL))
if not w3.is_connected():
    raise Exception("Failed to connect to blockchain")

# Determine the path to your ABI file
current_dir = os.path.dirname(os.path.abspath(__file__))
abi_path = os.path.join(current_dir, "..", "frontend", "abi", "LendingPlatform.json")

# Load the ABI
with open(abi_path, "r") as abi_file:
    artifact = json.load(abi_file)
    if isinstance(artifact, dict) and "abi" in artifact:
        lending_abi = artifact["abi"]
    else:
        lending_abi = artifact

# Create the contract instance
lending_contract = w3.eth.contract(
    address=Web3.to_checksum_address(CONTRACT_ADDRESS),
    abi=lending_abi
)
