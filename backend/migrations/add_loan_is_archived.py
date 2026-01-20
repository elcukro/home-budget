"""
Migration: Add is_archived column to loans table
Allows archiving paid-off loans to hide them from active list
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
        # Add is_archived column (default false)
        conn.execute(text('''
            ALTER TABLE loans
            ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE
        '''))

        conn.commit()
        print("Migration completed: Added is_archived column to loans table")

def downgrade():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE loans DROP COLUMN IF EXISTS is_archived'))
        conn.commit()
        print("Downgrade completed: Removed is_archived column from loans table")

if __name__ == "__main__":
    upgrade()
