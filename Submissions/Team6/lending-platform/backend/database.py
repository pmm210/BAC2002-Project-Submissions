# backend/database.py

import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env

MONGO_URI = os.getenv("MONGO_URI", 'mongodb://localhost:27017')
client = MongoClient(MONGO_URI)
db = client.get_database()  # This will use the database name from the URI
users_collection = db["users"]
settings_collection = db['settings']  # Add this line for settings