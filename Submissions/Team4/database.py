import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()

def get_db_connection():
    db_url = os.getenv("DB_URL")
    if not db_url:
        raise ValueError("DB_URL is not set in the environment variables")
    return psycopg2.connect(db_url)
