import requests
from flask import Blueprint, render_template, flash, redirect, url_for, request, jsonify
import os, datetime
from backend.blockchain import w3, lending_contract
from web3 import Web3
from functools import wraps
from flask import session
from backend.auth_utils import role_required  # Import the decorator
import json
from backend.database import users_collection

# Try to import the forwarder contract, but handle the case where it's not defined
try:
    from backend.blockchain import forwarder_contract
except ImportError:
    forwarder_contract = None

bp_admin = Blueprint("admin", __name__)

def format_timestamp(ts):
    return datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')

def format_token_amount(amount, decimals=18):
    """Convert wei amount to readable format with given decimals"""
    return Web3.from_wei(amount, 'ether')

def format_address(address):
    """Format address to shorter version"""
    if not address or len(address) < 10:
        return address
    return f"{address[:6]}...{address[-4:]}"

def get_lending_abi():
    """Get the ABI from lending contract for frontend use"""
    try:
        return json.loads(lending_contract.abi)
    except (AttributeError, TypeError):
        return []

def get_forwarder_abi():
    """Get the ABI from forwarder contract for frontend use"""
    try:
        if forwarder_contract:
            return json.loads(forwarder_contract.abi)
    except (AttributeError, TypeError):
        pass
    return []

@bp_admin.route("/admin/dashboard", methods=["GET"])
@role_required("admin")
def admin_dashboard():
    try:
        API_KEY = os.getenv("BSCSCAN_API_KEY", "")
        CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
        FORWARDER_ADDRESS = os.getenv("FORWARDER_ADDRESS", "")
        FROM_BLOCK = os.getenv("FROM_BLOCK", "48900000")  # Configurable starting block
        TO_BLOCK = "latest"
        
        events = []
        api_error = None
        
        # List of events we want to track 
        event_signatures = {
            # LoanRequested event
            "0x6c9f8fda89f2418865a9bd2aeb16aa6f9fd3d3edb5b35d98fef95684d6c8b33a": "LoanRequested",
            # LoanRepaid event
            "0x8b87b4f2b716d8c2492b046efb46c8d319210ffcb4b37f4d717a0396bac033f0": "LoanRepaid"
        }
        
        # Try to fetch events for each event type
        for topic0, event_name in event_signatures.items():
            try:
                url = (
                    f"https://api-testnet.bscscan.com/api"
                    f"?module=logs&action=getLogs&address={CONTRACT_ADDRESS}"
                    f"&fromBlock={FROM_BLOCK}&toBlock={TO_BLOCK}&topic0={topic0}&apikey={API_KEY}"
                )
                response = requests.get(url)
                data = response.json()
                
                if data["status"] == "1":
                    for log in data["result"]:
                        try:
                            # Process the log based on event type
                            if event_name == "LoanRequested":
                                ev = lending_contract.events.LoanRequested().process_log(log)
                                # Calculate due date from timestamp and duration
                                due_timestamp = int(log['timeStamp'], 16) + int(ev['args']['duration'])
                                due_date = format_timestamp(due_timestamp)
                                
                                events.append({
                                    'type': 'LoanRequested',
                                    'loan_id': ev['args']['loanId'],
                                    'borrower': format_address(ev['args']['borrower']),
                                    'principal': format_token_amount(ev['args']['principal']),
                                    'interest_rate': ev['args']['interestRate'] / 100,  # Convert basis points to percentage
                                    'collateral': format_token_amount(ev['args']['collateral']),
                                    'due_date': due_date,
                                    'blockNumber': int(log['blockNumber'], 16),
                                    'timestamp': format_timestamp(int(log['timeStamp'], 16)),
                                    'transactionHash': log['transactionHash']
                                })
                            elif event_name == "LoanRepaid":
                                ev = lending_contract.events.LoanRepaid().process_log(log)
                                events.append({
                                    'type': 'LoanRepaid',
                                    'loan_id': ev['args']['loanId'],
                                    'borrower': format_address(ev['args']['borrower']),
                                    'total_repayment': format_token_amount(ev['args']['amount']),
                                    'blockNumber': int(log['blockNumber'], 16),
                                    'timestamp': format_timestamp(int(log['timeStamp'], 16)),
                                    'transactionHash': log['transactionHash']
                                })
                        except Exception as e_decode:
                            print(f"Decoding error for {event_name} log:", e_decode)
                else:
                    # Only save the error if we haven't fetched any events yet
                    if not events:
                        api_error = f"{data['message']} - {data.get('result', '')}"
                    print(f"BscScan API error for {event_name}: {data['message']} - {data.get('result', '')}")
            except Exception as e_fetch:
                print(f"Error fetching {event_name} events:", e_fetch)
        
        # Try to fetch meta-transaction events from forwarder contract
        if FORWARDER_ADDRESS and forwarder_contract:
            try:
                url = (
                    f"https://api-testnet.bscscan.com/api"
                    f"?module=logs&action=getLogs&address={FORWARDER_ADDRESS}"
                    f"&fromBlock={FROM_BLOCK}&toBlock={TO_BLOCK}&apikey={API_KEY}"
                )
                response = requests.get(url)
                data = response.json()
                
                if data["status"] == "1":
                    for log in data["result"]:
                        try:
                            # Decode forwarder events - look for 'ExecutedForward' event
                            events.append({
                                'type': 'MetaTransaction',
                                'from': format_address(log.get('topics', [None, None])[1][-40:] if len(log.get('topics', [])) > 1 else 'Unknown'),
                                'to': format_address(CONTRACT_ADDRESS),
                                'blockNumber': int(log['blockNumber'], 16),
                                'timestamp': format_timestamp(int(log['timeStamp'], 16)),
                                'transactionHash': log['transactionHash']
                            })
                        except Exception as e_decode:
                            print("Decoding error for MetaTransaction log:", e_decode)
            except Exception as e_meta:
                print("Error fetching meta-transaction events:", e_meta)
        
        # Sort events by blockNumber descending
        events = sorted(events, key=lambda x: x['blockNumber'], reverse=True)
        
        # Get contract information
        try:
            admin_address = lending_contract.functions.admin().call()
        except:
            admin_address = "Could not retrieve admin address"
        
        # Get network information
        try:
            network_id = w3.eth.chain_id
            network_name = "BSC Testnet"
            if network_id == 1:
                network_name = "Ethereum Mainnet"
            elif network_id == 56:
                network_name = "BSC Mainnet"
            elif network_id == 97:
                network_name = "BSC Testnet"
        except:
            network_name = "Unknown"
        
        # Get contract statistics
        try:
            platform_balance = Web3.from_wei(w3.eth.get_balance(CONTRACT_ADDRESS), 'ether')
        except:
            platform_balance = "Error retrieving balance"
        
        # Fetch contract ABIs for frontend use
        lending_abi = get_lending_abi()
        forwarder_abi = get_forwarder_abi()
        
        return render_template(
            "admin_dashboard.html", 
            events=events, 
            admin_address=admin_address,
            contract_address=CONTRACT_ADDRESS,
            forwarder_address=FORWARDER_ADDRESS if FORWARDER_ADDRESS else "Not configured",
            network=network_name,
            platform_balance=platform_balance,
            api_error=api_error,
            lending_abi=lending_abi,
            forwarder_abi=forwarder_abi,
            bscscan_api_key=API_KEY  # Pass API key to template
        )
    except Exception as e:
        flash(f"Error fetching admin dashboard: {str(e)}", "danger")
        return redirect(url_for("main.home"))

@bp_admin.route("/admin/contracts", methods=["GET"])
@role_required("admin")
def admin_contracts():
    """View deployed contract details"""
    try:
        # Get contract details
        contract_address = os.getenv("CONTRACT_ADDRESS")
        forwarder_address = os.getenv("FORWARDER_ADDRESS", "Not configured")
        
        # Get contract ABIs
        lending_abi = get_lending_abi()
        forwarder_abi = get_forwarder_abi()
        
        return render_template(
            "admin_contracts.html",
            contract_address=contract_address,
            forwarder_address=forwarder_address,
            lending_abi=lending_abi,
            forwarder_abi=forwarder_abi
        )
    except Exception as e:
        flash(f"Error fetching contract information: {str(e)}", "danger")
        return redirect(url_for("admin.admin_dashboard"))

@bp_admin.route("/admin/get-contract-stats", methods=["GET"])
@role_required("admin")
def get_contract_stats():
    """API endpoint to get contract statistics"""
    try:
        contract_address = os.getenv("CONTRACT_ADDRESS")
        
        # Get contract balance
        balance = w3.eth.get_balance(contract_address)
        balance_eth = Web3.from_wei(balance, 'ether')
        
        # Try to get loan counter or other stats
        loan_counter = 0
        try:
            loan_counter = lending_contract.functions.loanCounter().call()
        except:
            # Try alternative methods
            try:
                loan_counter = lending_contract.functions._loanCounter().call()
            except:
                pass
        
        return jsonify({
            'success': True,
            'balance': str(balance_eth),
            'loan_counter': loan_counter,
            'timestamp': datetime.datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@bp_admin.route("/admin/transaction/<tx_hash>", methods=["GET"])
@role_required("admin")
def view_transaction(tx_hash):
    """View details of a specific transaction"""
    try:
        # Get transaction details from web3
        tx = w3.eth.get_transaction(tx_hash)
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        
        # Get block details
        block = w3.eth.get_block(tx.blockNumber)
        
        # Format data for template
        tx_data = {
            'hash': tx_hash,
            'from': tx['from'],
            'to': tx['to'],
            'value': Web3.from_wei(tx['value'], 'ether'),
            'gas': tx['gas'],
            'gasPrice': Web3.from_wei(tx['gasPrice'], 'gwei'),
            'blockNumber': tx.blockNumber,
            'timestamp': datetime.datetime.fromtimestamp(block.timestamp).strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'Success' if receipt['status'] == 1 else 'Failed'
        }
        
        return render_template("admin_transaction.html", tx=tx_data)
    except Exception as e:
        flash(f"Error retrieving transaction: {str(e)}", "danger")
        return redirect(url_for("admin.admin_dashboard"))

@bp_admin.route("/admin/api/internal-transactions", methods=["GET"])
@role_required("admin")
def get_internal_transactions():
    """API endpoint to get internal transactions for the contract"""
    try:
        API_KEY = os.getenv("BSCSCAN_API_KEY")
        CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
        
        url = f"https://api-testnet.bscscan.com/api?module=account&action=txlistinternal&address={CONTRACT_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey={API_KEY}"
        
        response = requests.get(url)
        data = response.json()
        
        # Process the data a bit before returning
        if data["status"] == "1" and data["result"]:
            # Format the transactions
            transactions = []
            for tx in data["result"]:
                transactions.append({
                    "hash": tx.get("hash"),
                    "from": format_address(tx.get("from")),
                    "to": format_address(tx.get("to")),
                    "value": format_token_amount(tx.get("value")),
                    "blockNumber": tx.get("blockNumber"),
                    "timeStamp": format_timestamp(int(tx.get("timeStamp")))
                })
            return jsonify({
                "success": True,
                "transactions": transactions,
                "count": len(transactions)
            })
        else:
            return jsonify({
                "success": False,
                "error": data.get("message", "Unknown error"),
                "result": data.get("result", [])
            })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        })

from datetime import datetime
from bson.objectid import ObjectId

# Get all users with latest activity level
@bp_admin.route('/admin/manage-users')
@role_required('admin')
def manage_users():
    """Admin page for managing users"""
    users = list(users_collection.find())
    
    # Ensure all users have the required fields
    for user in users:
        # Basic user fields with defaults
        if 'name' not in user or not user['name']:
            user['name'] = user.get('email', 'Unknown User').split('@')[0]  # Use first part of email
            
        if 'email' not in user:
            user['email'] = 'No email provided'
            
        if 'wallet_address' not in user:
            user['wallet_address'] = None
            
        if 'role' not in user:
            user['role'] = 'user'
            
        if 'is_active' not in user:
            user['is_active'] = True
            
        if 'created_at' not in user or not user['created_at']:
            user['created_at'] = datetime.now()
        
        # Calculate activity level
        loan_count = 0  # Replace with actual query
        transaction_count = 0  # Replace with actual query
        
        # Simple logic to determine activity level
        activity_sum = loan_count + transaction_count
        if activity_sum > 5:
            user['activity_level'] = 'high'
        elif activity_sum > 2:
            user['activity_level'] = 'medium'
        else:
            user['activity_level'] = 'low'
            
    return render_template('admin_users.html', users=users)

# Add a new user
@bp_admin.route('/admin/add-user', methods=['POST'])
@role_required('admin')
def add_user():
    name = request.form.get('name')
    email = request.form.get('email')
    password = request.form.get('password')  # In production, hash this password
    wallet_address = request.form.get('wallet_address')
    role = request.form.get('role')
    
    # Check if email already exists
    if users_collection.find_one({'email': email}):
        flash('Email already exists', 'danger')
        return redirect(url_for('admin.manage_users'))
    
    # Create new user document with created_at
    new_user = {
        'name': name,
        'email': email,
        'password': password,  # You should hash this in production
        'wallet_address': wallet_address,
        'role': role,
        'is_active': True,
        'created_at': datetime.now(),
        'last_login': None
    }
    
    # Insert user into database
    users_collection.insert_one(new_user)
    flash(f'User {name} has been added successfully', 'success')
    return redirect(url_for('admin.manage_users'))

# Update existing user
@bp_admin.route('/admin/update-user', methods=['POST'])
@role_required('admin')
def update_user():
    user_id = request.form.get('user_id')
    name = request.form.get('name')
    email = request.form.get('email')
    wallet_address = request.form.get('wallet_address')
    role = request.form.get('role')
    is_active = bool(request.form.get('is_active'))
    
    # Update user in database
    users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {
            'name': name,
            'email': email,
            'wallet_address': wallet_address,
            'role': role,
            'is_active': is_active
        }}
    )
    
    flash(f'User {name} has been updated', 'success')
    return redirect(url_for('admin.manage_users'))

# Delete user
@bp_admin.route('/admin/delete-user', methods=['POST'])
@role_required('admin')
def delete_user():
    user_id = request.form.get('user_id')
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        flash('User not found', 'danger')
        return redirect(url_for('admin.manage_users'))
    
    # Delete user from database
    users_collection.delete_one({'_id': ObjectId(user_id)})
    flash(f'User {user["name"]} has been deleted', 'success')
    return redirect(url_for('admin.manage_users'))

# Deactivate user
@bp_admin.route('/admin/deactivate-user', methods=['POST'])
@role_required('admin')
def deactivate_user():
    user_id = request.form.get('user_id')
    
    # Update user status
    users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'is_active': False}}
    )
    
    flash('User has been deactivated', 'success')
    return redirect(url_for('admin.manage_users'))

# Activate user
@bp_admin.route('/admin/activate-user', methods=['POST'])
@role_required('admin')
def activate_user():
    user_id = request.form.get('user_id')
    
    # Update user status
    users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'is_active': True}}
    )
    
    flash('User has been activated', 'success')
    return redirect(url_for('admin.manage_users'))

# Script to update user records with missing created_at fields
from datetime import datetime
from backend.database import users_collection

# Find all users without created_at field
users_without_date = users_collection.find({"created_at": {"$exists": False}})

# Update each user with the current date
for user in users_without_date:
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"created_at": datetime.now()}}
    )

print("Updated all users with missing created_at field")
