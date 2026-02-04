"""
Migration: Add trial email tracking columns to users table

These columns track when trial-related emails were sent to prevent duplicate emails:
- trial_ending_email_sent_at: When the "trial ending soon" reminder was sent
- trial_ended_email_sent_at: When the "trial ended" notification was sent
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL


def migrate():
    """Add trial email tracking columns to users table."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # Check and add trial_ending_email_sent_at column
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name = 'trial_ending_email_sent_at'
        """))

        if result.fetchone():
            print("Column 'trial_ending_email_sent_at' already exists in 'users' table")
        else:
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN trial_ending_email_sent_at TIMESTAMP WITH TIME ZONE
            """))
            print("Successfully added 'trial_ending_email_sent_at' column to 'users' table")

        # Check and add trial_ended_email_sent_at column
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name = 'trial_ended_email_sent_at'
        """))

        if result.fetchone():
            print("Column 'trial_ended_email_sent_at' already exists in 'users' table")
        else:
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN trial_ended_email_sent_at TIMESTAMP WITH TIME ZONE
            """))
            print("Successfully added 'trial_ended_email_sent_at' column to 'users' table")

        conn.commit()
        print("Migration completed successfully")


def rollback():
    """Remove trial email tracking columns from users table."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS trial_ending_email_sent_at
        """))
        print("Removed 'trial_ending_email_sent_at' column from 'users' table")

        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS trial_ended_email_sent_at
        """))
        print("Removed 'trial_ended_email_sent_at' column from 'users' table")

        conn.commit()
        print("Rollback completed successfully")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    args = parser.parse_args()

    if args.rollback:
        rollback()
    else:
        migrate()
