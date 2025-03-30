# setup_relayer.py
from database import settings_collection
import os
from dotenv import load_dotenv

def setup_relayer():
    """
    Initialize or update relayer credentials in the database.
    Only needs to be run once or when updating credentials.
    """
    load_dotenv()
    
    # Get credentials from environment variables for initial setup
    private_key = os.getenv("PRIVATE_KEY")
    relayer_address = os.getenv("RELAYER_ADDRESS")
    
    if not private_key or not relayer_address:
        print("Error: PRIVATE_KEY and RELAYER_ADDRESS must be set in the environment")
        return
    
    # Update or insert relayer settings in MongoDB
    settings_collection.update_one(
        {"setting_name": "relayer_credentials"},
        {"$set": {
            "setting_name": "relayer_credentials",
            "private_key": private_key,
            "address": relayer_address,
            "is_active": True
        }},
        upsert=True
    )
    
    print("Relayer credentials stored in database successfully")
    
    # For security, recommend removing from environment after setup
    print("For security, consider removing these variables from your .env file now")

if __name__ == "__main__":
    setup_relayer()