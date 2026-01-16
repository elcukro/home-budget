"""
Migration: Add account_type and annual_return_rate to savings table
For Polish III Pillar retirement accounts (IKE/IKZE/PPK/OIPE)
"""

from sqlalchemy import create_engine, text
import os

# Database configuration (matches app/database.py)
POSTGRES_USER = os.getenv("POSTGRES_USER", "homebudget")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "SuperSecret123!")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "homebudget")

DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

def upgrade():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # Add account_type column (standard, ike, ikze, ppk, oipe)
        conn.execute(text('''
            ALTER TABLE savings
            ADD COLUMN IF NOT EXISTS account_type VARCHAR DEFAULT 'standard'
        '''))

        # Add annual_return_rate column for compound interest calculations
        conn.execute(text('''
            ALTER TABLE savings
            ADD COLUMN IF NOT EXISTS annual_return_rate FLOAT
        '''))

        # Create index for account_type
        conn.execute(text('''
            CREATE INDEX IF NOT EXISTS idx_savings_account_type
            ON savings(account_type)
        '''))

        conn.commit()
        print("Migration completed: Added account_type and annual_return_rate to savings table")

def downgrade():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text('DROP INDEX IF EXISTS idx_savings_account_type'))
        conn.execute(text('ALTER TABLE savings DROP COLUMN IF EXISTS account_type'))
        conn.execute(text('ALTER TABLE savings DROP COLUMN IF EXISTS annual_return_rate'))
        conn.commit()
        print("Downgrade completed: Removed account_type and annual_return_rate from savings table")

if __name__ == "__main__":
    upgrade()
