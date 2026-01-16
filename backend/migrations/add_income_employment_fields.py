"""
Migration: Add employment_type, gross_amount, and is_gross columns to income table
For Polish tax calculation support (brutto/netto)
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
        # Add employment_type column (Polish employment types: uop, b2b, zlecenie, dzielo, other)
        conn.execute(text('''
            ALTER TABLE income
            ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50)
        '''))

        # Add gross_amount column (brutto - before tax)
        conn.execute(text('''
            ALTER TABLE income
            ADD COLUMN IF NOT EXISTS gross_amount FLOAT
        '''))

        # Add is_gross column (whether entered amount was gross or net)
        conn.execute(text('''
            ALTER TABLE income
            ADD COLUMN IF NOT EXISTS is_gross BOOLEAN DEFAULT FALSE
        '''))

        conn.commit()
        print("Migration completed: Added employment and tax fields to income table")

def downgrade():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE income DROP COLUMN IF EXISTS employment_type'))
        conn.execute(text('ALTER TABLE income DROP COLUMN IF EXISTS gross_amount'))
        conn.execute(text('ALTER TABLE income DROP COLUMN IF EXISTS is_gross'))
        conn.commit()
        print("Downgrade completed: Removed employment and tax fields from income table")

if __name__ == "__main__":
    upgrade()
