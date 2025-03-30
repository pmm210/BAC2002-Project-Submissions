import os
import json
import time
import requests
import threading
import websocket
import tensorflow as tf
import numpy as np
import hashlib
import uuid
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# Read environment variables
BANK_ID = os.getenv("BANK_ID", "unknown_bank")
FABRIC_API_URL = os.getenv("FABRIC_API_URL", f"http://hlf-gateway-{BANK_ID}:8888")  # Dynamic per bank
FABRIC_API_WS = os.getenv("FABRIC_API_WS", f"ws://hlf-gateway-{BANK_ID}:8888/ws")
MINIO_HANDLER_URL = os.getenv("MINIO_HANDLER_URL", "http://minio-handler:9002")
MODEL_DIR = "/models"
DATA_DIR = "/data"

# Ensure model directory exists
os.makedirs(MODEL_DIR, exist_ok=True)

def load_training_data():
    """Loads training data from the mounted volume."""
    try:
        # Look for CSV files in the data directory
        csv_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
        
        if not csv_files:
            print(f"⚠️ [BANK {BANK_ID}] No CSV files found in {DATA_DIR}")
            return None, None
            
        # Use the first CSV file found (or you could use a specific naming convention)
        csv_path = os.path.join(DATA_DIR, csv_files[0])
        print(f"📂 [BANK {BANK_ID}] Loading data from {csv_path}")
        
        # Load the CSV file
        df = pd.read_csv(csv_path)
        print(f"📊 [BANK {BANK_ID}] Loaded dataframe with shape: {df.shape}")
        
        # Basic preprocessing: assume last column is target
        X = df.iloc[:, :-1].values
        y = df.iloc[:, -1].values
        
        # Normalize features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        print(f"✅ [BANK {BANK_ID}] Successfully loaded and preprocessed data with {X.shape[0]} samples and {X.shape[1]} features")
        return X_scaled, y
        
    except Exception as e:
        print(f"❌ [BANK {BANK_ID}] Error loading data: {e}")
        return None, None

def train_model(round_id):
    """Trains a model using real data or falls back to synthetic data if needed."""
    print(f"🏋️ [BANK {BANK_ID}] Training model for round {round_id}...")
    
    # Get adaptive training parameters
    params = improve_model_training(round_id)
    
    # Extract parameters
    epochs = params.get("epochs", 5)
    batch_size = params.get("batch_size", 32)
    learning_rate = params.get("learning_rate", 0.001)
    use_regularization = params.get("use_regularization", False)
    dropout_rate = params.get("dropout_rate", 0.0)
    
    print(f"🔧 [BANK {BANK_ID}] Training with: epochs={epochs}, batch_size={batch_size}, lr={learning_rate}")
    
    # Try to load real data
    X_data, y_data = load_training_data()
    
    # Fall back to synthetic data if needed
    if X_data is None or y_data is None:
        print(f"⚠️ [BANK {BANK_ID}] Falling back to synthetic data")
        X_data = np.random.rand(1000, 30)
        y_data = np.random.randint(0, 2, 1000)
    
    # Split data into training and validation sets
    X_train, X_val, y_train, y_val = train_test_split(X_data, y_data, test_size=0.2, random_state=42)
    
    # Determine input shape from the data
    input_shape = X_train.shape[1]
    
    # Model architecture
    model = tf.keras.Sequential()
    model.add(tf.keras.layers.Dense(64, activation="relu", input_shape=(input_shape,)))
    
    # Add dropout if requested
    if use_regularization and dropout_rate > 0:
        model.add(tf.keras.layers.Dropout(dropout_rate))
    
    model.add(tf.keras.layers.Dense(32, activation="relu"))
    
    # Add dropout if requested
    if use_regularization and dropout_rate > 0:
        model.add(tf.keras.layers.Dropout(dropout_rate))
        
    model.add(tf.keras.layers.Dense(1, activation="sigmoid"))
    
    # Compile with specified learning rate
    optimizer = tf.keras.optimizers.Adam(learning_rate=learning_rate)
    model.compile(optimizer=optimizer, loss="binary_crossentropy", metrics=["accuracy"])
    
    # Train the model
    history = model.fit(
        X_train, y_train, 
        epochs=epochs, 
        batch_size=batch_size, 
        validation_data=(X_val, y_val),
        verbose=1
    )
    
    # Evaluate the model
    val_loss, val_accuracy = model.evaluate(X_val, y_val, verbose=0)
    print(f"📈 [BANK {BANK_ID}] Validation accuracy: {val_accuracy:.4f}")
    
    model_id = f"{BANK_ID}_{round_id}_{uuid.uuid4().hex[:8]}"
    model_path = os.path.join(MODEL_DIR, f"{model_id}.h5")
    model.save(model_path)
    
    print(f"✅ [BANK {BANK_ID}] Model training complete. Model saved to {model_path}")
    return model_path, model_id, val_accuracy

def upload_model(model_path, round_id):
    """Uploads trained model to MinIO."""
    print(f"📤 [BANK {BANK_ID}] Requesting upload URL from minio-handler for round {round_id}...")
    response = requests.post(f"{MINIO_HANDLER_URL}/upload", json={"roundId": round_id, "bankId": BANK_ID})
    
    if response.status_code != 200:
        print(f"❌ [BANK {BANK_ID}] Failed to get upload URL: {response.text}")
        return None, None
    
    upload_data = response.json()
    upload_url = upload_data["uploadUrl"]
    object_path = upload_data["objectPath"]
    
    with open(model_path, "rb") as file:
        upload_response = requests.put(upload_url, data=file)
    
    if upload_response.status_code == 200:
        print(f"✅ [BANK {BANK_ID}] Model successfully uploaded to MinIO at {object_path}.")
    else:
        print(f"❌ [BANK {BANK_ID}] Failed to upload model: {upload_response.text}")
        return None, None
    
    return object_path, upload_url

def submit_model_contribution(round_id, model_id, model_uri, model_path, accuracy=0.95):
    """Submits trained model metadata to the respective bank's Fabric API Gateway."""
    print(f"📩 [BANK {BANK_ID}] Submitting model contribution for round {round_id}...")
    with open(model_path, "rb") as f:
        model_hash = hashlib.sha256(f.read()).hexdigest()
    
    payload = {
        "id": model_id,
        "roundId": round_id,
        "participantId": BANK_ID,
        "weightHash": model_hash,
        "modelURI": model_uri,
        "accuracyMetrics": {"accuracy": accuracy},
        "trainingStats": {"epochs": "5", "batch_size": "32"}
    }
    
    response = requests.post(f"{FABRIC_API_URL}/models/contribution", json=payload)
    
    if response.status_code == 200:
        print(f"✅ [BANK {BANK_ID}] Model contribution submitted successfully.")
    else:
        print(f"❌ [BANK {BANK_ID}] Failed to submit contribution: {response.text}")

def handle_round_started(round_data):
    """Handles round start event and triggers training, upload, and submission."""
    round_id = round_data.get("round_id")
    print(f"🚀 [BANK {BANK_ID}] Training round {round_id} started!")
    model_path, model_id, accuracy = train_model(round_id)
    object_path, upload_url = upload_model(model_path, round_id)
    if object_path and upload_url:
        submit_model_contribution(round_id, model_id, object_path, model_path, accuracy)

def on_message(ws, message):
    """Handles incoming WebSocket messages."""
    try:
        event = json.loads(message)
        event_type = event.get("event")
        
        if event_type == "ROUND_STARTED":
            round_data = json.loads(event.get("data", "{}"))
            threading.Thread(target=handle_round_started, args=(round_data,), daemon=True).start()
        
        elif event_type == "QUALITY_RECORDED":
            quality_data = json.loads(event.get("data", "{}"))
            threading.Thread(target=handle_quality_recorded, args=(quality_data,), daemon=True).start()
            
        elif event_type == "REPUTATION_UPDATED":
            reputation_data = json.loads(event.get("data", "{}"))
            threading.Thread(target=handle_reputation_updated, args=(reputation_data,), daemon=True).start()
            
    except json.JSONDecodeError as e:
        print(f"❌ [BANK {BANK_ID}] Failed to parse WebSocket message: {e}")

def start_websocket_listener():
    """Continuously listens for WebSocket events from the bank's Fabric API Gateway."""
    while True:
        try:
            ws = websocket.WebSocketApp(FABRIC_API_WS, on_message=on_message)
            ws.run_forever()
        except Exception as e:
            print(f"❌ [BANK {BANK_ID}] WebSocket error: {e}. Retrying in 5s...")
            time.sleep(5)
            
def check_reputation():
    """Retrieves the reputation for this bank from the blockchain."""
    try:
        response = requests.get(f"{FABRIC_API_URL}/reputation?id={BANK_ID}")
        
        if response.status_code == 200:
            reputation_data = response.json()
            
            print(f"\n🌟 [BANK {BANK_ID}] Reputation Status:")
            print(f"  Current Score: {reputation_data.get('score', 0):.4f}")
            print(f"  Last Updated: {datetime.fromtimestamp(reputation_data.get('lastUpdated', 0)).strftime('%Y-%m-%d %H:%M:%S')}")
            
            # Print history if available
            history = reputation_data.get('history', [])
            if history:
                print(f"  Reputation History (latest {len(history)} changes):")
                for i, change in enumerate(reversed(history)):
                    round_id = change.get("roundID", "unknown")
                    reason = change.get("reason", "unknown")
                    old_score = change.get("oldScore", 0)
                    new_score = change.get("newScore", 0)
                    change_time = datetime.fromtimestamp(change.get("timestamp", 0)).strftime('%Y-%m-%d %H:%M:%S')
                    
                    # Format with emoji based on whether reputation went up or down
                    emoji = "⬆️" if new_score > old_score else "⬇️" if new_score < old_score else "↔️"
                    print(f"    {emoji} {change_time}: {old_score:.4f} → {new_score:.4f} (Round: {round_id}, Reason: {reason})")
            else:
                print("  No reputation history available yet.")
            
            return reputation_data
            
        else:
            print(f"❌ [BANK {BANK_ID}] Failed to retrieve reputation data: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ [BANK {BANK_ID}] Error checking reputation: {e}")
        return None

def handle_reputation_updated(event_data):
    """Handles reputation updated events from the blockchain."""
    try:
        participant_id = event_data.get("participant_id")
        
        # Only handle events for this bank
        if participant_id != BANK_ID:
            return
            
        old_score = event_data.get("old_score", 0)
        new_score = event_data.get("new_score", 0)
        reason = event_data.get("reason", "Unknown")
        round_id = event_data.get("round_id", "Unknown")
        
        # Format with emoji based on whether reputation went up or down
        emoji = "⬆️" if new_score > old_score else "⬇️" if new_score < old_score else "↔️"
        
        print(f"\n{emoji} [BANK {BANK_ID}] Reputation updated:")
        print(f"  Change: {old_score:.4f} → {new_score:.4f}")
        print(f"  Reason: {reason}")
        print(f"  Round: {round_id}")
        
        # Retrieve full reputation data
        check_reputation()
        
    except Exception as e:
        print(f"❌ [BANK {BANK_ID}] Error handling reputation event: {e}")

            
def check_model_quality_history():
    """Retrieves the quality history for this bank from the blockchain."""
    try:
        response = requests.get(f"{FABRIC_API_URL}/quality/participant")
        
        if response.status_code == 200:
            quality_data = response.json()
            
            print(f"\n🏅 [BANK {BANK_ID}] Quality History:")
            print(f"  Current Score: {quality_data.get('currentScore', 0):.4f}")
            print(f"  Models Accepted: {quality_data.get('acceptedCount', 0)}")
            print(f"  Models Rejected: {quality_data.get('rejectedCount', 0)}")
            
            # Print history if available
            history = quality_data.get('qualityHistory', [])
            if history:
                print(f"  Quality History (latest {len(history)} rounds):")
                for i, score in enumerate(history):
                    print(f"    Round {i+1}: {score:.4f}")
            else:
                print("  No quality history available yet.")
            
            return quality_data
            
        else:
            print(f"❌ [BANK {BANK_ID}] Failed to retrieve quality data: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ [BANK {BANK_ID}] Error checking quality history: {e}")
        return None

def handle_quality_recorded(event_data):
    """Handles quality recorded events from the blockchain."""
    try:
        round_id = event_data.get("round_id")
        threshold = event_data.get("threshold", 0)
        avg_quality = event_data.get("average_quality", 0)
        accepted = event_data.get("accepted_count", 0)
        rejected = event_data.get("rejected_count", 0)
        
        print(f"\n📊 [BANK {BANK_ID}] Quality metrics recorded for round {round_id}:")
        print(f"  Threshold: {threshold:.4f}")
        print(f"  Average Quality: {avg_quality:.4f}")
        print(f"  Models: {accepted} accepted, {rejected} rejected")
        
        # Check our own quality metrics
        check_model_quality_history()
        
    except Exception as e:
        print(f"❌ [BANK {BANK_ID}] Error handling quality event: {e}")

def improve_model_training(round_id, quality_data=None):
    """Adapts training parameters based on quality feedback."""
    # If no quality data provided, try to fetch it
    if quality_data is None:
        quality_data = check_model_quality_history()
    
    if not quality_data:
        print(f"⚠️ [BANK {BANK_ID}] No quality data available for adaptation")
        return {}  # Return default parameters
    
    # Get current quality score
    current_score = quality_data.get('currentScore', 0)
    
    # Basic adaptation strategy
    training_params = {
        "epochs": 5,  # Default
        "batch_size": 32,  # Default
        "learning_rate": 0.001,  # Default
    }
    
    # If our quality is low, train more extensively
    if current_score < 0.7:
        training_params["epochs"] = 8
        training_params["batch_size"] = 16
        training_params["learning_rate"] = 0.0005
        print(f"⚡ [BANK {BANK_ID}] Increasing training intensity due to low quality score")
    
    # If our quality is very low, train even more intensively
    if current_score < 0.5:
        training_params["epochs"] = 10
        training_params["batch_size"] = 8
        training_params["learning_rate"] = 0.0001
        print(f"⚡⚡ [BANK {BANK_ID}] Significantly increasing training intensity due to very low quality score")
    
    # If we've been rejected multiple times, try different approach
    if quality_data.get('rejectedCount', 0) > quality_data.get('acceptedCount', 0):
        print(f"🔄 [BANK {BANK_ID}] Trying alternative training approach due to multiple rejections")
        training_params["use_regularization"] = True
        training_params["dropout_rate"] = 0.3
    
    return training_params



if __name__ == "__main__":
    print(f"🏦 [BANK {BANK_ID}] Starting Federated Learning client...")
    threading.Thread(target=start_websocket_listener, daemon=True).start()
    while True:
        time.sleep(1)