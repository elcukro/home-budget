"""
Migration: Add webhook idempotency table

Creates the processed_webhook_events table for tracking processed webhook events
to prevent duplicate processing.

Run with: python -m migrations.add_webhook_idempotency_table
"""
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/homebudget")

engine = create_engine(DATABASE_URL)


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()


def upgrade():
    """Create webhook idempotency table."""
    with engine.connect() as conn:
        # Create processed_webhook_events table
        if not table_exists("processed_webhook_events"):
            conn.execute(text("""
                CREATE TABLE processed_webhook_events (
                    id SERIAL PRIMARY KEY,
                    event_id VARCHAR NOT NULL,
                    provider VARCHAR NOT NULL DEFAULT 'stripe',
                    event_type VARCHAR,
                    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

                    -- Unique constraint on event_id + provider
                    CONSTRAINT uq_webhook_event_provider UNIQUE (event_id, provider)
                )
            """))
            print("Created processed_webhook_events table")

            # Create indexes
            conn.execute(text("""
                CREATE INDEX idx_processed_webhooks_event_id
                ON processed_webhook_events(event_id)
            """))
            print("Created index idx_processed_webhooks_event_id")

            conn.execute(text("""
                CREATE INDEX idx_processed_webhooks_processed_at
                ON processed_webhook_events(processed_at)
            """))
            print("Created index idx_processed_webhooks_processed_at")

            conn.commit()
        else:
            print("Table processed_webhook_events already exists, skipping")


def downgrade():
    """Drop webhook idempotency table."""
    with engine.connect() as conn:
        if table_exists("processed_webhook_events"):
            conn.execute(text("DROP TABLE processed_webhook_events"))
            conn.commit()
            print("Dropped processed_webhook_events table")
        else:
            print("Table processed_webhook_events does not exist, skipping")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Webhook idempotency migration")
    parser.add_argument("--downgrade", action="store_true", help="Run downgrade")
    args = parser.parse_args()

    if args.downgrade:
        downgrade()
    else:
        upgrade()
