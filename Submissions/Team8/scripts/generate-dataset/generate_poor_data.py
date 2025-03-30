import pandas as pd
import numpy as np
import os
import argparse
from sklearn.preprocessing import StandardScaler

"""
This script generates poor-quality data for testing the reputation system.
It creates synthetic data with various quality issues that will result in 
poor models when used for training, causing the bank's reputation to decrease.
"""

def generate_poor_quality_data(bank_name, problem_type="noisy", output_dir="./data"):
    """
    Generates data with specific quality issues to test reputation system.
    
    Args:
        bank_name: Name of the bank (for file naming)
        problem_type: Type of quality issue to introduce
            - "noisy": Extremely noisy data
            - "biased": Heavily biased data (imbalanced classes)
            - "missing": Data with missing values
            - "outliers": Data with extreme outliers
            - "constant": Data with low variability (near-constant features)
            - "random": Complete random data with no patterns
        output_dir: Directory to save the generated data
    """
    print(f"Generating {problem_type} data for {bank_name}...")
    
    # Check if the data directory exists
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created output directory: {output_dir}")
    
    # Try to load the Kaggle fraud dataset if available
    try:
        file_path = os.path.join(output_dir, "creditcard.csv")
        if not os.path.exists(file_path):
            # If original data not found, create synthetic data
            print(f"Original data not found at {file_path}. Creating synthetic data...")
            df = create_synthetic_data(10000)
        else:
            df = pd.read_csv(file_path)
            print(f"Loaded original data with shape: {df.shape}")
        
        # Normalize the dataset
        if "Amount" in df.columns:
            df["Amount"] = (df["Amount"] - df["Amount"].mean()) / df["Amount"].std()
        if "Time" in df.columns:
            df["Time"] = df["Time"] % (24 * 3600)  # Convert time to a 24-hour window
        
        # Use a subset of the data
        bank_df = df.sample(n=min(50000, len(df)), random_state=42).copy()
        
    except Exception as e:
        print(f"Error loading original data: {e}")
        print("Creating synthetic data instead...")
        bank_df = create_synthetic_data(10000)
    
    # Apply quality problems based on type
    if problem_type == "noisy":
        # Extreme noise that destroys signal
        print("Adding extreme noise to destroy signal patterns...")
        for col in bank_df.columns[:-1]:  # Exclude target column
            noise = np.random.normal(0, 3.0, len(bank_df))
            bank_df[col] = bank_df[col] + noise
        
    elif problem_type == "biased":
        # Create heavily biased data (almost all one class)
        print("Creating heavily biased data (imbalanced classes)...")
        if "Class" in bank_df.columns:
            # Make it mostly fraudulent (opposite of real data)
            bank_df["Class"] = np.random.choice([0, 1], size=len(bank_df), p=[0.01, 0.99])
        else:
            # If no "Class" column, create a target column with extreme bias
            bank_df["target"] = np.random.choice([0, 1], size=len(bank_df), p=[0.01, 0.99])
        
    elif problem_type == "missing":
        # Introduce many missing values (NaN)
        print("Introducing missing values (NaN)...")
        for col in bank_df.columns[:-1]:  # Exclude target column
            mask = np.random.choice([True, False], size=len(bank_df), p=[0.3, 0.7])
            bank_df.loc[mask, col] = np.nan
            
    elif problem_type == "outliers":
        # Add extreme outliers
        print("Adding extreme outliers...")
        for col in bank_df.columns[:-1]:  # Exclude target column
            mask = np.random.choice([True, False], size=len(bank_df), p=[0.1, 0.9])
            bank_df.loc[mask, col] = bank_df[col] * 100
            
    elif problem_type == "constant":
        # Make features near-constant (very low variability)
        print("Reducing feature variability (near-constant features)...")
        for col in bank_df.columns[:-1]:  # Exclude target column
            mean_val = bank_df[col].mean()
            # Add tiny variations to avoid numerical issues
            bank_df[col] = mean_val + np.random.normal(0, 0.0001, len(bank_df))
            
    elif problem_type == "random":
        # Complete random data with no patterns
        print("Creating completely random data with no patterns...")
        for col in bank_df.columns[:-1]:  # Exclude target column
            bank_df[col] = np.random.randn(len(bank_df))
    
    # Ensure the target column is named correctly
    if "Class" not in bank_df.columns and "target" not in bank_df.columns:
        # Add a random target column as fallback
        bank_df["target"] = np.random.choice([0, 1], size=len(bank_df))
    
    # Save the dataset
    bank_folder = os.path.join(output_dir, bank_name.lower())
    if not os.path.exists(bank_folder):
        os.makedirs(bank_folder)
        
    output_path = os.path.join(bank_folder, f"{bank_name.lower()}_fraud_data.csv")
    bank_df.to_csv(output_path, index=False)
    
    print(f"✅ Generated poor quality data ({problem_type}) for {bank_name} at {output_path}")
    return output_path

def create_synthetic_data(n_samples=10000, n_features=30):
    """
    Creates synthetic data if the original dataset is not available.
    """
    print(f"Creating synthetic data with {n_samples} samples and {n_features} features...")
    
    # Generate random features
    X = np.random.randn(n_samples, n_features)
    
    # Create a target with some pattern (linear combination of features with noise)
    weights = np.random.randn(n_features)
    y_proba = 1 / (1 + np.exp(-np.dot(X, weights) + np.random.normal(0, 0.5, n_samples)))
    y = (y_proba > 0.5).astype(int)
    
    # Create a DataFrame
    columns = [f"V{i}" for i in range(1, n_features + 1)]
    df = pd.DataFrame(X, columns=columns)
    df["Class"] = y
    
    # Add a Time and Amount feature to mimic credit card fraud data
    df["Time"] = np.random.randint(0, 24 * 3600, n_samples)  # 24 hours in seconds
    df["Amount"] = np.random.exponential(scale=100, size=n_samples)  # Random transaction amounts
    
    return df

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate poor quality data for testing reputation system")
    parser.add_argument("--bank", type=str, choices=["DBS", "OCBC", "ING"], required=True, 
                        help="Bank name to generate data for")
    parser.add_argument("--problem", type=str, 
                        choices=["noisy", "biased", "missing", "outliers", "constant", "random"], 
                        default="noisy", help="Type of quality problem to introduce")
    parser.add_argument("--output", type=str, default="./data", 
                        help="Output directory to save generated data")
    
    args = parser.parse_args()
    
    # Generate the poor quality data
    output_path = generate_poor_quality_data(args.bank, args.problem, args.output)
    
    print(f"\nData generation complete.")
    print(f"To test scenario 2 (poor model quality), replace the bank's training data with this file:")
    print(f"  {output_path}")
    print("\nThis will cause the bank to train a poor-quality model, which will be rejected by the aggregator,")
    print("resulting in a decrease in the bank's reputation score.")