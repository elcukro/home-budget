"""
Migration script to add banking_connections table
"""

import os
import sys
from sqlalchemy import create_engine, MetaData, Table, Column, String, Integer, ForeignKey, DateTime, Boolean, func
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection string - Use the Docker container name for host when running in Docker
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")  # 'postgres' is the service name in docker-compose
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "homebudget")

print(f"Connecting to database at {POSTGRES_HOST}:{POSTGRES_PORT} with user {POSTGRES_USER}")
DB_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

def run_migration():
    # Create engine and connect to the database
    engine = create_engine(DB_URL)
    
    # Create a metadata object
    metadata = MetaData()
    
    # Define the new table
    banking_connections = Table(
        'banking_connections',
        metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('user_id', String, ForeignKey("users.id", ondelete="CASCADE")),
        Column('institution_id', String, nullable=False),
        Column('institution_name', String, nullable=False),
        Column('requisition_id', String, nullable=False, unique=True),
        Column('created_at', DateTime(timezone=True), server_default=func.now()),
        Column('expires_at', DateTime(timezone=True), nullable=False),
        Column('is_active', Boolean, default=True),
        Column('accounts', String),  # JSON string of account IDs
    )
    
    # Update the Settings table to add banking field
    settings = Table(
        'settings',
        metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('banking', String),  # JSON string for banking settings
        autoload_with=engine
    )
    
    # Create the connection
    with engine.connect() as conn:
        # Check if the table already exists
        inspector = inspect(engine)
        if 'banking_connections' not in inspector.get_table_names():
            print("Creating banking_connections table...")
            banking_connections.create(engine)
            print("Table created successfully!")
        else:
            print("Table banking_connections already exists.")
        
        # Add banking column to settings if it doesn't exist
        if 'banking' not in [col['name'] for col in inspector.get_columns('settings')]:
            print("Adding banking column to settings table...")
            conn.execute(
                text('ALTER TABLE settings ADD COLUMN banking JSONB;')
            )
            conn.commit()
            print("Column added successfully!")
        else:
            print("Column banking already exists in settings table.")

if __name__ == "__main__":
    try:
        # Import these at the top level to avoid circular imports
        from sqlalchemy import inspect, text
        run_migration()
        print("Migration completed successfully!")
    except Exception as e:
        import traceback
        print(f"Error running migration: {str(e)}")
        traceback.print_exc()
        sys.exit(1)