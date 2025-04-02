# Migration script to add account_names column to banking_connections table
import sys
import os
from pathlib import Path
from sqlalchemy import Column, JSON, text

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base

def run_migration():
    print("Running migration: add_account_names_to_banking_connections.py")
    
    # Check if the column already exists
    query = text("""
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'banking_connections' AND column_name = 'account_names';
    """)
    
    with engine.connect() as connection:
        result = connection.execute(query).fetchall()
        
        if result:
            print("Column 'account_names' already exists in 'banking_connections' table. Skipping migration.")
            return
        
        # Add the column
        try:
            query = text("""
            ALTER TABLE banking_connections
            ADD COLUMN account_names JSONB;
            """)
            
            connection.execute(query)
            connection.commit()
            
            print("Successfully added 'account_names' column to 'banking_connections' table.")
        except Exception as e:
            print(f"Error adding column: {str(e)}")
            raise

if __name__ == "__main__":
    run_migration()