# admin_routes.py

from flask import Blueprint, request, jsonify, render_template
import psycopg2
from web3 import Web3
from decimal import Decimal
import os
from dotenv import load_dotenv
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Flask Blueprint
admin_bp = Blueprint("admin", __name__)

# Constants from environment
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
ADMIN_WALLET = os.getenv("ADMIN_WALLET")
AMOY_RPC_URL = os.getenv("POLYGON_RPC_URL")
DB_URL = os.getenv("DATABASE_URL")

logger.info(f"Starting with CONTRACT_ADDRESS: {CONTRACT_ADDRESS}")
logger.info(f"AMOY_RPC_URL: {AMOY_RPC_URL}")

# Web3 setup - Must use checksummed address
w3 = Web3(Web3.HTTPProvider(AMOY_RPC_URL))
logger.info(f"Web3 connected to node: {w3.is_connected()}")

# Database connection
def get_db_connection():
    """Create and return a database connection"""
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    return conn

@admin_bp.route('/admindashboard')
def admin_dashboard():
    """Render admin dashboard"""
    return render_template('admindashboard.html')

@admin_bp.route('/admin_stats')
def admin_stats():
    """Get admin dashboard statistics"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get total policies
    cursor.execute("SELECT COUNT(*) FROM policies")
    total_policies = cursor.fetchone()[0]
    
    # Get pending claims (policies with delay status)
    cursor.execute("SELECT COUNT(*) FROM policies WHERE status = 'DELAYED'")
    pending_claims = cursor.fetchone()[0]
    
    # Get total premium
    cursor.execute("SELECT SUM(CAST(REPLACE(premium, 'MATIC', '') AS DECIMAL)) FROM policies")
    total_premium_result = cursor.fetchone()[0]
    total_premium = total_premium_result if total_premium_result else 0
    
    # Get all policies
    cursor.execute("""
        SELECT id, flight_id, departure_date, premium, status, transaction_id
        FROM policies
        ORDER BY departure_date DESC
    """)
    
    policies = []
    for row in cursor.fetchall():
        # Format date for display
        departure_date = row[2].strftime("%d %b %Y") if row[2] else "N/A"
        
        policies.append({
            "id": row[0],
            "flight_id": row[1],
            "departure_date": departure_date,
            "premium": row[3],
            "status": row[4],
            "transaction_id": row[5]
        })
    
    cursor.close()
    conn.close()
    
    return jsonify({
        "total_policies": total_policies,
        "pending_claims": pending_claims,
        "total_premium": float(Decimal(total_premium).quantize(Decimal("0.0001"))),
        "policies": policies
    })

@admin_bp.route('/update_policy_status', methods=['POST'])
def update_policy_status():
    """Update policy status"""
    data = request.json
    policy_id = data.get('policy_id')
    new_status = data.get('status')
    
    if not policy_id or not new_status:
        return jsonify({"status": "error", "error": "Missing policy_id or status"}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "UPDATE policies SET status = %s WHERE id = %s RETURNING id",
            (new_status, policy_id)
        )
        
        result = cursor.fetchone()
        if not result:
            return jsonify({"status": "error", "error": "Policy not found"}), 404
        
        conn.commit()
        return jsonify({"status": "success", "message": f"Policy status updated to {new_status}"})
        
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@admin_bp.route('/contract_funds', methods=['GET'])
def contract_funds():
    """Get contract balance and pool funds with detailed debugging"""
    try:
        # Make sure CONTRACT_ADDRESS is properly checksummed
        try:
            checksum_address = Web3.to_checksum_address(CONTRACT_ADDRESS)
            print(f"Using checksummed contract address: {checksum_address}")
        except Exception as e:
            print(f"Error checksumming address: {e}")
            return jsonify({"status": "error", "error": f"Invalid contract address format: {str(e)}"}), 400
        
        # Verify Web3 connection
        if not w3.is_connected():
            print("Web3 is not connected to the node!")
            return jsonify({"status": "error", "error": "Cannot connect to blockchain node"}), 500
        
        print(f"Web3 connected to node: {w3.provider.endpoint_uri}")
        
        # Get contract balance with detailed error handling
        try:
            balance = w3.eth.get_balance(checksum_address)
            balance_in_matic = w3.from_wei(balance, 'ether')
            print(f"Raw contract balance: {balance} wei, {float(balance_in_matic)} MATIC")
        except Exception as e:
            print(f"Error getting contract balance: {e}")
            return jsonify({"status": "error", "error": f"Failed to get contract balance: {str(e)}"}), 500
        
        # Create a minimal contract instance just for the totalPoolFunds call
        try:
            # Define minimal ABI for totalPoolFunds
            contract_abi = [
                {
                    "inputs": [],
                    "name": "totalPoolFunds",
                    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            # Create contract instance
            contract = w3.eth.contract(address=checksum_address, abi=contract_abi)
            print("Contract instance created for totalPoolFunds call")
        except Exception as e:
            print(f"Error creating contract instance: {e}")
            # Continue with zero pool funds if contract creation fails
            pool_funds = 0
            pool_funds_in_matic = 0
        else:
            # Get pool funds from contract
            try:
                pool_funds = contract.functions.totalPoolFunds().call()
                pool_funds_in_matic = w3.from_wei(pool_funds, 'ether')
                print(f"Pool funds from contract: {pool_funds} wei, {float(pool_funds_in_matic)} MATIC")
            except Exception as e:
                print(f"Error calling totalPoolFunds: {e}")
                # Fallback: if we can't get pool funds, use a default value
                pool_funds = 0
                pool_funds_in_matic = 0
                print("Using 0 as pool funds due to error")
            
        # Calculate withdrawable amount (balance - pool funds)
        # Make sure we don't return negative numbers
        withdrawable = max(0, balance - pool_funds)
        withdrawable_in_matic = w3.from_wei(withdrawable, 'ether')
        
        print(f"Calculated withdrawable: {withdrawable} wei, {float(withdrawable_in_matic)} MATIC")
        
        # Round values to 6 decimal places for display
        contract_balance = float(balance_in_matic)
        pool_funds_value = float(pool_funds_in_matic)
        withdrawable_value = float(withdrawable_in_matic)
        
        # Final response
        response = {
            "contract_balance": contract_balance,
            "pool_funds": pool_funds_value,
            "withdrawable": withdrawable_value
        }
        
        print(f"Final response: {response}")
        return jsonify(response)
        
    except Exception as e:
        print(f"Unexpected error in contract_funds: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error", 
            "error": str(e),
            "contract_address": CONTRACT_ADDRESS
        }), 500