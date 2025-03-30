from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify, session
from web3 import Web3
import json, os, random
from datetime import datetime, timedelta
from dotenv import load_dotenv
from functools import wraps
from backend.auth_utils import role_required
from decimal import Decimal
from backend.contract_utils import w3, lending_contract, lending_abi
from backend.database import users_collection, settings_collection
import secrets
from bson import ObjectId
from bson.errors import InvalidId

load_dotenv()

bp_main = Blueprint('main', __name__)

# Environment variables and constants
WEB3_PROVIDER_URL = os.getenv("WEB3_PROVIDER_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
FORWARDER_ADDRESS = os.getenv("FORWARDER_ADDRESS")  # Forwarder contract address
# Get relayer credentials from database instead of environment variables
def get_relayer_credentials():
    """Retrieve relayer credentials from the database"""
    credentials = settings_collection.find_one({"setting_name": "relayer_credentials"})
    
    if not credentials:
        raise ValueError("Relayer credentials not found in database")
        
    if not credentials.get("is_active", False):
        raise ValueError("Relayer credentials are disabled")
        
    return credentials.get("private_key"), credentials.get("address")

# Initialize these as None, they will be populated when needed
PRIVATE_KEY = None
RELAYER_ADDRESS = None

# Function to lazily load relayer credentials when needed
def ensure_relayer_credentials():
    global PRIVATE_KEY, RELAYER_ADDRESS
    if PRIVATE_KEY is None or RELAYER_ADDRESS is None:
        PRIVATE_KEY, RELAYER_ADDRESS = get_relayer_credentials()
    return PRIVATE_KEY, RELAYER_ADDRESS

# Get relayer credentials when needed
PRIVATE_KEY, RELAYER_ADDRESS = ensure_relayer_credentials()

# Connect to blockchain
w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URL))
if not w3.is_connected():
    raise Exception("Failed to connect to blockchain")

# Load Lending ABI
current_dir = os.path.dirname(os.path.abspath(__file__))
lending_abi_path = os.path.join(current_dir, "..", "..", "frontend", "abi", "LendingPlatform.json")
with open(lending_abi_path, "r") as abi_file:
    artifact = json.load(abi_file)
    if isinstance(artifact, dict) and "abi" in artifact:
        lending_abi = artifact["abi"]
    else:
        lending_abi = artifact

lending_contract = w3.eth.contract(
    address=Web3.to_checksum_address(CONTRACT_ADDRESS),
    abi=lending_abi
)

# Load Forwarder ABI
forwarder_abi_path = os.path.join(current_dir, "..", "..", "frontend", "abi", "LendingForwarder.json")
with open(forwarder_abi_path, "r") as f:
    artifact = json.load(f)
    if isinstance(artifact, dict) and "abi" in artifact:
        forwarder_abi = artifact["abi"]
    else:
        forwarder_abi = artifact
        
# Pre-serialize forwarder_abi to handle BigInts
forwarder_abi_json = json.dumps(forwarder_abi, default=str)

forwarder_contract = w3.eth.contract(
    address=Web3.to_checksum_address(FORWARDER_ADDRESS),
    abi=forwarder_abi
)

def from_wei(value_wei, decimals=18):
    """Convert a raw wei integer to a Decimal with the specified number of decimals."""
    return Decimal(value_wei) / Decimal(10**decimals)

@bp_main.route("/")
def home():
    try:
        raw_balance = lending_contract.functions.getContractBalance().call()
        total_balance = from_wei(raw_balance, 18)
    except Exception as e:
        total_balance = f"Error: {str(e)}"
    message = "Welcome to the Lending DApp!"
    return render_template("index.html", onchain_message=message, total_balance=total_balance)

@bp_main.route("/dashboard")
def dashboard():
    try:
        total_balance = lending_contract.functions.getContractBalance().call()
        # Get wallet address from session
        wallet_address = session.get('wallet_address', None)
        
        # Get user data if logged in
        user = None
        if 'user_id' in session:
            user = users_collection.find_one({"_id": session["user_id"]})
            # If MongoDB returns None, create a placeholder
            if not user:
                user = {"name": "Unknown User", "email": "No email available"}
        
        # Always direct to user dashboard
        return render_template("dashboard_user.html", 
                              total_balance=total_balance, 
                              wallet_address=wallet_address,
                              user=user)
    except Exception as e:
        total_balance = f"Error: {str(e)}"
        return render_template("dashboard_user.html", 
                              total_balance=total_balance, 
                              wallet_address=None,
                              user=None)

@bp_main.route("/request-loan", methods=["GET"])
def request_loan():
    # Load Forwarder ABI again and pre-serialize it.
    current_dir = os.path.dirname(os.path.abspath(__file__))
    forwarder_abi_path = os.path.join(current_dir, "..", "..", "frontend", "abi", "LendingForwarder.json")
    with open(forwarder_abi_path, "r") as f:
        artifact = json.load(f)
        if isinstance(artifact, dict) and "abi" in artifact:
            forwarder_abi = artifact["abi"]
        else:
            forwarder_abi = artifact
    forwarder_abi_json = json.dumps(forwarder_abi, default=str)
    
    # Get wallet address from session if available
    wallet_address = session.get('wallet_address', None)
    
    return render_template(
        "request_loan.html",
        CONTRACT_ADDRESS=CONTRACT_ADDRESS,
        lending_abi=lending_abi,
        FORWARDER_ADDRESS=FORWARDER_ADDRESS,
        forwarder_abi_json=forwarder_abi_json,
        wallet_address=wallet_address  # Pass wallet_address to template
    )

@bp_main.app_template_filter('datetimeformat')
def datetimeformat(value):
    # Fix: use the imported datetime class directly
    return datetime.fromtimestamp(value).strftime('%Y-%m-%d %H:%M:%S')

@bp_main.route("/loans/<borrower_address>")
def view_loans(borrower_address):
    try:
        checksum = Web3.to_checksum_address(borrower_address)
        # Using getLoans instead of getBorrowerLoans
        loan_ids = lending_contract.functions.getLoans(checksum).call()
        loans_list = []
        for loan_id in loan_ids:
            details = lending_contract.functions.loans(loan_id).call()
            loan = {
                'loan_id': loan_id,
                'borrower': details[0],
                'principal': details[1],
                'collateral': details[2],
                'interest_rate': details[3],
                'due_date': details[4],
                'is_repaid': details[6]
            }
            loans_list.append(loan)
        return render_template("loans.html", loans=loans_list, borrower=borrower_address)
    except Exception as e:
        return f"Error: {str(e)}"

@bp_main.route("/deposit", methods=["GET"])
def deposit_funds_form():
    # Get user wallet address if available
    wallet_address = None
    if session.get('user_id'):
        try:
            # Try to find the user either by ObjectId or by string ID
            try:
                # First attempt to use ObjectId
                user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
            except (InvalidId, TypeError):
                # If that fails, try using the string ID directly
                user = users_collection.find_one({'_id': session['user_id']})
                
                # If still not found, try using the ID as a string field
                if not user:
                    user = users_collection.find_one({'user_id': session['user_id']})
            
            if user and 'wallet_address' in user:
                wallet_address = user['wallet_address']
        except Exception as e:
            # Log the error but don't crash
            print(f"Error retrieving user: {e}")
    
    return render_template('deposit.html', wallet_address=wallet_address)

@bp_main.route('/deposit', methods=['POST'])
def deposit_funds():
    user_address = request.form.get('user_address')
    amount_bnb = request.form.get('amount_bnb')
    amount_wei = request.form.get('amount_wei')
    
    # Validate inputs
    if not user_address or not amount_bnb or not amount_wei:
        flash('All fields are required', 'error')
        return redirect(url_for('main.deposit_funds_form'))
    
    try:
        # Convert to float for validation
        amount_bnb_float = float(amount_bnb)
        
        if amount_bnb_float <= 0:
            flash('Amount must be greater than 0', 'error')
            return redirect(url_for('main.deposit_funds_form'))
        
        # In a real app, you would process the blockchain transaction here
        # For this example, we'll simulate a successful transaction

        # Create transaction data
        transaction = {
            'wallet_address': user_address,
            'amount_bnb': amount_bnb_float,
            'amount_wei': amount_wei,
            'type': 'deposit',
            'status': 'completed',
            'transaction_hash': f"0x{secrets.token_hex(32)}",  # Generate fake tx hash
            'timestamp': datetime.now()
        }
        
        # Try to store transaction with the user if possible
        if session.get('user_id'):
            try:
                # Attempt to add transaction to the user document
                try:
                    # First try with ObjectId
                    users_collection.update_one(
                        {'_id': ObjectId(session.get('user_id'))},
                        {'$push': {'transactions': transaction}}
                    )
                except (InvalidId, TypeError):
                    # If that fails, try as string
                    users_collection.update_one(
                        {'_id': session.get('user_id')},
                        {'$push': {'transactions': transaction}}
                    )
                    
                    # If still no update, try with user_id field
                    if users_collection.find_one({'_id': session.get('user_id')}) is None:
                        users_collection.update_one(
                            {'user_id': session.get('user_id')},
                            {'$push': {'transactions': transaction}}
                        )
            except Exception as e:
                # Log the error but continue - we'll still show success
                print(f"Error updating user with transaction: {str(e)}")
        
        # Store transaction data in session for the success page
        session['deposit_transaction'] = {
            'amount_bnb': amount_bnb_float,
            'wallet_address': user_address,
            'transaction_date': datetime.now().isoformat(),
            'transaction_hash': transaction['transaction_hash']
        }
        
        return redirect(url_for('main.deposit_success'))
        
    except ValueError:
        flash('Invalid amount value', 'error')
        return redirect(url_for('main.deposit_funds_form'))
    except Exception as e:
        flash(f'Error processing deposit: {str(e)}', 'error')
        return redirect(url_for('main.deposit_funds_form'))

@bp_main.route('/deposit/success', methods=['GET'])
def deposit_success():
    # Get transaction details from session
    transaction_data = session.get('deposit_transaction')
    
    if not transaction_data:
        flash('No transaction found', 'error')
        return redirect(url_for('main.deposit_funds_form'))
    
    # Parse the ISO format datetime back to a datetime object
    transaction_data['transaction_date'] = datetime.fromisoformat(transaction_data['transaction_date'])
    
    # Clear the transaction data from session to prevent reuse
    session.pop('deposit_transaction', None)
    
    return render_template('deposit_success.html', **transaction_data)

@bp_main.route("/withdraw", methods=["GET", "POST"])
@role_required("admin")
def withdraw_funds():
    """
    Withdraw funds (admin only).
    """
    if request.method == "POST":
        try:
            # Get values from form
            user_address = request.form.get("user_address")
            
            # Get amount directly in wei to avoid floating point conversion issues
            amount_wei = request.form.get("amount_wei")
            amount_bnb = request.form.get("amount_bnb")
            
            # Use the wei amount if provided, otherwise calculate from BNB amount
            if amount_wei and amount_wei.isdigit():
                amount_wei = int(amount_wei)
            else:
                amount_bnb = float(amount_bnb)
                amount_wei = int(amount_bnb * (10**18))
            
            print(f"Withdrawing {amount_bnb} BNB ({amount_wei} wei) to {user_address}")
            
            # Verify the user is admin by checking with the contract
            contract_admin = lending_contract.functions.admin().call()
            if Web3.to_checksum_address(user_address) != Web3.to_checksum_address(contract_admin):
                error_msg = "You are not authorized to withdraw funds. Only the contract admin can withdraw."
                flash(error_msg, "danger")
                return render_template("withdraw.html", error=error_msg, wallet_address=user_address)
            
            # Get the relayer account from private key
            account = w3.eth.account.from_key(PRIVATE_KEY)
            relayer_address = account.address
            
            # Get the nonce for the relayer address
            nonce = w3.eth.get_transaction_count(Web3.to_checksum_address(relayer_address))
            
            # Get the current gas price
            try:
                gas_price = w3.eth.gas_price
            except:
                # Fallback if gas_price is not available
                gas_price = w3.to_wei('5', 'gwei')
            
            # Build the transaction
            tx = lending_contract.functions.withdrawLiquidity(amount_wei).build_transaction({
                'from': Web3.to_checksum_address(relayer_address),
                'nonce': nonce,
                'gas': 500000,
                'gasPrice': gas_price,
            })
            
            # Sign the transaction
            signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
            
            # Extract the raw transaction based on the Web3.py version
            if hasattr(signed_tx, 'rawTransaction'):
                raw_tx = signed_tx.rawTransaction
            elif hasattr(signed_tx, 'raw_transaction'):
                raw_tx = signed_tx.raw_transaction
            else:
                # Try accessing it as a dictionary
                raw_tx = signed_tx['rawTransaction']
            
            # Send the raw transaction
            tx_hash = w3.eth.send_raw_transaction(raw_tx)
            print(f"Transaction sent: {tx_hash.hex()}")
            
            # Wait for the transaction to be mined
            tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
            
            # Check if the transaction was successful
            if tx_receipt.status == 1:
                success_msg = f"Withdrawal of {amount_bnb} BNB successful! Transaction hash: {tx_hash.hex()}"
                flash(success_msg, "success")
                
                # Get updated balance
                try:
                    raw_balance = lending_contract.functions.getContractBalance().call()
                    total_balance = from_wei(raw_balance, 18)
                except:
                    total_balance = "Error retrieving balance"
                    
                return render_template("withdraw.html", success=success_msg, wallet_address=user_address, total_balance=total_balance)
            else:
                error_msg = "Transaction failed. Please check the blockchain explorer for details."
                flash(error_msg, "danger")
                return render_template("withdraw.html", error=error_msg, wallet_address=user_address)
            
        except Exception as e:
            error_msg = f"Error withdrawing funds: {str(e)}"
            flash(error_msg, "danger")
            return render_template("withdraw.html", error=error_msg)
    
    # For GET requests, fetch the current contract balance
    try:
        raw_balance = lending_contract.functions.getContractBalance().call()
        total_balance = from_wei(raw_balance, 18)
    except Exception as e:
        total_balance = f"Error: {str(e)}"
        
    # GET request - just render the template
    return render_template("withdraw.html", total_balance=total_balance)

@bp_main.route("/repay-loan", methods=["GET"])
def repay_loan_page():
    # Load Forwarder ABI again and pre-serialize it.
    current_dir = os.path.dirname(os.path.abspath(__file__))
    forwarder_abi_path = os.path.join(current_dir, "..", "..", "frontend", "abi", "LendingForwarder.json")
    with open(forwarder_abi_path, "r") as f:
        artifact = json.load(f)
        if isinstance(artifact, dict) and "abi" in artifact:
            forwarder_abi = artifact["abi"]
        else:
            forwarder_abi = artifact
    forwarder_abi_json = json.dumps(forwarder_abi, default=str)
    
    return render_template(
        "repay_loan.html",
        CONTRACT_ADDRESS=CONTRACT_ADDRESS,
        lending_abi=lending_abi,
        FORWARDER_ADDRESS=FORWARDER_ADDRESS,
        forwarder_abi_json=forwarder_abi_json
    )

@bp_main.route("/liquidate-loan", methods=["GET", "POST"])
@role_required("admin")
def liquidate_loan():
    """
    Liquidate an overdue loan (admin only).
    """
    if request.method == "POST":
        try:
            loan_id = int(request.form.get("loan_id"))
            user_address = request.form.get("user_address")
            nonce = w3.eth.get_transaction_count(Web3.to_checksum_address(user_address))
            txn = lending_contract.functions.liquidateLoan(loan_id).build_transaction({
                'from': Web3.to_checksum_address(user_address),
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': w3.to_wei('5', 'gwei')  # Fixed: lowercase 'w' in to_wei
            })
            signed_txn = w3.eth.account.sign_transaction(txn, private_key=PRIVATE_KEY)
            txn_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            flash(f"Liquidation transaction sent: {txn_hash.hex()}", "success")
            return redirect(url_for("main.liquidate_loan"))
        except Exception as e:
            flash(f"Error liquidating loan: {str(e)}", "danger")
            return redirect(url_for("main.liquidate_loan"))
    return render_template("liquidate_loan.html")

# ===== META-TRANSACTION ENDPOINTS FOR STATE-CHANGING FUNCTIONS =====

@bp_main.route("/meta/request-loan", methods=["POST"])
def meta_request_loan():
    """
    Process a meta-transaction for requesting a loan.
    Expects JSON with: interestRate, duration, collateral, message, signature
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400
    try:
        interest_rate = int(data["interestRate"])
        duration = int(data["duration"])
        collateral = data["collateral"]  # as string (e.g., "0.5" for 0.5 BNB)
        message = data["message"]
        signature = data["signature"]
        
        # DEBUG: Log the data being sent to help diagnose the issue
        print("Meta Transaction Request:")
        print(f"Interest Rate: {interest_rate}")
        print(f"Duration: {duration}")
        print(f"Collateral: {collateral}")
        print(f"Message: {json.dumps(message, indent=2)}")
        print(f"Signature: {signature}")

        # Check the nonce in the message against the contract's nonce for the user
        user_address = Web3.to_checksum_address(message["from"])
        contract_nonce = None

        # Try different possible nonce functions
        if hasattr(forwarder_contract.functions, 'nonces'):
            contract_nonce = forwarder_contract.functions.nonces(user_address).call()
            print(f"Using 'nonces' mapping function for nonce retrieval")
        elif hasattr(forwarder_contract.functions, 'getNonce'):
            contract_nonce = forwarder_contract.functions.getNonce(user_address).call()
            print(f"Using 'getNonce' function for nonce retrieval")
        else:
            # Log available functions for debugging
            function_names = [fn_obj["name"] for fn_obj in forwarder_abi 
                            if fn_obj["type"] == "function"]
            print(f"Could not find nonce function. Available functions: {function_names}")
            return jsonify({
                "error": "Could not retrieve nonce from contract",
                "available_functions": function_names
            }), 500

        if contract_nonce is None:
            return jsonify({"error": "Failed to retrieve nonce from contract"}), 500

        message_nonce = int(message["nonce"])

        if contract_nonce != message_nonce:
            print(f"⚠️ NONCE MISMATCH: Contract nonce for {user_address} is {contract_nonce}, but message has nonce {message_nonce}")
            return jsonify({
                "error": f"Nonce mismatch: Contract expects {contract_nonce} but message has {message_nonce}"
            }), 400
        else:
            print(f"✓ Nonce check passed: Contract nonce for {user_address} is {contract_nonce}, matching message nonce")

        # Ensure numeric fields in the message are Python ints.
        message["value"] = int(message["value"])
        message["gas"] = int(message["gas"])
        message["nonce"] = int(message["nonce"])
        message["deadline"] = int(message["deadline"])

        # Use Web3.to_wei from the class instance
        collateral_value = w3.to_wei(collateral, 'ether')

        # Skip the signature verification on the server side since we don't have access to recover_typed_data
        # The contract will still verify the signature

        txn_dict = forwarder_contract.functions.execute(message, signature).build_transaction({
            'from': Web3.to_checksum_address(RELAYER_ADDRESS),
            'nonce': w3.eth.get_transaction_count(Web3.to_checksum_address(RELAYER_ADDRESS)),
            'gas': 3000000,
            'gasPrice': w3.to_wei('2', 'gwei'),
            'value': collateral_value
        })

        signed_txn = w3.eth.account.sign_transaction(txn_dict, private_key=PRIVATE_KEY)
        
        # Debug the signed transaction object
        print("Signed Transaction Object:", type(signed_txn))
        
        # Try multiple approaches to get the raw transaction bytes
        raw_tx = None
        
        # Approach 1: Direct attribute access
        if hasattr(signed_txn, 'rawTransaction'):
            raw_tx = signed_txn.rawTransaction
            print("Using rawTransaction attribute")
        
        # Approach 2: For Web3.py v5 AttributeDict objects
        elif hasattr(signed_txn, 'raw_transaction'):
            raw_tx = signed_txn.raw_transaction
            print("Using raw_transaction attribute")
            
        # Approach 3: For older Web3.py versions - access the specific property
        elif hasattr(signed_txn, '_raw_transaction'):
            raw_tx = signed_txn._raw_transaction
            print("Using _raw_transaction attribute")
            
        # Approach 4: For Web3.py v6 - might store it differently
        elif hasattr(signed_txn, 'raw'):
            raw_tx = signed_txn.raw
            print("Using raw attribute")
            
        # Approach 5: Last resort - try to access common attributes
        else:
            print("Available attributes:")
            for attr in dir(signed_txn):
                if not attr.startswith('_') and not callable(getattr(signed_txn, attr)):
                    try:
                        print(f"Attribute {attr}:", getattr(signed_txn, attr))
                        # If we find what looks like a raw transaction, use it
                        if attr.lower().find('raw') >= 0 and isinstance(getattr(signed_txn, attr), bytes):
                            raw_tx = getattr(signed_txn, attr)
                            print(f"Using {attr} attribute as it looks like raw transaction data")
                            break
                    except Exception as attr_err:
                        print(f"Error accessing attribute {attr}: {attr_err}")
            
            if not raw_tx:
                # Last attempt - try accessing it as a string representation
                try:
                    import re
                    # Look for hex string that might be the raw transaction
                    tx_str = str(signed_txn)
                    hex_match = re.search(r'0x[0-9a-fA-F]+', tx_str)
                    if hex_match:
                        possible_tx = hex_match.group(0)
                        # Convert string back to bytes
                        raw_tx = bytes.fromhex(possible_tx[2:])  # Remove '0x' prefix
                        print("Using regex-extracted hex string as raw transaction")
                    else:
                        raise ValueError("Could not find raw transaction data in the signed transaction object")
                except Exception as regex_err:
                    print(f"Error in regex approach: {regex_err}")
                    raise ValueError("Could not find raw transaction data in the signed transaction object")
        
        if not raw_tx:
            raise ValueError("Could not extract raw transaction bytes")
            
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Check if transaction was successful
        if receipt.status == 0:
            # Get revert reason
            tx = w3.eth.get_transaction(tx_hash)
            try:
                result = w3.eth.call({
                    'to': tx['to'],
                    'from': tx['from'],
                    'data': tx['input'],
                    'value': tx['value'],
                    'gas': tx['gas'],
                    'gasPrice': tx['gasPrice']
                }, receipt.blockNumber - 1)
                return jsonify({"error": f"Transaction reverted: {result.hex()}"}), 400
            except Exception as call_error:
                return jsonify({"error": f"Transaction failed on-chain: {str(call_error)}"}), 400
            
        return jsonify({"status": "success", "txHash": tx_hash.hex()}), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/repay-loan", methods=["POST"])
def meta_repay_loan():
    """
    Process a meta-transaction for repaying a loan.
    Expects JSON with: loanId, repayment (in BNB), message, signature
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400
    try:
        loan_id = int(data["loanId"])
        repayment = data["repayment"]  # as string
        message = data["message"]
        signature = data["signature"]

        # DEBUG: Log the data being sent to help diagnose any issues
        print("Meta Transaction Repay:")
        print(f"Loan ID: {loan_id}")
        print(f"Repayment: {repayment}")
        print(f"Message: {json.dumps(message, indent=2)}")
        print(f"Signature: {signature}")

        # Check the nonce in the message against the contract's nonce for the user
        user_address = Web3.to_checksum_address(message["from"])
        contract_nonce = None

        # Try different possible nonce functions
        if hasattr(forwarder_contract.functions, 'nonces'):
            contract_nonce = forwarder_contract.functions.nonces(user_address).call()
            print(f"Using 'nonces' mapping function for nonce retrieval")
        elif hasattr(forwarder_contract.functions, 'getNonce'):
            contract_nonce = forwarder_contract.functions.getNonce(user_address).call()
            print(f"Using 'getNonce' function for nonce retrieval")
        else:
            # Log available functions for debugging
            function_names = [fn_obj["name"] for fn_obj in forwarder_abi 
                            if fn_obj["type"] == "function"]
            print(f"Could not find nonce function. Available functions: {function_names}")
            return jsonify({
                "error": "Could not retrieve nonce from contract",
                "available_functions": function_names
            }), 500

        if contract_nonce is None:
            return jsonify({"error": "Failed to retrieve nonce from contract"}), 500

        message_nonce = int(message["nonce"])

        if contract_nonce != message_nonce:
            print(f"⚠️ NONCE MISMATCH: Contract nonce for {user_address} is {contract_nonce}, but message has nonce {message_nonce}")
            return jsonify({
                "error": f"Nonce mismatch: Contract expects {contract_nonce} but message has {message_nonce}"
            }), 400
        else:
            print(f"✓ Nonce check passed: Contract nonce for {user_address} is {contract_nonce}, matching message nonce")

        # Ensure numeric fields in the message are Python ints
        message["value"] = int(message["value"])
        message["gas"] = int(message["gas"])
        message["nonce"] = int(message["nonce"])
        message["deadline"] = int(message["deadline"])

        repayment_value = w3.to_wei(repayment, 'ether')

        txn_dict = forwarder_contract.functions.execute(message, signature).build_transaction({
            'from': Web3.to_checksum_address(RELAYER_ADDRESS),
            'nonce': w3.eth.get_transaction_count(Web3.to_checksum_address(RELAYER_ADDRESS)),
            'gas': 3000000,
            'gasPrice': w3.to_wei('2', 'gwei'),
            'value': repayment_value
        })

        signed_txn = w3.eth.account.sign_transaction(txn_dict, private_key=PRIVATE_KEY)
        
        # Debug the signed transaction object
        print("Signed Transaction Object:", type(signed_txn))
        
        # Try multiple approaches to get the raw transaction bytes
        raw_tx = None
        
        # Approach 1: Direct attribute access
        if hasattr(signed_txn, 'rawTransaction'):
            raw_tx = signed_txn.rawTransaction
            print("Using rawTransaction attribute")
        
        # Approach 2: For Web3.py v5 AttributeDict objects
        elif hasattr(signed_txn, 'raw_transaction'):
            raw_tx = signed_txn.raw_transaction
            print("Using raw_transaction attribute")
            
        # Approach 3: For older Web3.py versions - access the specific property
        elif hasattr(signed_txn, '_raw_transaction'):
            raw_tx = signed_txn._raw_transaction
            print("Using _raw_transaction attribute")
            
        # Approach 4: For Web3.py v6 - might store it differently
        elif hasattr(signed_txn, 'raw'):
            raw_tx = signed_txn.raw
            print("Using raw attribute")
            
        # Approach 5: Last resort - try to access common attributes
        else:
            print("Available attributes:")
            for attr in dir(signed_txn):
                if not attr.startswith('_') and not callable(getattr(signed_txn, attr)):
                    try:
                        print(f"Attribute {attr}:", getattr(signed_txn, attr))
                        # If we find what looks like a raw transaction, use it
                        if attr.lower().find('raw') >= 0 and isinstance(getattr(signed_txn, attr), bytes):
                            raw_tx = getattr(signed_txn, attr)
                            print(f"Using {attr} attribute as it looks like raw transaction data")
                            break
                    except Exception as attr_err:
                        print(f"Error accessing attribute {attr}: {attr_err}")
            
            if not raw_tx:
                # Last attempt - try accessing it as a string representation
                try:
                    import re
                    # Look for hex string that might be the raw transaction
                    tx_str = str(signed_txn)
                    hex_match = re.search(r'0x[0-9a-fA-F]+', tx_str)
                    if hex_match:
                        possible_tx = hex_match.group(0)
                        # Convert string back to bytes
                        raw_tx = bytes.fromhex(possible_tx[2:])  # Remove '0x' prefix
                        print("Using regex-extracted hex string as raw transaction")
                    else:
                        raise ValueError("Could not find raw transaction data in the signed transaction object")
                except Exception as regex_err:
                    print(f"Error in regex approach: {regex_err}")
                    raise ValueError("Could not find raw transaction data in the signed transaction object")
        
        if not raw_tx:
            raise ValueError("Could not extract raw transaction bytes")
            
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Check if transaction was successful
        if receipt.status == 0:
            # Get revert reason
            tx = w3.eth.get_transaction(tx_hash)
            try:
                result = w3.eth.call({
                    'to': tx['to'],
                    'from': tx['from'],
                    'data': tx['input'],
                    'value': tx['value'],
                    'gas': tx['gas'],
                    'gasPrice': tx['gasPrice']
                }, receipt.blockNumber - 1)
                return jsonify({"error": f"Transaction reverted: {result.hex()}"}), 400
            except Exception as call_error:
                return jsonify({"error": f"Transaction failed on-chain: {str(call_error)}"}), 400
            
        return jsonify({"status": "success", "txHash": tx_hash.hex()}), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/liquidate-loan", methods=["POST"])
@role_required("admin")
def meta_liquidate_loan():
    """
    Process a meta-transaction for liquidating a loan (admin only).
    Expects JSON with: loanId, message, signature
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400
    try:
        loan_id = int(data["loanId"])
        message = data["message"]
        signature = data["signature"]

        txn_dict = forwarder_contract.functions.execute(message, signature).build_transaction({
            'from': Web3.to_checksum_address(RELAYER_ADDRESS),
            'nonce': w3.eth.get_transaction_count(Web3.to_checksum_address(RELAYER_ADDRESS)),
            'gas': 3000000,
            'gasPrice': w3.to_wei('2', 'gwei'),  # Fixed: lowercase 'w' in to_wei
            'value': 0
        })

        signed_txn = w3.eth.account.sign_transaction(txn_dict, private_key=PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        w3.eth.wait_for_transaction_receipt(tx_hash)
        return jsonify({"status": "success", "txHash": tx_hash.hex()}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ===== VIEW FUNCTION ENDPOINTS (READ-ONLY) =====

@bp_main.route("/meta/get-credit-score", methods=["GET"])
def meta_get_credit_score():
    """
    Get the credit score for a borrower.
    Expects a query parameter: borrower (wallet address)
    """
    borrower = request.args.get("borrower")
    if not borrower:
        return jsonify({"error": "Missing borrower address"}), 400
    try:
        checksum = Web3.to_checksum_address(borrower)
        score = lending_contract.functions.getCreditScore(checksum).call()
        return jsonify({"creditScore": str(score)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/get-loan-details", methods=["GET"])
def meta_get_loan_details():
    """
    Get detailed information about a specific loan.
    Expects a query parameter: loanId
    """
    loan_id = request.args.get("loanId")
    if not loan_id:
        return jsonify({"error": "Missing loanId parameter"}), 400
    try:
        loan_id = int(loan_id)
        details = lending_contract.functions.getLoanDetails(loan_id).call()
        loan_details = {
            "borrower": details[0],
            "principal": str(details[1]),
            "collateral": str(details[2]),
            "interestRate": details[3],
            "dueDate": details[4],
            "startTime": details[5],
            "isRepaid": details[6]
        }
        return jsonify(loan_details), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/check-loan-health", methods=["GET"])
def meta_check_loan_health():
    """
    Check the health of a specific loan.
    Expects a query parameter: loanId
    """
    loan_id = request.args.get("loanId")
    if not loan_id:
        return jsonify({"error": "Missing loanId parameter"}), 400
    try:
        loan_id = int(loan_id)
        result = lending_contract.functions.checkLoanHealth(loan_id).call()
        return jsonify({"status": result[0], "currentRatio": str(result[1])}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/get-latest-price", methods=["GET"])
def meta_get_latest_price():
    """
    Get the latest BNB/USD price from Chainlink.
    """
    try:
        price = lending_contract.functions.getLatestPrice().call()
        return jsonify({"price": str(price)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/get-price-feed-info", methods=["GET"])
def meta_get_price_feed_info():
    """
    Get additional information from the Chainlink price feed.
    """
    try:
        result = lending_contract.functions.getPriceFeedInfo().call()
        data = {
            "roundId": str(result[0]),
            "answer": str(result[1]),
            "startedAt": str(result[2]),
            "updatedAt": str(result[3]),
            "answeredInRound": str(result[4])
        }
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/collateral-ratio", methods=["GET"])
def meta_collateral_ratio():
    """
    Calculate the collateral ratio for a given collateral and principal.
    Expects query parameters: collateral and principal (in wei)
    """
    collateral = request.args.get("collateral")
    principal = request.args.get("principal")
    if not collateral or not principal:
        return jsonify({"error": "Missing collateral or principal parameters"}), 400
    try:
        collateral = int(collateral)
        principal = int(principal)
        ratio = lending_contract.functions.collateralRatio(collateral, principal).call()
        return jsonify({"collateralRatio": str(ratio)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/get-nonce", methods=["GET"])
def meta_get_nonce():
    """
    Get the current nonce for a user from the Forwarder contract.
    Expects a query parameter: address
    """
    user_address = request.args.get("address")
    if not user_address:
        return jsonify({"error": "Missing address parameter"}), 400
    try:
        checksum_address = Web3.to_checksum_address(user_address)
        # Try different possible function names for nonce retrieval
        if hasattr(forwarder_contract.functions, 'nonces'):
            nonce = forwarder_contract.functions.nonces(checksum_address).call()
            return jsonify({"nonce": nonce}), 200
        elif hasattr(forwarder_contract.functions, 'getNonce'):
            nonce = forwarder_contract.functions.getNonce(checksum_address).call()
            return jsonify({"nonce": nonce}), 200
        else:
            # Last resort - check ABI and list available functions
            function_names = [fn_obj["name"] for fn_obj in forwarder_abi 
                             if fn_obj["type"] == "function"]
            return jsonify({
                "error": "Could not find nonce function",
                "available_functions": function_names
            }), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/get-domain-separator", methods=["GET"])
def meta_get_domain_separator():
    """
    Get the domain separator from the Forwarder contract to help debug signature issues.
    """
    try:
        # Check if the contract has a getDomainSeparator method
        if hasattr(forwarder_contract.functions, 'getDomainSeparator'):
            domain_separator = forwarder_contract.functions.getDomainSeparator().call()
            return jsonify({"domainSeparator": domain_separator.hex()}), 200
        else:
            # If not, construct it manually using the same parameters as the contract
            domain_data = {
                "name": "LendingForwarder",
                "version": "1",
                "chainId": w3.eth.chain_id,
                "verifyingContract": forwarder_contract.address
            }
            return jsonify({"domainData": domain_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/update-wallet", methods=["POST"])
def update_wallet():
    try:
        data = request.json
        wallet_address = data.get('wallet_address')
        
        if not wallet_address:
            return jsonify({"error": "No wallet address provided"}), 400
            
        # Store wallet address in session instead of user model
        session['wallet_address'] = wallet_address
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/loan-success")
def loan_success():
    """
    Display loan success page after a successful loan request submission.
    """
    # Check if user is logged in
    if "user_id" not in session:
        flash("You must be logged in to view this page", "warning")
        return redirect(url_for("users.login_form"))
        
    # Get current user's wallet address
    user = users_collection.find_one({"_id": session["user_id"]})
    wallet_address = user.get("wallet_address") if user else None
    
    # If user somehow got here without a wallet address, redirect to dashboard
    if not wallet_address:
        flash("No wallet address found", "warning")
        return redirect(url_for("main.dashboard"))
    
    # Pass forwarder and contract addresses for JS use
    return render_template(
        "loan_success.html", 
        wallet_address=wallet_address,
        CONTRACT_ADDRESS=CONTRACT_ADDRESS,
        FORWARDER_ADDRESS=FORWARDER_ADDRESS,
        lending_abi=lending_abi,
        forwarder_abi_json=json.dumps(forwarder_abi)
    )

# Add this new route 

@bp_main.route("/repayment-success")
def repayment_success():
    """
    Display repayment success page after a successful loan repayment submission.
    """
    # Check if user is logged in
    if "user_id" not in session:
        flash("You must be logged in to view this page", "warning")
        return redirect(url_for("users.login_form"))
        
    # Get wallet address from session
    wallet_address = session.get('wallet_address')
    
    # If user somehow got here without a wallet address, redirect to dashboard
    if not wallet_address:
        flash("No wallet address found", "warning")
        return redirect(url_for("main.dashboard"))
    
    # Pass forwarder and contract addresses for JS use
    return render_template(
        "repayment_success.html", 
        wallet_address=wallet_address,
        CONTRACT_ADDRESS=CONTRACT_ADDRESS,
        FORWARDER_ADDRESS=FORWARDER_ADDRESS,
        lending_abi=lending_abi,
        forwarder_abi_json=json.dumps(forwarder_abi)
    )

@bp_main.route("/meta/get-price-history", methods=["GET"])
def meta_get_price_history():
    """
    Get historical BNB/USD price data from Chainlink (simulated for demo).
    In a production environment, you would integrate with a service 
    that provides access to historical Chainlink price data.
    """
    try:
        # Get current price as reference
        current_price = lending_contract.functions.getLatestPrice().call()
        current_price_decimal = float(current_price) / 1e8
        
        # Simulate historical data
        now = datetime.now()
        history = []
        
        for i in range(24, -1, -1):
            # Create timestamp
            timestamp = now - timedelta(hours=i)
            
            # Simulate price with some randomness around current price
            # In a real app, retrieve actual historical Chainlink data
            random_factor = 0.9 + (0.2 * random.random())
            if i > 12:
                simulated_price = current_price_decimal * (random_factor * 0.98)
            else:
                simulated_price = current_price_decimal * random_factor
                
            history.append({
                "timestamp": int(timestamp.timestamp()),
                "price": round(simulated_price, 2)
            })
        
        return jsonify({"history": history}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp_main.route("/meta/analyze-loan-health", methods=["GET"])
def meta_analyze_loan_health():
    """
    Analyze the health of a user's loans based on Chainlink price data.
    """
    user_address = request.args.get("address")
    if not user_address:
        return jsonify({"error": "Missing address parameter"}), 400
        
    try:
        # Get user loans
        checksum = Web3.to_checksum_address(user_address)
        loan_ids = lending_contract.functions.getLoans(checksum).call()
        
        if not loan_ids:
            return jsonify({"status": "no_loans", "message": "No active loans found"}), 200
            
        # Get current price from Chainlink
        current_price = lending_contract.functions.getLatestPrice().call()
        current_price_decimal = float(current_price) / 1e8
        
        # Analyze each loan
        loans_analysis = []
        lowest_ratio = float('inf')
        critical_price = 0
        total_collateral_value = 0
        total_principal_value = 0
        
        for loan_id in loan_ids:
            # Get loan details
            details = lending_contract.functions.loans(loan_id).call()
            
            if details[6]:  # Skip repaid loans
                continue
                
            # Check health
            health_result = lending_contract.functions.checkLoanHealth(loan_id).call()
            health_status = health_result[0]
            current_ratio = float(health_result[1])
            
            # Calculate liquidation price
            principal = float(details[1]) / 1e18
            collateral = float(details[2]) / 1e18
            liquidation_price = (principal * 150) / (collateral * 100)  # Price at which ratio would be 150%
            
            # Calculate safe margin percentage
            safe_margin = ((current_price_decimal - liquidation_price) / current_price_decimal) * 100
            
            # Calculate time to maturity
            due_date = int(details[4])
            current_time = int(datetime.now().timestamp())
            seconds_to_maturity = max(0, due_date - current_time)
            days_to_maturity = seconds_to_maturity / 86400  # Convert seconds to days
            
            # Track the lowest ratio across all loans
            if current_ratio < lowest_ratio:
                lowest_ratio = current_ratio
                critical_price = liquidation_price
            
            # Calculate USD values
            principal_usd = principal * current_price_decimal
            collateral_usd = collateral * current_price_decimal
            
            # Accumulate totals
            total_collateral_value += collateral_usd
            total_principal_value += principal_usd
            
            # Add loan analysis to results
            loan_analysis = {
                "loan_id": loan_id,
                "health_status": "healthy" if health_status else "at_risk",
                "collateral_ratio": current_ratio,
                "liquidation_price": round(liquidation_price, 2),
                "safe_margin_percent": round(safe_margin, 2),
                "principal_bnb": round(principal, 4),
                "collateral_bnb": round(collateral, 4),
                "principal_usd": round(principal_usd, 2),
                "collateral_usd": round(collateral_usd, 2),
                "days_to_maturity": round(days_to_maturity, 1)
            }
            loans_analysis.append(loan_analysis)
        
        # Calculate aggregate statistics
        if loans_analysis:
            # Calculate overall collateral health
            avg_collateral_ratio = sum(loan["collateral_ratio"] for loan in loans_analysis) / len(loans_analysis)
            avg_safe_margin = sum(loan["safe_margin_percent"] for loan in loans_analysis) / len(loans_analysis)
            
            # Price impact scenarios
            price_scenarios = []
            for change_percent in [-20, -10, -5, 0, 5, 10, 20]:
                scenario_price = current_price_decimal * (1 + change_percent/100)
                scenario = {
                    "change_percent": change_percent,
                    "price": round(scenario_price, 2),
                    "loans_at_risk": sum(1 for loan in loans_analysis if scenario_price <= loan["liquidation_price"])
                }
                price_scenarios.append(scenario)
            
            # Forecast based on recent price trends (simplified)
            # In a real app, you would use historical Chainlink data for trend analysis
            forecast_data = {
                "trend": "stable",  # Could be "up", "down", or "stable"
                "recommendation": "maintain"  # Could be "add_collateral", "reduce_debt", "maintain"
            }
            
            if lowest_ratio < 170:  # If any loan has a ratio below 170%
                forecast_data["recommendation"] = "add_collateral"
            
            response = {
                "status": "success",
                "current_bnb_price": round(current_price_decimal, 2),
                "overall_health": {
                    "avg_collateral_ratio": round(avg_collateral_ratio, 2),
                    "lowest_collateral_ratio": round(lowest_ratio, 2),
                    "critical_price": round(critical_price, 2),
                    "avg_safe_margin": round(avg_safe_margin, 2),
                    "total_collateral_value": round(total_collateral_value, 2),
                    "total_principal_value": round(total_principal_value, 2),
                    "overall_status": "healthy" if lowest_ratio > 160 else "caution" if lowest_ratio > 150 else "at_risk"
                },
                "loans": loans_analysis,
                "price_impact_scenarios": price_scenarios,
                "forecast": forecast_data
            }
            
            return jsonify(response), 200
        else:
            return jsonify({"status": "no_active_loans", "message": "No active loans found"}), 200
            
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@bp_main.route("/learn")
def learn():
    """
    Render the 'Learn More' educational page with information about the platform.
    """
    return render_template("learn.html")