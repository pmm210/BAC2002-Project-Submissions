from flask import Flask, jsonify, request, render_template, redirect, url_for, session
from flask_cors import CORS
from database import get_db_connection
from policy_routes import policy_bp
from admin_routes import admin_bp
from flight_api import FlightAPI
import os
from dotenv import load_dotenv


# Load .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = "super_secret_key"
CORS(app)

# Register the blueprint
app.register_blueprint(policy_bp)
app.register_blueprint(admin_bp)

# Initialize Flight API with DecentraFlight API key
flight_api = FlightAPI(api_key=None)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/admin')
def admin():
    """ Admin login page """
    return render_template('adminhome.html')  

@app.route('/admindashboard')
def admindashboard():
    """ Restrict access to admin dashboard """
    if "admin_logged_in" not in session:
        return redirect(url_for("unauthorized"))
    return render_template('admindashboard.html')

@app.route('/401')
def unauthorized():
    """ Unauthorized access page """
    return render_template('401.html')

@app.route('/login', methods=['POST'])
def login():
    """ Admin login functionality with JSON response """
    data = request.json
    username = data.get("username")
    password = data.get("password")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM admins WHERE username = %s AND password = %s", (username, password))
    admin = cursor.fetchone()
    cursor.close()
    conn.close()

    if admin:
        session["admin_logged_in"] = True
        return jsonify({"status": "success", "message": "Login successful!"})
    else:
        return jsonify({"status": "error", "error": "Invalid username or password"}), 401

@app.route('/logout', methods=['GET', 'POST'])
def logout():
    """ Admin logout functionality """
    session.pop("admin_logged_in", None)
    return redirect(url_for("admin"))

@app.route('/policies')  
def policies():
    return render_template('policies.html')

@app.route('/get_policies', methods=['POST'])  
def get_policies():
    """ Fetch policies only when wallet is connected """
    wallet_address = request.json.get('wallet_address')

    if not wallet_address:
        return jsonify({"error": "Connect your wallet to view policies."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, flight_id, departure_date, premium, status FROM policies WHERE wallet_address = %s",
        (wallet_address,)
    )
    policies = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify([
        {"id": row[0], "flight_id": row[1], "departure_date": row[2], "premium": row[3], "status": row[4]}
        for row in policies
    ])

@app.route('/purchase', methods=['POST'])
def purchase_insurance():
    """ Allow purchase only if wallet is connected """
    data = request.json
    wallet_address = data.get('wallet_address')

    if not wallet_address:
        return jsonify({'error': 'Connect your wallet before purchasing insurance.'}), 401

    flight_id = data['flight_id']
    departure_date = data['departure_date']
    premium_amount = data['premium']

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO policies (wallet_address, flight_id, departure_date, premium, status) VALUES (%s, %s, %s, %s, 'Pending')",
        (wallet_address, flight_id, departure_date, premium_amount)
    )
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'status': 'success', 'message': 'Insurance purchased successfully!'})

@app.route('/connect_wallet', methods=['POST'])
def connect_wallet():
    """ Simulate wallet connection """
    data = request.json
    wallet_address = data.get('wallet_address')

    if wallet_address:
        return jsonify({'status': 'success', 'message': 'Wallet connected', 'wallet': wallet_address})
    else:
        return jsonify({'error': 'Invalid wallet address'}), 400

@app.route('/disconnect_wallet', methods=['POST'])
def disconnect_wallet():
    """ Simulate wallet disconnection """
    return jsonify({'status': 'success', 'message': 'Wallet disconnected'})

@app.route("/api/airlines", methods=["GET"])
def get_airlines():
    airlines = flight_api.get_airlines()
    
    if not airlines:
        return jsonify({"error": "No airlines found"}), 500
    
    return jsonify(airlines)

@app.route("/api/verify-flight", methods=["POST"])
def verify_flight():
    data = request.json
    airline_iata = data.get("airline_iata")
    flight_number = data.get("flight_number")
    departure_date = data.get("departure_date")
    
    # Use the flight API to verify
    is_valid = flight_api.verify_flight(airline_iata, flight_number, departure_date)
    
    return jsonify({"valid": is_valid})
if __name__ == "__main__":
    app.run(debug=True)