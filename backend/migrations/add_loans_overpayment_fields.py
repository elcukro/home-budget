"""
Migration: Add overpayment_fee_percent and overpayment_fee_waived_until to loans table
For Polish prepayment regulations (since 2022, banks cannot charge fees for first 3 years)
"""

from sqlalchemy import create_engine, text
import os

# Database configuration (matches app/database.py)
POSTGRES_USER = os.getenv("POSTGRES_USER", "homebudget")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "homebudget")

if not POSTGRES_PASSWORD:
    raise ValueError("POSTGRES_PASSWORD environment variable is required")

DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

def upgrade():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # Add overpayment_fee_percent column (default 0)
        conn.execute(text('''
            ALTER TABLE loans
            ADD COLUMN IF NOT EXISTS overpayment_fee_percent FLOAT DEFAULT 0
        '''))

        # Add overpayment_fee_waived_until column
        conn.execute(text('''
            ALTER TABLE loans
            ADD COLUMN IF NOT EXISTS overpayment_fee_waived_until DATE
        '''))

        conn.commit()
        print("Migration completed: Added overpayment fields to loans table")

def downgrade():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE loans DROP COLUMN IF EXISTS overpayment_fee_percent'))
        conn.execute(text('ALTER TABLE loans DROP COLUMN IF EXISTS overpayment_fee_waived_until'))
        conn.commit()
        print("Downgrade completed: Removed overpayment fields from loans table")

if __name__ == "__main__":
    upgrade()
