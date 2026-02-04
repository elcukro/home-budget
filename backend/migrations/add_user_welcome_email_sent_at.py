"""
Migration: Add welcome_email_sent_at column to users table

This column tracks when the welcome email was sent to prevent duplicate emails.
"""

import os
import sys
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL


def migrate():
    """Add welcome_email_sent_at column to users table."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name = 'welcome_email_sent_at'
        """))

        if result.fetchone():
            print("Column 'welcome_email_sent_at' already exists in 'users' table")
            return

        # Add the column
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN welcome_email_sent_at TIMESTAMP WITH TIME ZONE
        """))
        conn.commit()

        print("Successfully added 'welcome_email_sent_at' column to 'users' table")


def rollback():
    """Remove welcome_email_sent_at column from users table."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS welcome_email_sent_at
        """))
        conn.commit()

        print("Successfully removed 'welcome_email_sent_at' column from 'users' table")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    args = parser.parse_args()

    if args.rollback:
        rollback()
    else:
        migrate()
