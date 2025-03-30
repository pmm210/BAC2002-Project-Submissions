import sys
import os
from flask import Flask
from dotenv import load_dotenv
from web3 import Web3
from decimal import Decimal

# Initialize a Web3 instance (you don't even need a provider for this calculation)
w3 = Web3()

# Compute the keccak256 hash of the event signature
event_signature = "LoanCreated(uint256,address,uint256,uint256)"
event_signature_hash = w3.keccak(text=event_signature).hex()

print(event_signature_hash)

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "devsecret")

# Add the project root to sys.path so that the 'backend' package is found.
project_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
if project_root not in sys.path:
    sys.path.insert(0, project_root)
    
def from_wei_filter(value):
    return Decimal(value) / Decimal(10**18)

app.jinja_env.filters['from_wei'] = from_wei_filter

# Import blueprints from the backend package
from backend.routes.user_routes import bp_users
from backend.routes.main_routes import bp_main
from backend.routes.admin_routes import bp_admin


app.register_blueprint(bp_admin)
# Register blueprints with different URL prefixes
app.register_blueprint(bp_users, url_prefix="/user")
app.register_blueprint(bp_main)  # no prefix; routes defined here are global

if __name__ == "__main__":
    app.run(debug=True)
