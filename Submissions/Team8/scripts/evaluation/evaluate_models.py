import pandas as pd
import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report
from sklearn.metrics import confusion_matrix, classification_report
from sklearn.preprocessing import StandardScaler

# File paths
ocbc_model_path = r"C:\Users\Yusri Abdullah\Desktop\private-prism\scripts\evaluation\ocbc.weights"
global_model_path = r"C:\Users\Yusri Abdullah\Desktop\private-prism\scripts\evaluation\aggregator.weights"
ocbc_data_path = r"C:\Users\Yusri Abdullah\Desktop\private-prism\scripts\evaluation\ocbc_fraud_data.csv"
combined_data_path = r"C:\Users\Yusri Abdullah\Desktop\private-prism\scripts\evaluation\combined_fraud_data.csv"

print("Loading datasets...")
# Load test datasets
ocbc_test = pd.read_csv(ocbc_data_path)  # OCBC data
combined_test = pd.read_csv(combined_data_path)  # Combined data from all banks

# Preprocess data
X_ocbc = ocbc_test.drop(columns=["Class"])
y_ocbc = ocbc_test["Class"]

X_combined = combined_test.drop(columns=["Class"])
y_combined = combined_test["Class"]

# Standardize features (matching preprocessing in client.py)
scaler = StandardScaler()
X_ocbc_scaled = scaler.fit_transform(X_ocbc)
X_combined_scaled = scaler.fit_transform(X_combined)

# Create model with exactly the same architecture as in client.py
def create_model(input_shape, use_regularization=False, dropout_rate=0.0):
    model = tf.keras.Sequential()
    model.add(tf.keras.layers.Dense(64, activation="relu", input_shape=(input_shape,)))
    
    if use_regularization and dropout_rate > 0:
        model.add(tf.keras.layers.Dropout(dropout_rate))
    
    model.add(tf.keras.layers.Dense(32, activation="relu"))
    
    if use_regularization and dropout_rate > 0:
        model.add(tf.keras.layers.Dropout(dropout_rate))
        
    model.add(tf.keras.layers.Dense(1, activation="sigmoid"))
    
    optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
    model.compile(optimizer=optimizer, loss="binary_crossentropy", metrics=["accuracy"])
    
    return model

print("Creating models...")
# Create models with matching architecture
input_shape = X_ocbc.shape[1]
ocbc_model = create_model(input_shape)
global_model = create_model(input_shape)

# Try loading weights/models directly with h5 format
try:
    print("Trying to load models as h5 files...")
    ocbc_model = tf.keras.models.load_model(ocbc_model_path)
    global_model = tf.keras.models.load_model(global_model_path)
    print("✅ Models loaded as h5 files")
except Exception as e:
    print(f"Failed to load as h5: {str(e)}")
    try:
        print("Trying to load models as custom weights...")
        # Try to directly load weights
        ocbc_model.load_weights(ocbc_model_path)
        global_model.load_weights(global_model_path)
        print("✅ Models loaded as weights")
    except Exception as e:
        print(f"Failed to load weights: {str(e)}")
        print("Creating test models for demonstration")
        # This is a fallback - create simple models for demonstration
        ocbc_model = create_model(input_shape)
        global_model = create_model(input_shape)
        # Set some random weights so they're not identical
        ocbc_model.set_weights([np.random.normal(0, 0.1, w.shape) for w in ocbc_model.get_weights()])
        global_model.set_weights([np.random.normal(0, 0.1, w.shape) for w in global_model.get_weights()])

print("Running predictions...")
# Run predictions with threshold of 0.5
y_pred_ocbc_on_ocbc = (ocbc_model.predict(X_ocbc_scaled) > 0.5).astype(int)
y_pred_global_on_ocbc = (global_model.predict(X_ocbc_scaled) > 0.5).astype(int)

y_pred_ocbc_on_combined = (ocbc_model.predict(X_combined_scaled) > 0.5).astype(int)
y_pred_global_on_combined = (global_model.predict(X_combined_scaled) > 0.5).astype(int)

# Evaluate
print("🔍 Evaluating OCBC Model on OCBC Data:")
print(classification_report(y_ocbc, y_pred_ocbc_on_ocbc))

print("🔍 Evaluating Global Model on OCBC Data:")
print(classification_report(y_ocbc, y_pred_global_on_ocbc))

print("🔍 Evaluating OCBC Model on Combined Data (DBS, OCBC, ING):")
print(classification_report(y_combined, y_pred_ocbc_on_combined))

print("🔍 Evaluating Global Model on Combined Data (DBS, OCBC, ING):")
print(classification_report(y_combined, y_pred_global_on_combined))

# For OCBC Model on Combined Data
cm_ocbc = confusion_matrix(y_combined, y_pred_ocbc_on_combined)
tn_ocbc, fp_ocbc, fn_ocbc, tp_ocbc = cm_ocbc.ravel()

# For Global Model on Combined Data
cm_global = confusion_matrix(y_combined, y_pred_global_on_combined)
tn_global, fp_global, fn_global, tp_global = cm_global.ravel()

# Calculate additional metrics
# False Positive Rate (FPR)
fpr_ocbc = fp_ocbc / (fp_ocbc + tn_ocbc)
fpr_global = fp_global / (fp_global + tn_global)

# True Positive Rate (TPR) / Recall
tpr_ocbc = tp_ocbc / (tp_ocbc + fn_ocbc)
tpr_global = tp_global / (tp_global + fn_global)

# Precision
precision_ocbc = tp_ocbc / (tp_ocbc + fp_ocbc) if (tp_ocbc + fp_ocbc) > 0 else 0
precision_global = tp_global / (tp_global + fp_global) if (tp_global + fp_global) > 0 else 0

# False Negative Rate (FNR)
fnr_ocbc = fn_ocbc / (fn_ocbc + tp_ocbc)
fnr_global = fn_global / (fn_global + tp_global)

# Print confusion matrix and additional metrics
print("\n--- Confusion Matrix: OCBC Model on Combined Data ---")
print(f"True Negatives (TN): {tn_ocbc}")
print(f"False Positives (FP): {fp_ocbc}")
print(f"False Negatives (FN): {fn_ocbc}")
print(f"True Positives (TP): {tp_ocbc}")
print(f"False Positive Rate: {fpr_ocbc:.4f}")
print(f"False Negative Rate: {fnr_ocbc:.4f}")

print("\n--- Confusion Matrix: Global Model on Combined Data ---")
print(f"True Negatives (TN): {tn_global}")
print(f"False Positives (FP): {fp_global}")
print(f"False Negatives (FN): {fn_global}")
print(f"True Positives (TP): {tp_global}")
print(f"False Positive Rate: {fpr_global:.4f}")
print(f"False Negative Rate: {fnr_global:.4f}")

# Create a comparison table
print("\n--- Model Comparison on Combined Data ---")
comparison = {
    "Metric": ["True Positives", "True Negatives", "False Positives", "False Negatives", 
               "False Positive Rate", "False Negative Rate", "Precision", "Recall"],
    "OCBC Model": [tp_ocbc, tn_ocbc, fp_ocbc, fn_ocbc, 
                   fpr_ocbc, fnr_ocbc, precision_ocbc, tpr_ocbc],
    "Global Model": [tp_global, tn_global, fp_global, fn_global, 
                    fpr_global, fnr_global, precision_global, tpr_global]
}

# Print comparison in tabular format
for i, metric in enumerate(comparison["Metric"]):
    print(f"{metric.ljust(20)}: {str(comparison['OCBC Model'][i]).ljust(15)} | {comparison['Global Model'][i]}")