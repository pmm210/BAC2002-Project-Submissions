# update_user_schema.py

from datetime import datetime
from pymongo import MongoClient
from bson.objectid import ObjectId

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017')
db = client['lending_platform']  # Replace with your actual database name
users_collection = db['users']

def update_user_schemas():
    """Update all users to ensure they have required fields"""
    users = list(users_collection.find())
    updated_count = 0
    
    for user in users:
        updates = {}
        
        # Check required fields and add them if missing
        if 'name' not in user or not user['name']:
            updates['name'] = user.get('email', '').split('@')[0] or 'User'
            
        if 'email' not in user:
            updates['email'] = 'no-email@example.com'
            
        if 'role' not in user:
            updates['role'] = 'user'
            
        if 'is_active' not in user:
            updates['is_active'] = True
            
        if 'created_at' not in user:
            updates['created_at'] = datetime.now()
            
        if 'activity_level' not in user:
            updates['activity_level'] = 'low'
        
        # If we have updates, apply them
        if updates:
            users_collection.update_one({'_id': user['_id']}, {'$set': updates})
            updated_count += 1
    
    print(f"Updated {updated_count} users with schema changes")

    # One-time update to add transactions array to users
    result = users_collection.update_many(
        {'transactions': {'$exists': False}},
        {'$set': {'transactions': []}}
    )
    print(f"Updated {result.modified_count} users")

if __name__ == "__main__":
    update_user_schemas()