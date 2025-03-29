import json
import time
import os
from web3 import Web3
import psycopg2
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("blockchain_listener.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("blockchain_listener")

# Environment variables
CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS', '0x1159d7d7F1f55C8c31265a59Bb6A952917896C8E')
POLYGON_AMOY_RPC = os.getenv('POLYGON_AMOY_RPC', 'https://polygon-amoy.g.alchemy.com/v2/fHKyGrLKWcmZxxDL3on5gp-ZNkTn7G9A')
DB_URL = os.getenv('DB_URL', 'postgresql://postgres.lhjufhdvrctcnxrjtpld:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres')

# Connect to blockchain
w3 = Web3(Web3.HTTPProvider(POLYGON_AMOY_RPC))
if not w3.is_connected():
    logger.error("Failed to connect to Ethereum node")
    exit(1)
logger.info(f"Connected to blockchain: {w3.is_connected()}")

# Load contract ABI
def load_contract_abi():
    # ABI file path
    abi_file = 'contract_abi.json'
    
    # Check if ABI file exists, if not create one with minimal ABI needed
    if not os.path.exists(abi_file):
        # This is a minimal ABI with just the events we need to listen for
        minimal_abi = [
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "policyId", "type": "bytes32"},
                    {"indexed": True, "name": "policyholder", "type": "address"},
                    {"indexed": False, "name": "payoutAmount", "type": "uint256"}
                ],
                "name": "PolicyClaimed",
                "type": "event"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "policyId", "type": "bytes32"},
                    {"indexed": False, "name": "flightIata", "type": "string"},
                    {"indexed": False, "name": "isDelayed", "type": "bool"},
                    {"indexed": False, "name": "delayMinutes", "type": "uint256"}
                ],
                "name": "FlightStatusChecked",
                "type": "event"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "user", "type": "address"},
                    {"indexed": False, "name": "policyId", "type": "bytes32"},
                    {"indexed": false, "name": "flightNumber", "type": "string"}
                ],
                "name": "PolicyPurchased",
                "type": "event"
            }
        ]
        with open(abi_file, 'w') as f:
            json.dump(minimal_abi, f)
        logger.info(f"Created minimal ABI file at {abi_file}")
    
    # Load ABI from file
    with open(abi_file, 'r') as f:
        return json.load(f)

# Initialize contract
contract_abi = load_contract_abi()
contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)
logger.info(f"Contract initialized at address: {CONTRACT_ADDRESS}")

# Database connection
def get_db_connection():
    try:
        conn = psycopg2.connect(DB_URL)
        conn.autocommit = True
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise

# Ensure the database has the necessary tables
def setup_database():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create app_settings table if it doesn't exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    
    # Check if last_processed_block exists, if not insert it
    cursor.execute("SELECT value FROM app_settings WHERE key = 'last_processed_block'")
    if not cursor.fetchone():
        # Start from current block minus 10000 to catch recent events
        current_block = w3.eth.block_number
        start_block = max(0, current_block - 10000)
        cursor.execute(
            "INSERT INTO app_settings (key, value) VALUES ('last_processed_block', %s)",
            (str(start_block),)
        )
        logger.info(f"Initialized last_processed_block to {start_block}")
    
    cursor.close()
    conn.close()

# Get the last processed block
def get_last_processed_block():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM app_settings WHERE key = 'last_processed_block'")
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return int(result[0]) if result else 0

# Update the last processed block
def update_last_processed_block(block_number):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE app_settings SET value = %s WHERE key = 'last_processed_block'",
        (str(block_number),)
    )
    cursor.close()
    conn.close()
    logger.info(f"Updated last processed block to {block_number}")

def process_policy_purchased_event(event):
    try:
        # Extract event data
        user = event.args.user
        policy_id = event.args.policyId
        flight_number = event.args.flightNumber
        tx_hash = event.transactionHash.hex()
        
        # Convert policy_id to hex string without '0x' prefix if needed
        policy_id_hex = policy_id.hex() if isinstance(policy_id, bytes) else policy_id
        
        logger.info(f"Processing PolicyPurchased event:")
        logger.info(f"  User: {user}")
        logger.info(f"  Policy ID: {policy_id_hex}")
        logger.info(f"  Flight: {flight_number}")
        logger.info(f"  Transaction: {tx_hash}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First, check if a policy already exists with this exact combination (case-insensitive)
        cursor.execute(
            """
            SELECT id, blockchain_policy_id FROM policies 
            WHERE LOWER(wallet_address) = LOWER(%s) 
            AND LOWER(flight_id) = LOWER(%s)
            """,
            (user, flight_number)
        )
        
        existing_policy = cursor.fetchone()
        
        if existing_policy:
            db_policy_id, existing_blockchain_policy_id = existing_policy
            
            # If blockchain_policy_id is already set, do nothing
            if existing_blockchain_policy_id:
                logger.info(f"Policy already exists with blockchain ID for flight {flight_number}")
                cursor.close()
                conn.close()
                return
            
            # Update existing policy with blockchain details
            cursor.execute(
                """
                UPDATE policies 
                SET blockchain_policy_id = %s,
                    transaction_id = %s,
                    status = 'ACTIVE'
                WHERE id = %s
                """,
                (policy_id_hex, tx_hash, db_policy_id)
            )
            logger.info(f"Updated existing policy {db_policy_id} with blockchain details")
        else:
            # Log a warning instead of creating a new policy
            logger.warning(f"No matching policy found for user {user} and flight {flight_number}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error processing PolicyPurchased event: {e}")
        if conn:
            conn.rollback()
            cursor.close()
            conn.close()

def update_policy_by_blockchain_id(blockchain_policy_id, new_status, additional_data=None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Convert bytes32 policy_id to hex string, ensuring '0x' prefix
        if isinstance(blockchain_policy_id, bytes):
            policy_id_hex = '0x' + blockchain_policy_id.hex()
        else:
            # Ensure '0x' prefix
            policy_id_hex = blockchain_policy_id if blockchain_policy_id.startswith('0x') else '0x' + blockchain_policy_id
            
        logger.info(f"Looking for policy with blockchain_policy_id: {policy_id_hex}")
        
        # Remove '0x' for comparison to handle both formats
        policy_id_no_prefix = policy_id_hex[2:] if policy_id_hex.startswith('0x') else policy_id_hex
        
        # Additional matching strategies
        matching_strategies = [
            # Strategy 1: Exact blockchain_policy_id match (with '0x')
            f"""
            SELECT id, status FROM policies 
            WHERE blockchain_policy_id = '{policy_id_hex}'
            """,
            
            # Strategy 2: Match without '0x' prefix
            f"""
            SELECT id, status FROM policies 
            WHERE blockchain_policy_id = '{policy_id_no_prefix}'
            """,
            
            # Strategy 3: Match by flight number and wallet address
            f"""
            SELECT id, status FROM policies 
            WHERE flight_id = '{additional_data.get('flight_id', '')}' 
            AND wallet_address = '{additional_data.get('policyholder', '')}'
            """
        ]
        
        policy = None
        for strategy in matching_strategies:
            cursor.execute(strategy)
            result = cursor.fetchone()
            if result:
                policy = result
                break
        
        if policy:
            db_policy_id = policy[0]
            current_status = policy[1]
            
            logger.info(f"Found policy ID {db_policy_id} with current status {current_status}")
            
            # Don't downgrade status (e.g., from COMPENSATED to DELAYED)
            if current_status == 'COMPENSATED' and new_status != 'COMPENSATED':
                logger.info(f"Policy {db_policy_id} is already COMPENSATED. Not downgrading to {new_status}.")
                return True
            
            # Prepare update query and parameters
            update_params = []
            update_columns = []
            
            # Always update status
            update_columns.append("status = %s")
            update_params.append(new_status)
            
            # Set blockchain_policy_id if not already set
            if not policy[1] or policy[1] == '':
                update_columns.append("blockchain_policy_id = %s")
                update_params.append(policy_id_hex)
            
            # Add payout amount if provided for COMPENSATED status
            if new_status == 'COMPENSATED' and additional_data and 'payout_amount' in additional_data:
                update_columns.append("premium = %s")
                update_params.append(f"{additional_data['payout_amount']} MATIC")
            
            # Add transaction_id if provided
            if additional_data and 'tx_hash' in additional_data:
                update_columns.append("transaction_id = %s")
                update_params.append(additional_data['tx_hash'])
            
            # Add policy ID for WHERE clause
            update_params.append(db_policy_id)
            
            # Construct and execute update query
            query = f"""
            UPDATE policies 
            SET {', '.join(update_columns)} 
            WHERE id = %s
            """
            
            cursor.execute(query, update_params)
            rows_updated = cursor.rowcount
            conn.commit()
            
            logger.info(f"Updated policy {db_policy_id} to status {new_status}, rows affected: {rows_updated}")
            return True
        else:
            # Instead of creating a new policy, log a warning
            logger.warning(f"No matching policy found for blockchain_policy_id {policy_id_hex}")
            return False
            
    except Exception as e:
        logger.error(f"Error updating policy status: {e}")
        return False
    finally:
        if conn:
            cursor.close()
            conn.close()
def process_flight_status_event(event):
    try:
        # Extract event data
        policy_id = event.args.policyId
        flight_iata = event.args.flightIata
        status = event.args.status  # This is a uint8 enum
        delay_minutes = event.args.delayMinutes
        tx_hash = event.transactionHash.hex()
        
        logger.info(f"Processing FlightStatusChecked event:")
        logger.info(f"  Policy ID: {policy_id.hex()}")
        logger.info(f"  Flight: {flight_iata}")
        logger.info(f"  Status: {status}")
        logger.info(f"  Delay minutes: {delay_minutes}")
        logger.info(f"  Transaction: {tx_hash}")
        
        # Determine if flight should be claimed based on delay minutes
        # Assuming a minimum delay threshold (e.g., 120 minutes or 2 hours)
        is_claimable = delay_minutes >= 120
        
        if is_claimable:
            additional_data = {
                'flight_id': flight_iata,
                'delay_minutes': delay_minutes,
                'tx_hash': tx_hash,
                'policyholder': event.args.get('policyholder', '')  # If available in the event
            }
            
            updated = update_policy_by_blockchain_id(
                policy_id.hex(), 
                "COMPENSATED",
                additional_data
            )
            
            if updated:
                logger.info(f"Successfully updated policy {policy_id.hex()} for flight {flight_iata} to COMPENSATED")
            else:
                logger.warning(f"Failed to update policy {policy_id.hex()} for flight {flight_iata}")
        else:
            logger.info(f"Flight {flight_iata} delay of {delay_minutes} minutes is below compensation threshold")
        
    except Exception as e:
        logger.error(f"Error processing FlightStatusChecked event: {e}")
def process_policy_claimed_event(event):
    try:
        # Extract event data
        policy_id = event.args.policyId
        policyholder = event.args.policyholder
        payout_amount = event.args.payoutAmount
        tx_hash = event.transactionHash.hex()
        
        # Convert Wei to Matic, preserving full precision
        payout_matic = w3.from_wei(payout_amount, 'ether')
        
        logger.info(f"Processing PolicyClaimed event:")
        logger.info(f"  Policy ID: {policy_id.hex()}")
        logger.info(f"  Policyholder: {policyholder}")
        logger.info(f"  Payout: {payout_matic} MATIC")
        logger.info(f"  Transaction: {tx_hash}")
        
        # Update policy status to COMPENSATED
        additional_data = {
            'payout_amount': str(payout_matic),  # Convert to string to preserve full precision
            'policyholder': policyholder,
            'tx_hash': tx_hash
        }
        
        updated = update_policy_by_blockchain_id(
            policy_id.hex(), 
            "COMPENSATED",
            additional_data
        )
        
        if updated:
            logger.info(f"Successfully updated policy {policy_id.hex()} to COMPENSATED status")
        else:
            logger.warning(f"Failed to update policy {policy_id.hex()}")
            
    except Exception as e:
        logger.error(f"Error processing PolicyClaimed event: {e}")

def scan_all_past_events():
    """Scan for all past events to catch up with the blockchain"""
    try:
        logger.info("Scanning for all past events...")
        
        # Get all PolicyPurchased events to update blockchain_policy_id
        try:
            purchase_events = contract.events.PolicyPurchased.get_logs(
                fromBlock=0,
                toBlock='latest'
            )
            
            logger.info(f"Found {len(purchase_events)} PolicyPurchased events")
            
            for event in purchase_events:
                process_policy_purchased_event(event)
        except Exception as e:
            logger.error(f"Error getting PolicyPurchased events: {e}")
        
        # Get all PolicyClaimed events to update to COMPENSATED
        try:
            claim_events = contract.events.PolicyClaimed.get_logs(
                fromBlock=0,
                toBlock='latest'
            )
            
            logger.info(f"Found {len(claim_events)} PolicyClaimed events")
            
            for event in claim_events:
                process_policy_claimed_event(event)
        except Exception as e:
            logger.error(f"Error getting PolicyClaimed events: {e}")
        
        # Get all FlightStatusChecked events to update to DELAYED
        try:
            status_events = contract.events.FlightStatusChecked.get_logs(
                fromBlock=0,
                toBlock='latest'
            )
            
            logger.info(f"Found {len(status_events)} FlightStatusChecked events")
            
            for event in status_events:
                process_flight_status_event(event)
        except Exception as e:
            logger.error(f"Error getting FlightStatusChecked events: {e}")
        
        logger.info("Finished scanning past events")
    except Exception as e:
        logger.error(f"Error scanning past events: {e}")

def main():
    try:
        # Setup database
        setup_database()
        
        logger.info("Starting blockchain event listener")
        
        # First scan all past events to make sure we're up to date
        scan_all_past_events()
        
        while True:
            try:
                # Get current and last processed block
                current_block = w3.eth.block_number
                last_block = get_last_processed_block()
                
                # If there are new blocks to process
                if current_block > last_block:
                    # Process in chunks to avoid timeout for large ranges
                    chunk_size = 1000
                    for chunk_start in range(last_block + 1, current_block + 1, chunk_size):
                        chunk_end = min(chunk_start + chunk_size - 1, current_block)
                        logger.info(f"Processing blocks {chunk_start} to {chunk_end}")
                        
                        # Get PolicyPurchased events
                        try:
                            purchase_events = contract.events.PolicyPurchased.get_logs(
                                fromBlock=chunk_start,
                                toBlock=chunk_end
                            )
                            
                            for event in purchase_events:
                                process_policy_purchased_event(event)
                        except Exception as e:
                            logger.error(f"Error getting PolicyPurchased events: {e}")
                        
                        # Get PolicyClaimed events
                        try:
                            claim_events = contract.events.PolicyClaimed.get_logs(
                                fromBlock=chunk_start,
                                toBlock=chunk_end
                            )
                            
                            for event in claim_events:
                                process_policy_claimed_event(event)
                        except Exception as e:
                            logger.error(f"Error getting PolicyClaimed events: {e}")
                        
                        # Get FlightStatusChecked events
                        try:
                            status_events = contract.events.FlightStatusChecked.get_logs(
                                fromBlock=chunk_start,
                                toBlock=chunk_end
                            )
                            
                            for event in status_events:
                                process_flight_status_event(event)
                        except Exception as e:
                            logger.error(f"Error getting FlightStatusChecked events: {e}")
                        
                    # Update the last processed block
                    update_last_processed_block(current_block)
                
                # Sleep before checking for new blocks
                time.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in processing loop: {e}")
                time.sleep(60)  # Wait a minute before retrying
                
    except KeyboardInterrupt:
        logger.info("Stopping blockchain event listener")
    except Exception as e:
        logger.critical(f"Fatal error: {e}")

if __name__ == "__main__":
    main()