from flask import Blueprint, request, jsonify
import psycopg2
import psycopg2.extras
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()


# Initialize Flask Blueprint
policy_bp = Blueprint("policy", __name__)

# Database connection string from environment
DB_URL = os.getenv('DATABASE_URL')

def get_db_connection():
    """Create and return a database connection"""
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    return conn

@policy_bp.route('/store_policy', methods=['POST'])
def store_policy():
    """
    Store flight insurance policy in database with extensive debugging
    and robust error handling
    """
    # Log the start of the function
    print("==== DEBUG: store_policy endpoint called ====")
    
    try:
        # Log the raw request
        print(f"Request method: {request.method}")
        print(f"Request content type: {request.content_type}")
        
        # Get the raw data and log it
        raw_data = request.get_data().decode('utf-8')
        print(f"Raw request data: {raw_data}")
        
        # Parse the JSON data
        data = request.json
        print(f"Parsed JSON data: {data}")
        
        # Check for required fields but don't return error, just log it
        required_fields = ['wallet_address', 'flight_id', 'departure_date', 'premium', 'transaction_id']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            print(f"WARNING: Missing required fields: {missing_fields}")
            # Continue anyway for debugging purposes
        
        wallet_address = data.get('wallet_address', '')
        flight_id = data.get('flight_id', '')
        
        # Extract and format departure_date with detailed logging
        departure_date = data.get('departure_date')
        print(f"Original departure_date: {departure_date} (type: {type(departure_date)})")
        
        # If departure_date is a string, parse it to a datetime object
        parsed_date = None
        if isinstance(departure_date, str):
            # Try multiple date formats with logging
            formats = [
                ('%Y-%m-%d', 'ISO date'),
                ('%Y-%m-%dT%H:%M:%S', 'ISO datetime'),
                ('%Y-%m-%dT%H:%M:%S.%fZ', 'ISO datetime with milliseconds'),
                ('%d/%m/%Y', 'DD/MM/YYYY'),
                ('%m/%d/%Y', 'MM/DD/YYYY'),
            ]
            
            for fmt, fmt_name in formats:
                try:
                    parsed_date = datetime.strptime(departure_date, fmt)
                    print(f"Successfully parsed date using format {fmt_name}: {parsed_date}")
                    break
                except ValueError as e:
                    print(f"Failed to parse with format {fmt_name}: {e}")
            
            if not parsed_date:
                print(f"WARNING: Could not parse date: {departure_date}, using current time")
                parsed_date = datetime.now()
        else:
            parsed_date = departure_date
        
        # Use the parsed date
        departure_date = parsed_date
        print(f"Final departure_date for database: {departure_date}")
            
        premium = data.get('premium', '0.00001 MATIC')
        transaction_id = data.get('transaction_id', '')
        blockchain_policy_id = data.get('blockchain_policy_id')
        
        # Log policy ID information
        print(f"blockchain_policy_id provided: {blockchain_policy_id}")
        
        # Log transaction ID format validation
        if transaction_id and isinstance(transaction_id, str) and transaction_id.startswith('0x'):
            print(f"Transaction ID format is valid: {transaction_id}")
        else:
            print(f"WARNING: Transaction ID format may be invalid: {transaction_id}")
            # Continue anyway for debugging
        
        # Connect to database with detailed error handling
        try:
            print("Attempting to connect to the database...")
            conn = get_db_connection()
            print("Database connection successful")
        except Exception as e:
            print(f"CRITICAL ERROR - Database connection failed: {str(e)}")
            # Try to provide more details about the connection issue
            try:
                import socket
                db_host = os.getenv("DB_HOST", "aws-0-ap-southeast-1.pooler.supabase.com")
                db_port = int(os.getenv("DB_PORT", "6543"))
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(5)
                result = sock.connect_ex((db_host, db_port))
                if result == 0:
                    print(f"Network connection to database at {db_host}:{db_port} is OPEN")
                else:
                    print(f"Network connection to database at {db_host}:{db_port} is CLOSED (error code: {result})")
                sock.close()
            except Exception as net_err:
                print(f"Error while checking network connectivity: {str(net_err)}")
            
            return jsonify({
                'status': 'error', 
                'message': 'Database connection error: ' + str(e)
            }), 500
        
        # Create cursor
        cursor = conn.cursor()
        
        # Check if transaction_id already exists with error handling
        try:
            print(f"Checking if transaction ID exists: {transaction_id}")
            cursor.execute("SELECT id FROM policies WHERE transaction_id = %s", (transaction_id,))
            existing_policy = cursor.fetchone()
            
            if existing_policy:
                policy_id = existing_policy[0]
                print(f"Policy already exists with ID: {policy_id}")
                cursor.close()
                conn.close()
                return jsonify({
                    'status': 'success', 
                    'message': 'Policy already exists',
                    'policy_id': policy_id
                })
            else:
                print("No existing policy found with this transaction ID")
        except Exception as e:
            print(f"Error checking for existing policy: {str(e)}")
            # Continue anyway since we're debugging
        
        # Check for the policies table and create it if it doesn't exist
        try:
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'policies'
                )
            """)
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                print("Policies table does not exist. Creating it...")
                cursor.execute("""
                    CREATE TABLE policies (
                        id SERIAL PRIMARY KEY,
                        wallet_address TEXT NOT NULL,
                        flight_id TEXT NOT NULL,
                        departure_date TIMESTAMP NOT NULL,
                        premium TEXT NOT NULL,
                        status TEXT NOT NULL,
                        transaction_id TEXT NOT NULL,
                        blockchain_policy_id TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                conn.commit()
                print("Created policies table successfully")
        except Exception as e:
            print(f"Error checking/creating policies table: {str(e)}")
            # Continue anyway
        
        # Check if blockchain_policy_id column exists
        try:
            cursor.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'policies' AND column_name = 'blockchain_policy_id'
            """)
            has_blockchain_column = cursor.fetchone() is not None
            print(f"blockchain_policy_id column exists: {has_blockchain_column}")
            
            # Add the column if it doesn't exist
            if not has_blockchain_column:
                try:
                    cursor.execute("ALTER TABLE policies ADD COLUMN blockchain_policy_id TEXT")
                    conn.commit()
                    has_blockchain_column = True
                    print("Added blockchain_policy_id column to policies table")
                except Exception as e:
                    print(f"Error adding blockchain_policy_id column: {str(e)}")
                    # Continue without the column
            
        except Exception as e:
            print(f"Error checking for blockchain_policy_id column: {str(e)}")
            has_blockchain_column = False
        
        # Build query based on available columns
        try:
            if has_blockchain_column and blockchain_policy_id:
                query = """
                    INSERT INTO policies (
                        wallet_address, 
                        flight_id, 
                        departure_date, 
                        premium, 
                        status, 
                        transaction_id,
                        blockchain_policy_id
                    ) VALUES (%s, %s, %s, %s, 'ACTIVE', %s, %s)
                    RETURNING id
                """
                params = (wallet_address, flight_id, departure_date, premium, transaction_id, blockchain_policy_id)
                print("Using query with blockchain_policy_id")
            else:
                query = """
                    INSERT INTO policies (
                        wallet_address, 
                        flight_id, 
                        departure_date, 
                        premium, 
                        status, 
                        transaction_id
                    ) VALUES (%s, %s, %s, %s, 'ACTIVE', %s)
                    RETURNING id
                """
                params = (wallet_address, flight_id, departure_date, premium, transaction_id)
                print("Using query without blockchain_policy_id")
            
            print(f"SQL Query: {query}")
            print(f"Parameters: {params}")
            
            # Execute the query to insert the policy
            cursor.execute(query, params)
            policy_id = cursor.fetchone()[0]
            conn.commit()
            
            print(f"Successfully inserted policy with ID: {policy_id}")
            
            return jsonify({
                'status': 'success', 
                'message': 'Policy stored successfully',
                'policy_id': policy_id
            })
        except Exception as e:
            conn.rollback()
            print(f"ERROR storing policy: {str(e)}")
            
            # Try to get more details about the error
            import traceback
            traceback.print_exc()
            
            return jsonify({
                'status': 'error', 
                'message': f'Failed to store policy: {str(e)}'
            }), 500
        finally:
            cursor.close()
            conn.close()
            print("Database connection closed")
            
    except Exception as e:
        print(f"CRITICAL ERROR in store_policy: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'status': 'error', 
            'message': f'Server error: {str(e)}'
        }), 500
    finally:
        print("==== DEBUG: store_policy endpoint finished ====")
        
@policy_bp.route('/get_policies', methods=['POST'])  
def get_policies():
    wallet_address = request.json.get('wallet_address')

    if not wallet_address:
        return jsonify({"error": "Connect your wallet to view policies."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if blockchain_policy_id column exists
    cursor.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'policies' AND column_name = 'blockchain_policy_id'
    """)
    has_blockchain_column = cursor.fetchone() is not None
    
    # Build query dynamically based on available columns
    if has_blockchain_column:
        query = """
            SELECT 
                id, 
                flight_id, 
                departure_date, 
                premium, 
                status, 
                transaction_id,
                blockchain_policy_id
            FROM policies 
            WHERE LOWER(wallet_address) = LOWER(%s)
        """
    else:
        query = """
            SELECT 
                id, 
                flight_id, 
                departure_date, 
                premium, 
                status, 
                transaction_id
            FROM policies 
            WHERE LOWER(wallet_address) = LOWER(%s)
        """
    
    cursor.execute(query, (wallet_address,))
    policies = cursor.fetchall()
    cursor.close()
    conn.close()

    result = []
    for row in policies:
        # Format the departure_date to include time
        formatted_date = row[2].strftime("%d %b %Y %H:%M") if row[2] else None
        
        policy_data = {
            "id": row[0], 
            "flight_id": row[1], 
            "departure_date": formatted_date, 
            "premium": row[3], 
            "status": row[4],
            "transaction_id": row[5]
        }
        
        # Add blockchain_policy_id if available
        if has_blockchain_column and len(row) > 6:
            policy_data["blockchain_policy_id"] = row[6]
        
        result.append(policy_data)
    
    return jsonify(result)


@policy_bp.route("/check_policy_status", methods=["POST"])
def check_policy_status():
    """Check the status of a policy"""
    try:
        data = request.json
        policy_id = data.get("policy_id")
        
        if not policy_id:
            return jsonify({"error": "Policy ID is required"}), 400
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # FIXED: Use "id" column instead of "policy_id"
        cur.execute(
            "SELECT id, status, flight_id, departure_date FROM policies WHERE id = %s",
            (policy_id,)
        )
        
        policy = cur.fetchone()
        cur.close()
        conn.close()
        
        if not policy:
            return jsonify({"error": "Policy not found"}), 404
        
        # Convert to dict for JSON serialization
        policy_dict = dict(policy)
        
        # Format date for JSON response to include time
        if policy_dict['departure_date']:
            policy_dict['departure_date'] = policy_dict['departure_date'].strftime("%d %b %Y %H:%M")
        
        return jsonify(policy_dict)
    except Exception as e:
        print(f"Error checking policy status: {e}")
        return jsonify({"error": f"Failed to check policy status: {str(e)}"}), 500

# Add route to update policy status (e.g., for admins or automated jobs)
@policy_bp.route("/update_policy_status", methods=["POST"])
def update_policy_status():
    """Update a policy's status"""
    try:
        data = request.json
        policy_id = data.get("policy_id")
        new_status = data.get("status")
        
        if not policy_id or not new_status:
            return jsonify({"error": "Policy ID and status are required"}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # FIXED: Use "id" column instead of "policy_id"
        cur.execute(
            "UPDATE policies SET status = %s WHERE id = %s RETURNING id",
            (new_status, policy_id)
        )
        
        updated = cur.fetchone()
        cur.close()
        conn.close()
        
        if not updated:
            return jsonify({"error": "Policy not found or not updated"}), 404
        
        return jsonify({
            "success": True,
            "message": f"Policy status updated to {new_status}"
        })
    except Exception as e:
        print(f"Error updating policy status: {e}")
        return jsonify({"error": f"Failed to update policy status: {str(e)}"}), 500