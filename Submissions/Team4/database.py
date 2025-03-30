import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()

def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL is not set in the environment variables")
    return psycopg2.connect(db_url)
