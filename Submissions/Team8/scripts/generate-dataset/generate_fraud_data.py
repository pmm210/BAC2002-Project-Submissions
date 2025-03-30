import pandas as pd
import numpy as np
import os

# Update the file path to your creditcard.csv location
file_path = r"C:\Users\Yusri Abdullah\Desktop\private-prism\federated\clients\data\creditcard.csv"
df = pd.read_csv(file_path)

# Normalize transaction amount
df["Amount"] = (df["Amount"] - df["Amount"].mean()) / df["Amount"].std()
df["Time"] = df["Time"] % (24 * 3600)  # Convert time into a 24-hour cycle

# More sophisticated fraud data generation function with distinct patterns per bank
def generate_fraud_data(bank_name, num_samples=50000, fraud_ratio=0.5, random_seed=None):
    """
    Generates synthetic fraud data with distinct patterns per bank.
    
    Each bank specializes in detecting different types of fraud:
    - DBS: Time-based fraud (unusual transaction times)
    - OCBC: Amount-based fraud (unusual transaction amounts)
    - ING: Feature correlation fraud (unusual relationships between features)
    """
    if random_seed is not None:
        np.random.seed(random_seed)
    
    # Sample non-fraudulent transactions from the original dataset
    legitimate_samples = df[df['Class'] == 0].sample(n=int(num_samples * (1-fraud_ratio)), 
                                                    random_state=np.random.randint(0, 1000)).copy()
    
    # Create synthetic fraudulent transactions
    num_fraud = int(num_samples * fraud_ratio)
    
    if bank_name == "DBS":
        # DBS specializes in detecting time-based fraud
        fraud_samples = df.sample(n=num_fraud, random_state=np.random.randint(0, 1000)).copy()
        
        # Make fraud happen during unusual hours (late night)
        night_hours = (3 * 3600) + np.random.randint(-1200, 1200, size=num_fraud)  # Around 3 AM
        fraud_samples["Time"] = night_hours
        
        # Modify V1-V3 features in a specific way
        fraud_samples["V1"] = fraud_samples["V1"] * np.random.uniform(-1.5, -0.8, size=num_fraud)
        fraud_samples["V3"] = fraud_samples["V3"] * np.random.uniform(-1.2, -0.5, size=num_fraud)
        
    # For OCBC amount-based fraud
    # Instead of using np.random.choice on arrays, let's use a different approach
    if bank_name == "OCBC":
        fraud_samples = df.sample(n=num_fraud, random_state=np.random.randint(0, 1000)).copy()
        
        # Generate different amount patterns
        amount_pattern = np.random.randint(0, 3, size=num_fraud)
        fraud_amounts = np.zeros(num_fraud)
        
        # Pattern 1: Small specific amounts
        mask1 = amount_pattern == 0
        fraud_amounts[mask1] = np.random.uniform(4, 5, size=mask1.sum())
        
        # Pattern 2: Medium specific amounts
        mask2 = amount_pattern == 1
        fraud_amounts[mask2] = np.random.uniform(20, 25, size=mask2.sum())
        
        # Pattern 3: Large specific amounts
        mask3 = amount_pattern == 2
        fraud_amounts[mask3] = np.random.uniform(95, 100, size=mask3.sum())
        
        # Apply the amounts
        fraud_samples["Amount"] = fraud_amounts
        
        # Modify V4-V6 features in a specific way
        fraud_samples["V4"] = fraud_samples["V4"] * np.random.uniform(-2.0, -1.0, size=num_fraud)
        fraud_samples["V6"] = fraud_samples["V6"] * np.random.uniform(-1.8, -0.9, size=num_fraud)
        
    elif bank_name == "ING":
        # ING specializes in detecting feature correlation fraud
        fraud_samples = df.sample(n=num_fraud, random_state=np.random.randint(0, 1000)).copy()
        
        # Create unusual correlations between features
        base = np.random.normal(0, 1, size=num_fraud)
        fraud_samples["V7"] = base * 3 + np.random.normal(0, 0.5, size=num_fraud)
        fraud_samples["V8"] = -base * 2 + np.random.normal(0, 0.5, size=num_fraud)
        fraud_samples["V9"] = base * 1.5 + np.random.normal(0, 0.5, size=num_fraud)
        
        # Make transactions from unusual locations (approximated by these features)
        fraud_samples["V11"] = fraud_samples["V11"] * np.random.uniform(-1.5, -0.7, size=num_fraud)
        fraud_samples["V12"] = fraud_samples["V12"] * np.random.uniform(-1.5, -0.7, size=num_fraud)
    
    # Set the class label
    fraud_samples["Class"] = 1
    legitimate_samples["Class"] = 0
    
    # Combine legitimate and fraudulent transactions
    bank_df = pd.concat([legitimate_samples, fraud_samples])
    
    # Shuffle the dataset
    bank_df = bank_df.sample(frac=1).reset_index(drop=True)
    
    return bank_df

# Define directories
dbs_train_dir = r"C:\Users\Yusri Abdullah\Desktop\private-prism\federated\clients\data\dbs"
ing_train_dir = r"C:\Users\Yusri Abdullah\Desktop\private-prism\federated\clients\data\ing"
ocbc_train_dir = r"C:\Users\Yusri Abdullah\Desktop\private-prism\federated\clients\data\ocbc"
eval_dir = r"C:\Users\Yusri Abdullah\Desktop\private-prism\scripts\evaluation"

# Ensure directories exist
os.makedirs(dbs_train_dir, exist_ok=True)
os.makedirs(ing_train_dir, exist_ok=True)
os.makedirs(ocbc_train_dir, exist_ok=True)
os.makedirs(eval_dir, exist_ok=True)

print("Generating training datasets with specialized fraud patterns...")

# Increased dataset size for training (100,000 samples)
dbs_train_data = generate_fraud_data("DBS", num_samples=100000, fraud_ratio=0.5, random_seed=42)
ocbc_train_data = generate_fraud_data("OCBC", num_samples=100000, fraud_ratio=0.5, random_seed=43)
ing_train_data = generate_fraud_data("ING", num_samples=100000, fraud_ratio=0.5, random_seed=44)

# Save training datasets to respective bank folders
dbs_train_data.to_csv(f"{dbs_train_dir}\\fraud_data.csv", index=False)
ocbc_train_data.to_csv(f"{ocbc_train_dir}\\fraud_data.csv", index=False)
ing_train_data.to_csv(f"{ing_train_dir}\\fraud_data.csv", index=False)

print(f"✅ Training datasets generated with 50/50 class balance:")
print(f"   DBS: {len(dbs_train_data)} samples ({dbs_train_data['Class'].sum()} fraud)")
print(f"   OCBC: {len(ocbc_train_data)} samples ({ocbc_train_data['Class'].sum()} fraud)")
print(f"   ING: {len(ing_train_data)} samples ({ing_train_data['Class'].sum()} fraud)")

print("\nGenerating evaluation datasets...")

# Reset random seed for evaluation datasets
np.random.seed(None)

# Generate evaluation datasets with the same specialized patterns
dbs_eval_data = generate_fraud_data("DBS", num_samples=50000, fraud_ratio=0.5)
ocbc_eval_data = generate_fraud_data("OCBC", num_samples=50000, fraud_ratio=0.5)
ing_eval_data = generate_fraud_data("ING", num_samples=50000, fraud_ratio=0.5)

# Generate a combined dataset with all three fraud patterns
# Taking 20,000 samples from each bank's evaluation data
combined_eval_data = pd.concat([
    dbs_eval_data.sample(20000),
    ocbc_eval_data.sample(20000),
    ing_eval_data.sample(20000)
])

# Save evaluation datasets
dbs_eval_data.to_csv(f"{eval_dir}\\dbs_fraud_data.csv", index=False)
ocbc_eval_data.to_csv(f"{eval_dir}\\ocbc_fraud_data.csv", index=False)
ing_eval_data.to_csv(f"{eval_dir}\\ing_fraud_data.csv", index=False)
combined_eval_data.to_csv(f"{eval_dir}\\combined_fraud_data.csv", index=False)

print(f"✅ Evaluation datasets generated with 50/50 class balance:")
print(f"   DBS: {len(dbs_eval_data)} samples ({dbs_eval_data['Class'].sum()} fraud)")
print(f"   OCBC: {len(ocbc_eval_data)} samples ({ocbc_eval_data['Class'].sum()} fraud)")
print(f"   ING: {len(ing_eval_data)} samples ({ing_eval_data['Class'].sum()} fraud)")
print(f"   Combined: {len(combined_eval_data)} samples ({combined_eval_data['Class'].sum()} fraud)")

print("\n📊 Dataset generation complete!")