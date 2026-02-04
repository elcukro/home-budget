"""
Migration: Add email tracking columns to users table

Adds columns for tracking when transactional emails were sent:
- welcome_email_sent_at: When welcome email was sent
- trial_ending_email_sent_at: When trial ending reminder was sent
- trial_ended_email_sent_at: When trial ended notification was sent

These columns prevent duplicate emails from being sent.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL


# Columns to add
EMAIL_TRACKING_COLUMNS = [
    "welcome_email_sent_at",
    "trial_ending_email_sent_at",
    "trial_ended_email_sent_at",
]


def migrate():
    """Add email tracking columns to users table."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        for column_name in EMAIL_TRACKING_COLUMNS:
            # Check if column already exists
            result = conn.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name = :column_name
            """), {"column_name": column_name})

            if result.fetchone():
                print(f"Column '{column_name}' already exists in 'users' table")
                continue

            # Add the column
            conn.execute(text(f"""
                ALTER TABLE users
                ADD COLUMN {column_name} TIMESTAMP WITH TIME ZONE
            """))
            conn.commit()

            print(f"Successfully added '{column_name}' column to 'users' table")

    print("Migration completed successfully")


def rollback():
    """Remove email tracking columns from users table."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        for column_name in EMAIL_TRACKING_COLUMNS:
            conn.execute(text(f"""
                ALTER TABLE users
                DROP COLUMN IF EXISTS {column_name}
            """))
            conn.commit()

            print(f"Successfully removed '{column_name}' column from 'users' table")

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
