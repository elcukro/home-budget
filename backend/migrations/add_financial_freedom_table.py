from sqlalchemy import create_engine, Column, Integer, String, Float, Date, ForeignKey, DateTime, Boolean, JSON, MetaData, Table, inspect, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
import os
from datetime import datetime

# Database connection parameters from environment variables
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")
DB_HOST = os.environ.get("POSTGRES_HOST", "localhost")
DB_PORT = os.environ.get("POSTGRES_PORT", "5432")
DB_NAME = os.environ.get("POSTGRES_DB", "homebudget")

# Create SQLAlchemy engine
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

# Create MetaData instance
metadata = MetaData()

# Check if the table already exists
inspector = inspect(engine)
table_exists = "financial_freedom" in inspector.get_table_names()

if table_exists:
    print("Table financial_freedom already exists, skipping creation")
else:
    # Define the financial_freedom table
    financial_freedom = Table(
        "financial_freedom",
        metadata,
        Column("id", Integer, primary_key=True, index=True),
        Column("user_id", String),  # Database column name
        Column("steps", JSONB),
        Column("start_date", DateTime(timezone=True), server_default=func.now()),  # Database column name
        Column("last_updated", DateTime(timezone=True), server_default=func.now(), onupdate=func.now()),  # Database column name
    )

def upgrade():
    # Skip if table already exists
    if table_exists:
        return
    
    # Create the financial_freedom table
    financial_freedom.create(engine)
    print("Created financial_freedom table")
    
    # Add foreign key constraint and indexes
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE financial_freedom 
            ADD CONSTRAINT fk_financial_freedom_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            
            CREATE INDEX idx_financial_freedom_user_id ON financial_freedom(user_id);
            CREATE INDEX idx_financial_freedom_steps ON financial_freedom USING gin(steps);
        """))
        conn.commit()
    print("Added foreign key constraint and indexes to financial_freedom table")

def downgrade():
    # Skip if table doesn't exist
    if not table_exists:
        return
    
    # Drop the financial_freedom table
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS financial_freedom CASCADE"))
        conn.commit()
    print("Dropped financial_freedom table")

if __name__ == "__main__":
    upgrade() 