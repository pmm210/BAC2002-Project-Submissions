from minio import Minio
import os

# Define evaluation directory using relative path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
eval_dir = os.path.join(BASE_DIR, "scripts", "evaluation")
os.makedirs(eval_dir, exist_ok=True)

# MinIO connection details
MINIO_ENDPOINT = "localhost:9000"
ACCESS_KEY = "fladmin"
SECRET_KEY = "flsecret"
SECURE = False  # Set to True if using HTTPS
ROUND_ID = "round:1"

# Initialize MinIO client
client = Minio(
    MINIO_ENDPOINT,
    access_key=ACCESS_KEY,
    secret_key=SECRET_KEY,
    secure=SECURE
)

# Download models
def download_model(bucket_name, object_name, file_path):
    try:
        client.fget_object(bucket_name, object_name, file_path)
        print(f"✅ Successfully downloaded {object_name} to {file_path}")
    except Exception as e:
        print(f"❌ Error downloading {object_name}: {e}")

# Download models to evaluation directory
print("Downloading models from MinIO...")
download_model("models", f"{ROUND_ID}/aggregator.weights", f"{eval_dir}/aggregator.weights")
download_model("models", f"{ROUND_ID}/ocbc.weights", f"{eval_dir}/ocbc.weights")

print("✅ Download complete!")