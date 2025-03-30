import os
import json
import time
import requests
import websocket
import numpy as np
import tensorflow as tf
import hashlib
from datetime import datetime, timedelta
import logging
import threading

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("aggregator")

# Configuration
FABRIC_API_WS = os.getenv("AGGREGATOR_WS_URL", "ws://hlf-gateway-aggregator:8890/ws")
FABRIC_API_URL = os.getenv("AGGREGATOR_GATEWAY_URL", "http://hlf-gateway-aggregator:8890")
MINIO_HANDLER_URL = os.getenv("MINIO_HANDLER_URL", "http://minio-handler:9002")
MODEL_DIR = os.getenv("MODEL_DIR", "/models")

# Dynamic Threshold Configuration
MIN_THRESHOLD = float(os.getenv("MIN_THRESHOLD", "0.5"))  # Minimum threshold for model acceptance
MAX_THRESHOLD = float(os.getenv("MAX_THRESHOLD", "0.95"))  # Maximum threshold
INITIAL_THRESHOLD = float(os.getenv("INITIAL_THRESHOLD", "0.75"))  # Starting threshold
THRESHOLD_HISTORY_SIZE = int(os.getenv("THRESHOLD_HISTORY_SIZE", "5"))  # Number of rounds to consider
THRESHOLD_ADJUSTMENT_RATE = float(os.getenv("THRESHOLD_ADJUSTMENT_RATE", "0.05"))  # Rate of adjustment

# Reputation System Configuration
REPUTATION_INIT = float(os.getenv("REPUTATION_INIT", "0.5"))  # Initial reputation for new participants
REPUTATION_MAX = float(os.getenv("REPUTATION_MAX", "1.0"))  # Maximum reputation score
REPUTATION_MIN = float(os.getenv("REPUTATION_MIN", "0.1"))  # Minimum reputation score
REPUTATION_REWARD = float(os.getenv("REPUTATION_REWARD", "0.05"))  # Reward for good models
REPUTATION_PENALTY = float(os.getenv("REPUTATION_PENALTY", "0.1"))  # Penalty for bad models
REPUTATION_PENALTY_NONPARTICIPATION = float(os.getenv("REPUTATION_PENALTY_NONPARTICIPATION", "0.15"))  # Penalty for not participating

# Round Tracking Configuration
ROUND_TIMEOUT_MINUTES = int(os.getenv("ROUND_TIMEOUT_MINUTES", "3"))  # Minutes to wait for submissions before timeout
DEFAULT_PARTICIPANTS = ["dbs", "ing", "ocbc"]  # Default list of banks expected to participate

# Global state for threshold and reputation management
threshold_state = {
    "current_threshold": INITIAL_THRESHOLD,
    "round_history": [],  # Will store metrics from previous rounds
    "participant_history": {},  # Will store performance history per participant
    "reputation_scores": {}  # Will store reputation scores per participant
}

# Global state for round tracking
active_rounds = {}  # Map of round_id -> round_info
round_locks = {}  # Locks to prevent race conditions

def fetch_model_from_minio(round_id, participant_id):
    """Requests a pre-signed download URL from MinIO-Handler and downloads the model."""
    logger.info(f"📥 [AGGREGATOR] Requesting download URL for {participant_id} in round {round_id}...")

    response = requests.post(
        f"{MINIO_HANDLER_URL}/download",
        json={"roundId": round_id, "bankId": participant_id}
    )

    if response.status_code != 200:
        logger.error(f"❌ [AGGREGATOR] Failed to get download URL: {response.text}")
        return None

    download_url = response.json()["downloadUrl"]
    local_path = os.path.join(MODEL_DIR, round_id, f"{participant_id}.weights")
    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    # Step 2: Download the model using the pre-signed URL
    logger.info(f"📥 [AGGREGATOR] Downloading model from {download_url}")
    model_response = requests.get(download_url)

    if model_response.status_code == 200:
        with open(local_path, "wb") as file:
            file.write(model_response.content)
        logger.info(f"✅ [AGGREGATOR] Model downloaded and saved: {local_path}")
        return local_path
    else:
        logger.error(f"❌ [AGGREGATOR] Failed to download model: {model_response.text}")
        return None

def load_model_weights(model_path):
    """Loads model weights safely and ensures they are not empty."""
    try:
        model = tf.keras.models.load_model(model_path)
        weights = model.get_weights()

        if not weights or len(weights) == 0:
            logger.error(f"❌ [AGGREGATOR] Model at {model_path} has no weights! Skipping...")
            return None
        
        return weights, model
    except Exception as e:
        logger.error(f"❌ [AGGREGATOR] Failed to load model weights from {model_path}: {e}")
        return None

def get_participant_reputation(participant_id):
    """Gets the current reputation score for a participant."""
    if participant_id not in threshold_state["reputation_scores"]:
        # Initialize new participant
        threshold_state["reputation_scores"][participant_id] = REPUTATION_INIT
        logger.info(f"🆕 [AGGREGATOR] Initialized reputation for {participant_id}: {REPUTATION_INIT}")
    
    return threshold_state["reputation_scores"][participant_id]

def update_participant_reputation(participant_id, quality_score, accepted, reason="Model quality evaluation", round_id="unknown"):
    """Updates a participant's reputation based on model quality and acceptance."""
    current_rep = get_participant_reputation(participant_id)
    
    if accepted:
        # Reward for accepted models, higher reward for higher quality
        reward = REPUTATION_REWARD * (1 + quality_score)
        new_rep = min(current_rep + reward, REPUTATION_MAX)
        logger.info(f"⬆️ [AGGREGATOR] Increasing reputation for {participant_id}: {current_rep:.2f} -> {new_rep:.2f}")
    else:
        # Penalty for rejected models, reduced for higher quality (near threshold)
        penalty_factor = 1.0 - (quality_score / threshold_state["current_threshold"])
        penalty = REPUTATION_PENALTY * max(0.2, penalty_factor)  # At least 20% of penalty
        new_rep = max(current_rep - penalty, REPUTATION_MIN)
        logger.info(f"⬇️ [AGGREGATOR] Decreasing reputation for {participant_id}: {current_rep:.2f} -> {new_rep:.2f}")
    
    # Update reputation score
    threshold_state["reputation_scores"][participant_id] = new_rep
    
    # Write to blockchain
    record_reputation_update(participant_id, new_rep, reason, round_id)
    
    return new_rep

def check_for_non_participants(round_id, submitted_participants, expected_participants):
    """
    Identifies banks that didn't participate in a training round and penalizes them.
    
    Args:
        round_id: The ID of the current training round
        submitted_participants: List of participants who submitted models
        expected_participants: List of all participants expected to submit models
    
    Returns:
        List of participants who did not submit models
    """
    logger.info(f"🔍 [AGGREGATOR] Checking for non-participants in round {round_id}...")
    
    # Convert lists to sets for easier comparison
    submitted_set = set(submitted_participants)
    expected_set = set(expected_participants)
    
    # Find non-participants (expected but didn't submit)
    non_participants = expected_set - submitted_set
    
    if non_participants:
        logger.warning(f"⚠️ [AGGREGATOR] Found {len(non_participants)} non-participants: {', '.join(non_participants)}")
        
        # Apply penalty to each non-participant
        for participant_id in non_participants:
            current_rep = get_participant_reputation(participant_id)
            
            # Higher penalty for non-participation than poor model quality
            penalty = REPUTATION_PENALTY_NONPARTICIPATION
            new_rep = max(current_rep - penalty, REPUTATION_MIN)
            
            logger.info(f"⬇️ [AGGREGATOR] Decreasing reputation for non-participant {participant_id}: {current_rep:.2f} -> {new_rep:.2f}")
            
            # Update reputation score
            threshold_state["reputation_scores"][participant_id] = new_rep
            
            # Record on blockchain
            record_reputation_update(
                participant_id, 
                new_rep, 
                f"Non-participation in round {round_id}", 
                round_id
            )
    else:
        logger.info(f"✅ [AGGREGATOR] All expected participants submitted models for round {round_id}")
    
    return list(non_participants)

def record_reputation_update(participant_id, reputation_score, reason="Model quality evaluation", round_id="unknown"):
    """Records reputation update to blockchain with reason."""
    try:
        response = requests.post(
            f"{FABRIC_API_URL}/reputation/update",
            json={
                "participantId": participant_id, 
                "score": reputation_score,
                "reason": reason,
                "roundId": round_id
            }
        )
        
        if response.status_code == 200:
            logger.info(f"✅ [AGGREGATOR] Reputation updated on blockchain for {participant_id}: {reputation_score:.4f} (Reason: {reason})")
        else:
            logger.warning(f"⚠️ [AGGREGATOR] Failed to update reputation on blockchain: {response.text}")
    except Exception as e:
        logger.error(f"❌ [AGGREGATOR] Error updating reputation: {e}")

def get_contribution_metadata(round_id, participant_id, model_uri):
    """Retrieves contribution metadata from blockchain."""
    try:
        # Query the blockchain for the contribution details
        url = f"{FABRIC_API_URL}/models/contribution?roundId={round_id}&participantId={participant_id}"
        response = requests.get(url)
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.warning(f"⚠️ [AGGREGATOR] Failed to get contribution metadata: {response.text}")
            return None
    except Exception as e:
        logger.error(f"❌ [AGGREGATOR] Error getting contribution metadata: {e}")
        return None

def evaluate_model_quality(model, weights, participant_id, round_id, model_uri):
    """Evaluates model quality using self-reported metrics and reputation."""
    try:
        # Try to get contribution metadata from blockchain
        try:
            contribution_data = get_contribution_metadata(round_id, participant_id, model_uri)
            logger.info(f"📋 [AGGREGATOR] Retrieved contribution metadata for {participant_id}")
        except Exception as e:
            logger.warning(f"⚠️ [AGGREGATOR] Failed to get contribution metadata: {e}")
            contribution_data = None
        
        # Get current reputation score
        reputation = get_participant_reputation(participant_id)
        
        # Initialize metrics dictionary
        metrics = {}
        metrics["reputation"] = reputation
        
        if contribution_data and "accuracyMetrics" in contribution_data:
            # Use self-reported metrics if available
            accuracy_metrics = contribution_data.get("accuracyMetrics", {})
            
            # Extract accuracy and other reported metrics
            metrics["accuracy"] = accuracy_metrics.get("accuracy", 0.0)
            metrics["validation_loss"] = accuracy_metrics.get("validation_loss", 1.0)
            metrics["validation_samples"] = accuracy_metrics.get("validation_samples", 0)
            metrics["has_nan"] = accuracy_metrics.get("has_nan_predictions", False)
            metrics["has_inf"] = accuracy_metrics.get("has_inf_predictions", False)
            metrics["self_certified"] = accuracy_metrics.get("self_certified", False)
            
            logger.info(f"📊 [AGGREGATOR] Using self-reported metrics for {participant_id}: accuracy={metrics['accuracy']:.4f}")
        else:
            # No reported metrics, do basic structural checks
            logger.warning(f"⚠️ [AGGREGATOR] No reported metrics for {participant_id}, using weight analysis only")
            
            # Assume a moderate accuracy as fallback
            metrics["accuracy"] = 0.7
            
            # Check for NaN or Inf values in weights
            has_nan = any(np.isnan(w).any() for w in weights if w.size > 0)
            has_inf = any(np.isinf(w).any() for w in weights if w.size > 0)
            metrics["has_nan"] = has_nan
            metrics["has_inf"] = has_inf
            metrics["self_certified"] = False
        
        # Always do basic weight analysis regardless of reporting
        # Weight statistics
        weight_magnitudes = [np.mean(np.abs(w)) for w in weights if w.size > 0]
        metrics["avg_weight_magnitude"] = float(np.mean(weight_magnitudes))
        metrics["weight_variance"] = float(np.var(weight_magnitudes))
        
        # Compute a composite quality score (0.0 to 1.0)
        # Start with reported or assumed accuracy
        quality_score = metrics["accuracy"] 
        
        # Adjust based on reputation (higher reputation = more trust in reported metrics)
        trust_factor = 0.5 + (reputation * 0.5)  # Maps 0.0-1.0 to 0.5-1.0
        
        # Weight reported accuracy by trust factor
        quality_score = quality_score * trust_factor
        
        # Reduce score for NaN/Inf values
        if metrics["has_nan"] or metrics["has_inf"]:
            quality_score *= 0.5
            logger.warning(f"⚠️ [AGGREGATOR] Model from {participant_id} contains NaN/Inf values - reducing score")
        
        # Reduce score for extreme weight magnitudes
        if metrics["avg_weight_magnitude"] > 10:
            quality_score *= 0.8
            logger.warning(f"⚠️ [AGGREGATOR] Model from {participant_id} has large weights - reducing score")
        
        # Bonus for self-certified models with good reputation
        if metrics.get("self_certified", False) and reputation > 0.7:
            quality_score = min(quality_score * 1.1, 1.0)  # 10% bonus, max 1.0
            
        metrics["quality_score"] = float(quality_score)
        metrics["trust_factor"] = float(trust_factor)
        
        # Update participant history
        update_participant_history(participant_id, metrics)
        
        logger.info(f"📊 [AGGREGATOR] Final quality score for {participant_id}: {quality_score:.4f} (rep: {reputation:.2f}, trust: {trust_factor:.2f})")
        return metrics
        
    except Exception as e:
        logger.error(f"❌ [AGGREGATOR] Error evaluating model: {e}")
        return {"quality_score": 0.0, "error": str(e), "reputation": get_participant_reputation(participant_id)}

def update_participant_history(participant_id, metrics):
    """Updates historical performance metrics for a participant."""
    if participant_id not in threshold_state["participant_history"]:
        threshold_state["participant_history"][participant_id] = []
    
    # Add new metrics, keeping only the last THRESHOLD_HISTORY_SIZE entries
    threshold_state["participant_history"][participant_id].append(metrics)
    if len(threshold_state["participant_history"][participant_id]) > THRESHOLD_HISTORY_SIZE:
        threshold_state["participant_history"][participant_id].pop(0)

def get_dynamic_threshold(round_id):
    """Calculates the dynamic threshold based on historical performance and participant reputations."""
    # If this is the first round, use the initial threshold
    if not threshold_state["round_history"]:
        logger.info(f"🔍 [AGGREGATOR] Using initial threshold: {INITIAL_THRESHOLD}")
        return INITIAL_THRESHOLD
    
    # Calculate average quality from recent rounds
    recent_qualities = [round_data["avg_quality"] for round_data in threshold_state["round_history"]]
    avg_quality = sum(recent_qualities) / len(recent_qualities)
    
    # Get average reputation across participants
    reputations = list(threshold_state["reputation_scores"].values())
    avg_reputation = sum(reputations) / len(reputations) if reputations else REPUTATION_INIT
    
    # Adjust threshold based on trend and reputation
    if len(recent_qualities) >= 2:
        # If quality is improving, raise the threshold slightly
        if recent_qualities[-1] > recent_qualities[-2]:
            adjustment = THRESHOLD_ADJUSTMENT_RATE * avg_reputation  # Higher adjustment for reputable participants
            new_threshold = min(
                threshold_state["current_threshold"] + adjustment, 
                MAX_THRESHOLD
            )
        else:
            # If quality is decreasing, lower the threshold slightly
            adjustment = THRESHOLD_ADJUSTMENT_RATE * (1 - avg_reputation * 0.5)  # Lower adjustment for reputable participants
            new_threshold = max(
                threshold_state["current_threshold"] - adjustment,
                MIN_THRESHOLD
            )
    else:
        # Not enough history, minor adjustment based on last round
        if avg_quality > threshold_state["current_threshold"]:
            new_threshold = min(
                threshold_state["current_threshold"] + THRESHOLD_ADJUSTMENT_RATE/2, 
                MAX_THRESHOLD
            )
        else:
            new_threshold = max(
                threshold_state["current_threshold"] - THRESHOLD_ADJUSTMENT_RATE/2,
                MIN_THRESHOLD
            )
    
    logger.info(f"🔍 [AGGREGATOR] New dynamic threshold for round {round_id}: {new_threshold:.4f} (was {threshold_state['current_threshold']:.4f}, avg_rep: {avg_reputation:.2f})")
    threshold_state["current_threshold"] = new_threshold
    return new_threshold

def filter_models(model_metrics, round_id):
    """Filters models based on quality threshold and updates reputations."""
    dynamic_threshold = get_dynamic_threshold(round_id)
    accepted_models = []
    rejected_models = []
    
    for participant_id, metrics in model_metrics.items():
        quality_score = metrics["quality_score"]
        
        # Factor in reputation - higher reputation gets a small bonus toward acceptance
        reputation = metrics.get("reputation", get_participant_reputation(participant_id))
        adjusted_threshold = max(dynamic_threshold * (1 - reputation * 0.1), MIN_THRESHOLD)
        
        if quality_score >= adjusted_threshold:
            accepted_models.append(participant_id)
            # Update reputation for accepted model
            update_participant_reputation(
                participant_id, 
                quality_score, 
                True,
                f"Model accepted (quality score: {quality_score:.4f})",
                round_id
            )
        else:
            rejected_models.append(participant_id)
            # Update reputation for rejected model
            update_participant_reputation(
                participant_id, 
                quality_score, 
                False,
                f"Model rejected (quality score: {quality_score:.4f}, below threshold: {adjusted_threshold:.4f})",
                round_id
            )
    
    logger.info(f"🔍 [AGGREGATOR] Round {round_id}: Accepted {len(accepted_models)}/{len(model_metrics)} models (threshold: {dynamic_threshold:.4f})")
    
    if rejected_models:
        logger.info(f"🔍 [AGGREGATOR] Rejected models from: {', '.join(rejected_models)}")
    
    return accepted_models, rejected_models, dynamic_threshold

def update_round_history(round_id, model_metrics, accepted_models):
    """Updates round history with quality metrics."""
    # Compute average quality from this round
    if accepted_models:
        avg_quality = sum(metrics["quality_score"] for pid, metrics in model_metrics.items() 
                           if pid in accepted_models) / len(accepted_models)
    else:
        avg_quality = 0.0
    
    # Compute average reputation
    all_reps = []
    for pid in model_metrics.keys():
        rep = get_participant_reputation(pid)
        all_reps.append(rep)
    avg_reputation = sum(all_reps) / len(all_reps) if all_reps else 0.0
    
    # Record round data
    round_data = {
        "round_id": round_id,
        "timestamp": datetime.now().isoformat(),
        "avg_quality": avg_quality,
        "avg_reputation": avg_reputation,
        "num_models": len(model_metrics),
        "num_accepted": len(accepted_models),
        "threshold": threshold_state["current_threshold"]
    }
    
    # Add to history, keeping only the last THRESHOLD_HISTORY_SIZE entries
    threshold_state["round_history"].append(round_data)
    if len(threshold_state["round_history"]) > THRESHOLD_HISTORY_SIZE:
        threshold_state["round_history"].pop(0)
    
    return round_data

def record_quality_metrics(round_id, round_data, model_metrics, accepted_models, rejected_models):
    """Records quality metrics to the blockchain."""
    try:
        # Prepare data for blockchain recording
        event_data = {
            "round_id": round_id,
            "threshold": round_data["threshold"],
            "avg_quality": round_data["avg_quality"],
            "avg_reputation": round_data["avg_reputation"],
            "accepted_count": len(accepted_models),
            "rejected_count": len(rejected_models),
            "participant_metrics": {}
        }
        
        # Include individual model metrics
        for participant_id, metrics in model_metrics.items():
            event_data["participant_metrics"][participant_id] = {
                "quality_score": metrics["quality_score"],
                "reputation": get_participant_reputation(participant_id),
                "accepted": participant_id in accepted_models
            }
        
        # Submit event to blockchain
        response = requests.post(
            f"{FABRIC_API_URL}/events/quality",
            json=event_data
        )
        
        if response.status_code == 200:
            logger.info(f"✅ [AGGREGATOR] Quality metrics recorded on blockchain")
        else:
            logger.error(f"❌ [AGGREGATOR] Failed to record quality metrics: {response.text}")
            
    except Exception as e:
        logger.error(f"❌ [AGGREGATOR] Error recording quality metrics: {e}")

def federated_averaging_with_reputation(model_paths, participant_ids, model_uris, round_id):
    """Performs FedAvg on collected models with quality filtering and reputation weighting."""
    logger.info(f"🛠️ [AGGREGATOR] Performing Federated Averaging with quality filtering and reputation weighting...")
    
    # Load and evaluate all models
    model_data = {}
    model_metrics = {}
    
    for path, participant_id, model_uri in zip(model_paths, participant_ids, model_uris):
        result = load_model_weights(path)
        if result is None:
            continue
            
        weights, model = result
        
        # Evaluate model quality
        metrics = evaluate_model_quality(model, weights, participant_id, round_id, model_uri)
        model_metrics[participant_id] = metrics
        model_data[participant_id] = weights
    
    # Filter models based on quality threshold and reputation
    accepted_models, rejected_models, threshold = filter_models(model_metrics, round_id)
    
    # Update historical data
    round_data = update_round_history(round_id, model_metrics, accepted_models)
    
    # Record threshold, quality, and reputation data on the blockchain
    record_quality_metrics(round_data, round_data, model_metrics, accepted_models, rejected_models)
    
    # If no models passed the threshold, use all models (failsafe)
    if not accepted_models and model_data:
        logger.warning(f"⚠️ [AGGREGATOR] No models passed threshold! Using all models as failsafe.")
        accepted_models = list(model_data.keys())
    
    # If still no valid models, aggregation fails
    if not accepted_models:
        logger.error(f"❌ [AGGREGATOR] No valid models to aggregate!")
        return None
    
    # Compute Federated Averaging with reputation weighting
    accepted_weights = []
    reputation_weights = []
    
    for participant_id in accepted_models:
        accepted_weights.append(model_data[participant_id])
        # Use reputation as aggregation weight
        reputation = get_participant_reputation(participant_id)
        reputation_weights.append(reputation)
    
    # Normalize reputation weights
    sum_weights = sum(reputation_weights)
    if sum_weights > 0:
        norm_weights = [w / sum_weights for w in reputation_weights]
    else:
        # Fallback to equal weighting if all reputations are zero
        norm_weights = [1.0 / len(accepted_models)] * len(accepted_models)
    
    logger.info(f"⚖️ [AGGREGATOR] Aggregating with reputation weights: {list(zip(accepted_models, norm_weights))}")
    
    # Weighted averaging of each layer
    avg_weights = []
    for layer_idx in range(len(accepted_weights[0])):
        layer_arrays = [weights[layer_idx] for weights in accepted_weights]
        weighted_sum = np.zeros_like(layer_arrays[0])
        
        for idx, layer_array in enumerate(layer_arrays):
            weighted_sum += layer_array * norm_weights[idx]
            
        avg_weights.append(weighted_sum)
    
    # Save the aggregated model
    aggregated_model_path = os.path.join(MODEL_DIR, f"{round_id}_aggregated_model.h5")
    
    # Create a model with the same architecture
    model = tf.keras.Sequential()
    input_shape = accepted_weights[0][0].shape[0]  # Get input shape from first weight matrix
    
    model.add(tf.keras.layers.Dense(64, activation='relu', input_shape=(input_shape,)))
    model.add(tf.keras.layers.Dense(32, activation='relu'))
    model.add(tf.keras.layers.Dense(1, activation='sigmoid'))
    
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    model.set_weights(avg_weights)
    model.save(aggregated_model_path)
    
    logger.info(f"✅ [AGGREGATOR] Aggregated model saved: {aggregated_model_path}")
    return aggregated_model_path

def upload_model_to_minio(model_path, round_id):
    """Uploads the aggregated model to MinIO via MinIO-Handler."""
    logger.info(f"📤 [AGGREGATOR] Requesting upload URL for final model (round {round_id})...")

    response = requests.post(
        f"{MINIO_HANDLER_URL}/upload",
        json={"roundId": round_id, "bankId": "aggregator"}
    )

    if response.status_code != 200:
        logger.error(f"❌ [AGGREGATOR] Failed to get upload URL: {response.text}")
        return None

    upload_url = response.json()["uploadUrl"]
    logger.info(f"📤 [AGGREGATOR] Uploading aggregated model to MinIO...")

    with open(model_path, "rb") as file:
        upload_response = requests.put(upload_url, data=file)

    if upload_response.status_code == 200:
        logger.info(f"✅ [AGGREGATOR] Aggregated model successfully uploaded to MinIO.")
        return response.json()["objectPath"]
    else:
        logger.error(f"❌ [AGGREGATOR] Failed to upload aggregated model: {upload_response.text}")
        return None

def submit_final_model(round_id, model_uri, quality_data):
    """Submits the final aggregated model to Fabric API with quality metrics."""
    logger.info(f"📩 [AGGREGATOR] Submitting final aggregated model for round {round_id}...")

    # Calculate a hash for the aggregated model
    aggregated_model_path = os.path.join(MODEL_DIR, f"{round_id}_aggregated_model.h5")
    with open(aggregated_model_path, "rb") as f:
        model_data = f.read()
        weight_hash = hashlib.sha256(model_data).hexdigest()

    # Add reputation data to quality data
    reputation_data = {
        participant_id: get_participant_reputation(participant_id)
        for participant_id in threshold_state["reputation_scores"]
    }
    quality_data["reputation_scores"] = reputation_data

    response = requests.post(
        f"{FABRIC_API_URL}/models/final",
        json={
            "roundId": round_id, 
            "modelURI": model_uri, 
            "weightHash": weight_hash,
            "qualityData": quality_data
        }
    )

    if response.status_code == 200:
        logger.info(f"✅ [AGGREGATOR] Final model submitted successfully!")
    else:
        logger.error(f"❌ [AGGREGATOR] Failed to submit final model: {response.text}")

def get_round_info(round_id):
    """Get information about an active round, creating it if it doesn't exist."""
    if round_id not in active_rounds:
        active_rounds[round_id] = {
            "start_time": datetime.now(),
            "expected_participants": DEFAULT_PARTICIPANTS.copy(),
            "submissions": {},
            "processing": False
        }
        logger.info(f"🆕 [AGGREGATOR] Created new round tracking for {round_id} with expected participants: {active_rounds[round_id]['expected_participants']}")
    return active_rounds[round_id]

def handle_model_submission(round_id, participant_id, model_uri):
    """Handle a model submission from a participant."""
    round_info = get_round_info(round_id)
    
    # Add submission
    round_info["submissions"][participant_id] = model_uri
    logger.info(f"📬 [AGGREGATOR] Model submission from {participant_id} for round {round_id}")
    
    # Check if all expected participants have submitted
    all_submitted = all(p in round_info["submissions"] for p in round_info["expected_participants"])
    
    if all_submitted:
        logger.info(f"✅ [AGGREGATOR] All expected participants have submitted for round {round_id}. Starting aggregation...")
        # Start aggregation in a separate thread to avoid blocking
        t = threading.Thread(target=process_round, args=(round_id,), daemon=True)
        t.start()
        return True
    else:
        # Check if we should start a timeout timer
        if "timeout_timer" not in round_info:
            logger.info(f"⏱️ [AGGREGATOR] Starting timeout timer for round {round_id}: {ROUND_TIMEOUT_MINUTES} minutes")
            timeout_time = round_info["start_time"] + timedelta(minutes=ROUND_TIMEOUT_MINUTES)
            round_info["timeout_timer"] = timeout_time
            
            # Schedule a check after the timeout
            timeout_seconds = ROUND_TIMEOUT_MINUTES * 60
            # Start a thread that will check the round status after the timeout
            t = threading.Thread(target=check_round_timeout, args=(round_id, timeout_seconds), daemon=True)
            t.start()
            
        # Log current submission status
        missing = [p for p in round_info["expected_participants"] if p not in round_info["submissions"]]
        logger.info(f"⏳ [AGGREGATOR] Waiting for submissions from: {', '.join(missing)} for round {round_id}")
        
        return False

def check_round_timeout(round_id, timeout_seconds):
    """Check if a round has timed out and process it if necessary."""
    # Sleep until the timeout
    time.sleep(timeout_seconds)
    
    # Check if the round is still active and not fully submitted
    if round_id in active_rounds:
        round_info = active_rounds[round_id]
        all_submitted = all(p in round_info["submissions"] for p in round_info["expected_participants"])
        
        if not all_submitted and not round_info.get("processing", False):
            logger.warning(f"⏰ [AGGREGATOR] Round {round_id} timed out after {ROUND_TIMEOUT_MINUTES} minutes")
            # Process the round with whatever submissions we have
            process_round(round_id)

def process_round(round_id):
    """Process a round by downloading models, aggregating them, and submitting the result."""
    # Check if the round exists and is not already being processed
    if round_id not in active_rounds:
        logger.error(f"❌ [AGGREGATOR] Cannot process round {round_id}: round not found")
        return
    
    round_info = active_rounds[round_id]
    
    # Prevent duplicate processing
    if round_info.get("processing", False):
        logger.warning(f"⚠️ [AGGREGATOR] Round {round_id} is already being processed")
        return
    
    round_info["processing"] = True
    
    try:
        logger.info(f"🚀 [AGGREGATOR] Processing round {round_id}")
        
        # Get submissions and expected participants
        submissions = round_info["submissions"]
        expected_participants = round_info["expected_participants"]
        
        # Check for non-participants and penalize them
        non_participants = check_for_non_participants(round_id, list(submissions.keys()), expected_participants)
        
        # Download all models from participants who submitted
        model_paths = []
        participant_ids = []
        model_uris = []
        
        for participant_id, model_uri in submissions.items():
            model_path = fetch_model_from_minio(round_id, participant_id)
            if model_path:
                model_paths.append(model_path)
                participant_ids.append(participant_id)
                model_uris.append(model_uri)

        if not model_paths:
            logger.error(f"❌ [AGGREGATOR] No models downloaded. Aborting aggregation for round {round_id}.")
            return

        # Perform aggregation with quality filtering and reputation weighting
        aggregated_model_path = federated_averaging_with_reputation(model_paths, participant_ids, model_uris, round_id)
        if not aggregated_model_path:
            logger.error(f"❌ [AGGREGATOR] Failed to aggregate models. Aborting.")
            return

        # Upload aggregated model
        final_model_uri = upload_model_to_minio(aggregated_model_path, round_id)
        if not final_model_uri:
            logger.error(f"❌ [AGGREGATOR] Failed to upload aggregated model. Aborting.")
            return

        # Prepare quality data for blockchain
        quality_data = {
            "threshold": threshold_state["current_threshold"],
            "round_history": threshold_state["round_history"][-1] if threshold_state["round_history"] else None,
            "participants_accepted": len(model_paths),
            "total_participants": len(submissions),
            "non_participants": len(non_participants),
            "avg_reputation": sum(threshold_state["reputation_scores"].values()) / len(threshold_state["reputation_scores"]) if threshold_state["reputation_scores"] else 0.0
        }

        # Submit final model to blockchain
        submit_final_model(round_id, final_model_uri, quality_data)
        
        # Mark round as complete
        round_info["completed"] = True
        logger.info(f"✅ [AGGREGATOR] Round {round_id} processing completed successfully")
        
    except Exception as e:
        logger.error(f"❌ [AGGREGATOR] Error processing round {round_id}: {e}")
    finally:
        # Always mark processing as done, even if we fail
        round_info["processing"] = False
        
        # Remove the round from active rounds after a delay to avoid processing it again
        def remove_round():
            time.sleep(60)  # Wait 1 minute before removing
            if round_id in active_rounds:
                del active_rounds[round_id]
                logger.info(f"🧹 [AGGREGATOR] Removed round {round_id} from active rounds")
                
        threading.Thread(target=remove_round, daemon=True).start()

def on_message(ws, message):
    """Handles incoming WebSocket messages."""
    try:
        logger.info(f"📝 [AGGREGATOR] Received WebSocket message: {message}")

        # Parse the message
        data = json.loads(message)
        event_type = data.get("event")

        if event_type == "ROUND_STARTED":
            # Parse event data
            event_data = json.loads(data.get("data", "{}"))
            round_id = event_data.get("round_id")
            initiator = event_data.get("initiator")
            description = event_data.get("description")
            
            logger.info(f"🚀 [AGGREGATOR] New training round started: {round_id}")
            
            # Initialize round tracking with default participants
            round_info = get_round_info(round_id)
            logger.info(f"🔍 [AGGREGATOR] Tracking round {round_id} with expected participants: {round_info['expected_participants']}")
            
        elif event_type == "MODEL_UPLOADED":
            # Parse event data
            event_data = json.loads(data.get("data", "{}"))
            round_id = event_data.get("round_id")
            participant_id = event_data.get("bank_id")
            model_uri = event_data.get("model_uri")
            
            logger.info(f"📬 [AGGREGATOR] Model uploaded for round {round_id} by {participant_id}: {model_uri}")
            
            # Handle the model submission
            handle_model_submission(round_id, participant_id, model_uri)
            
        # Legacy support for direct aggregation command (deprecated)
        elif event_type == "START_AGGREGATION":
            # Parse command data
            round_id = data.get("round_id")
            submissions = data.get("submissions", {})
            
            logger.warning(f"⚠️ [AGGREGATOR] Received legacy START_AGGREGATION command for round {round_id}")
            
            # Update round tracking
            round_info = get_round_info(round_id)
            for participant_id, model_uri in submissions.items():
                round_info["submissions"][participant_id] = model_uri
                
            # Process the round
            process_round(round_id)

    except json.JSONDecodeError as e:
        logger.error(f"❌ [AGGREGATOR] Failed to parse WebSocket message: {e}")
    except Exception as e:
        logger.error(f"❌ [AGGREGATOR] Error processing message: {e}")

def on_error(ws, error):
    logger.error(f"❌ [AGGREGATOR] WebSocket error: {error}")

def on_close(ws, close_status_code, close_msg):
    logger.info(f"🔒 [AGGREGATOR] WebSocket connection closed: {close_status_code} - {close_msg}")
    logger.info("   Attempting to reconnect in 5 seconds...")
    time.sleep(5)

def on_open(ws):
    logger.info("🔓 [AGGREGATOR] WebSocket connection established")

def start_websocket_listener():
    """Starts the WebSocket client with proper callbacks."""
    while True:
        try:
            ws = websocket.WebSocketApp(
                FABRIC_API_WS,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close,
                on_open=on_open
            )
            ws.run_forever()
        except Exception as e:
            logger.error(f"❌ [AGGREGATOR] WebSocket error: {e}. Retrying in 5s...")
            time.sleep(5)

def save_state():
    """Save threshold and reputation state to disk."""
    try:
        threshold_path = os.path.join(MODEL_DIR, "threshold_state.json")
        with open(threshold_path, 'w') as f:
            json.dump({
                "current_threshold": threshold_state["current_threshold"],
                "round_history": threshold_state["round_history"],
                "reputation_scores": threshold_state["reputation_scores"]
            }, f)
        logger.info(f"💾 [AGGREGATOR] Saved threshold and reputation state")
    except Exception as e:
        logger.error(f"❌ [AGGREGATOR] Failed to save state: {e}")

def load_state():
    """Load threshold and reputation state from disk."""
    try:
        threshold_path = os.path.join(MODEL_DIR, "threshold_state.json")
        if os.path.exists(threshold_path):
            with open(threshold_path, 'r') as f:
                saved_state = json.load(f)
                threshold_state["current_threshold"] = saved_state.get("current_threshold", INITIAL_THRESHOLD)
                threshold_state["round_history"] = saved_state.get("round_history", [])
                threshold_state["reputation_scores"] = saved_state.get("reputation_scores", {})
                logger.info(f"📈 [AGGREGATOR] Loaded threshold state: {threshold_state['current_threshold']:.4f}")
                logger.info(f"📊 [AGGREGATOR] Loaded reputation for {len(threshold_state['reputation_scores'])} participants")
        else:
            logger.info("📝 [AGGREGATOR] No saved state found, using initial values")
    except Exception as e:
        logger.warning(f"⚠️ [AGGREGATOR] Could not load state: {e}")

if __name__ == "__main__":
    # Create model directory if it doesn't exist
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    # Load previous threshold and reputation state
    load_state()
    
    logger.info(f"🏗️ [AGGREGATOR] Starting event listener with dynamic threshold and reputation system...")
    logger.info(f"⏱️ [AGGREGATOR] Round timeout set to {ROUND_TIMEOUT_MINUTES} minutes")
    logger.info(f"👥 [AGGREGATOR] Default participants: {DEFAULT_PARTICIPANTS}")
    
    # Save state periodically
    def save_state_periodically():
        while True:
            try:
                save_state()
            except Exception as e:
                logger.error(f"❌ [AGGREGATOR] Failed to save state: {e}")
            time.sleep(300)  # Save every 5 minutes
    
    # Start background thread for saving state
    threading.Thread(target=save_state_periodically, daemon=True).start()
    
    # Start WebSocket listener
    start_websocket_listener()