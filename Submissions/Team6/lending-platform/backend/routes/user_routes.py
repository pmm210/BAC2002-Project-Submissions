from flask import Blueprint, request, jsonify, session, render_template, redirect, url_for, flash
from backend.database import users_collection
from backend.blockchain import w3, lending_contract
from web3 import Web3
import uuid
import os, json
from backend.contract_utils import lending_abi, lending_contract, w3
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

bp_users = Blueprint("users", __name__)

@bp_users.route("/register", methods=["GET"])
def show_register():
    """
    Render the registration form.
    """
    return render_template("register.html")

@bp_users.route("/register", methods=["POST"])
def register():
    """
    Register a new user.
    """
    name = request.form.get("name")
    email = request.form.get("email")
    password = request.form.get("password")
    wallet_address = request.form.get("wallet_address", "")

    if not all([name, email, password]):
        flash("Missing required fields", "danger")
        return redirect(url_for("users.show_register"))

    if users_collection.find_one({"email": email}):
        flash("User already exists", "danger")
        return redirect(url_for("users.show_register"))

    if wallet_address:
        wallet_address = Web3.to_checksum_address(wallet_address)

    password_hash = generate_password_hash(password)
    user_doc = {
        "_id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "password": password_hash,  # Remember: in production, hash passwords!
        "wallet_address": wallet_address,
        "role": "user",  # Default role for new users
        "is_active": True,
        "created_at": datetime.now(),
        "last_login": None
    }
    users_collection.insert_one(user_doc)
    flash("User registered successfully!", "success")
    return redirect(url_for("users.login_form"))

@bp_users.route("/login", methods=["GET"])
def login_form():
    """
    Render the login form.
    """
    return render_template("login.html")

@bp_users.route("/login", methods=["POST"])
def login():
    data = request.form
    email = data.get("email")
    password = data.get("password")
    
    if not all([email, password]):
        flash("Missing email or password", "danger")
        return redirect(url_for("users.login_form"))

    user = users_collection.find_one({"email": email})
    if not user or not check_password_hash(user["password"], password):
        flash("Invalid credentials", "danger")
        return redirect(url_for("users.login_form"))

    session["user_id"] = user["_id"]
    session["email"] = user["email"]
    session["role"] = user.get("role", "user")
    flash("Login successful!", "success")
    return redirect(url_for("users.profile"))

@bp_users.route("/profile", methods=["GET"])
def profile():
    """
    Display the logged-in user's profile.
    """
    if "user_id" not in session:
        flash("You must be logged in to view your profile", "danger")
        return redirect(url_for("users.login_form"))

    user = users_collection.find_one({"_id": session["user_id"]})
    if not user:
        flash("User not found", "danger")
        return redirect(url_for("users.login_form"))

    return render_template("profile.html", user=user)

@bp_users.route("/update-wallet", methods=["POST"])
def update_wallet():
    """
    Update the logged-in user's wallet address.
    """
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    new_wallet = request.form.get("wallet_address")
    if not new_wallet:
        flash("Missing wallet address", "danger")
        return redirect(url_for("users.profile"))

    new_wallet = Web3.to_checksum_address(new_wallet)
    users_collection.update_one(
        {"_id": session["user_id"]},
        {"$set": {"wallet_address": new_wallet}}
    )
    flash("Wallet updated successfully!", "success")
    return redirect(url_for("users.profile"))

@bp_users.route("/logout", methods=["GET"])
def logout():
    """
    Log out the current user by clearing the session.
    """
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for("users.login_form"))

@bp_users.route("/dashboard", methods=["GET"])
def user_dashboard():
    # Load lending ABI from file (update filename if needed)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    lending_abi_path = os.path.join(current_dir, "..", "..", "frontend", "abi", "LendingPlatform.json")
    with open(lending_abi_path, "r") as f:
        artifact = json.load(f)
        if isinstance(artifact, dict) and "abi" in artifact:
            lending_abi = artifact["abi"]
        else:
            lending_abi = artifact

    if "user_id" not in session:
        flash("Please log in to view your dashboard.", "warning")
        return redirect(url_for("users.login_form"))
    
    user = users_collection.find_one({"_id": session["user_id"]})
    if not user:
        flash("User not found.", "danger")
        return redirect(url_for("users.login_form"))

    loans = []
    wallet_address = user.get("wallet_address")
    total_contract_balance = None

    if wallet_address:
        try:
            checksum = Web3.to_checksum_address(wallet_address)
            # Updated: call getLoans instead of getBorrowerLoans
            loan_ids = lending_contract.functions.getLoans(checksum).call()
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
                loans.append(loan)
        except Exception as e:
            flash(f"Error fetching loans: {str(e)}", "danger")
    
    try:
        # Update to use getContractBalance() instead of totalContractBalance()
        total_contract_balance = lending_contract.functions.getContractBalance().call()
    except Exception as e:
        flash(f"Error fetching contract balance: {str(e)}", "warning")
    
    return render_template("dashboard_user.html", 
                            user=user, 
                            loans=loans, 
                            total_contract_balance=total_contract_balance,
                            lending_abi=lending_abi)

@bp_users.route("/change-password", methods=["POST"])
def change_password():
    """
    Update the logged-in user's password.
    """
    if "user_id" not in session:
        flash("You must be logged in to change your password", "danger")
        return redirect(url_for("users.login_form"))

    current_password = request.form.get("current_password")
    new_password = request.form.get("new_password")
    confirm_password = request.form.get("confirm_password")

    # Validate input
    if not all([current_password, new_password, confirm_password]):
        flash("All password fields are required", "danger")
        return redirect(url_for("users.profile"))

    if new_password != confirm_password:
        flash("New passwords do not match", "danger")
        return redirect(url_for("users.profile"))

    # Find the user
    user = users_collection.find_one({"_id": session["user_id"]})
    if not user:
        flash("User not found", "danger")
        return redirect(url_for("users.login_form"))

    # Verify current password
    if not check_password_hash(user["password"], current_password):
        flash("Current password is incorrect", "danger")
        return redirect(url_for("users.profile"))

    # Update the password
    new_password_hash = generate_password_hash(new_password)
    users_collection.update_one(
        {"_id": session["user_id"]},
        {"$set": {"password": new_password_hash}}
    )
    
    flash("Password updated successfully!", "success")
    return redirect(url_for("users.profile"))

# Add this new route to your existing user_routes.py

@bp_users.route("/loans/user/<wallet_address>", methods=["GET"])
def get_user_loans(wallet_address):
    """
    Get all loans for a specific user wallet address.
    """
    try:
        # Ensure wallet address is valid
        if not Web3.is_address(wallet_address):
            return jsonify({"error": "Invalid wallet address"}), 400
            
        # Convert to checksum address
        checksum_address = Web3.to_checksum_address(wallet_address)
        
        # Call the contract to get loan count for this user
        loan_count = lending_contract.functions.getLoanCountByBorrower(checksum_address).call()
        
        # Fetch all loans for this borrower
        loans = []
        for i in range(loan_count):
            try:
                # Get loan id by borrower and index
                loan_id = lending_contract.functions.getLoanIdByBorrowerAndIndex(checksum_address, i).call()
                
                # Get loan details
                loan_details = lending_contract.functions.getLoan(loan_id).call()
                
                # Format loan data
                loan = {
                    "loan_id": loan_id,
                    "borrower": loan_details[0],
                    "principal": loan_details[1],
                    "interest_rate": loan_details[2],
                    "duration": loan_details[3],
                    "collateral": loan_details[4],
                    "start_date": loan_details[5],
                    "is_repaid": loan_details[6]
                }
                loans.append(loan)
            except Exception as e:
                print(f"Error fetching loan details for index {i}: {e}")
                continue
                
        return jsonify({
            "success": True,
            "wallet_address": checksum_address,
            "loan_count": loan_count,
            "loans": loans
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
