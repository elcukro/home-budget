"""
Migration: Add gamification tables

Creates the following tables:
- user_gamification_stats: Tracks user streaks, XP, level
- achievements: Stores unlocked badges
- streak_history: Historical daily activity records
- gamification_events: Event log for analytics

Run with: python -m migrations.add_gamification_tables
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
    """Create gamification tables."""
    with engine.connect() as conn:
        # Create user_gamification_stats table
        if not table_exists("user_gamification_stats"):
            conn.execute(text("""
                CREATE TABLE user_gamification_stats (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE UNIQUE,

                    -- Streak tracking
                    current_streak INTEGER DEFAULT 0,
                    longest_streak INTEGER DEFAULT 0,
                    last_activity_date DATE,

                    -- XP and Level
                    total_xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 1,

                    -- Activity counts
                    total_expenses_logged INTEGER DEFAULT 0,
                    total_savings_deposits INTEGER DEFAULT 0,
                    total_loan_payments INTEGER DEFAULT 0,
                    total_checkins INTEGER DEFAULT 0,

                    -- Financial milestones
                    total_debt_paid FLOAT DEFAULT 0,
                    months_with_savings INTEGER DEFAULT 0,

                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))
            conn.execute(text("""
                CREATE INDEX idx_user_gamification_stats_user_id
                ON user_gamification_stats(user_id)
            """))
            print("Created table: user_gamification_stats")

        # Create achievements table
        if not table_exists("achievements"):
            conn.execute(text("""
                CREATE TABLE achievements (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,

                    badge_id VARCHAR NOT NULL,
                    badge_category VARCHAR NOT NULL,

                    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    xp_awarded INTEGER DEFAULT 0,
                    unlock_data JSONB,

                    CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id)
                )
            """))
            conn.execute(text("""
                CREATE INDEX idx_achievements_user_id ON achievements(user_id)
            """))
            conn.execute(text("""
                CREATE INDEX idx_achievements_badge_id ON achievements(badge_id)
            """))
            conn.execute(text("""
                CREATE INDEX idx_achievements_unlocked_at ON achievements(unlocked_at)
            """))
            print("Created table: achievements")

        # Create streak_history table
        if not table_exists("streak_history"):
            conn.execute(text("""
                CREATE TABLE streak_history (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,

                    date DATE NOT NULL,
                    streak_type VARCHAR NOT NULL,

                    activity_count INTEGER DEFAULT 1,
                    streak_count INTEGER DEFAULT 1,

                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

                    CONSTRAINT unique_user_date_streak UNIQUE (user_id, date, streak_type)
                )
            """))
            conn.execute(text("""
                CREATE INDEX idx_streak_history_user_id ON streak_history(user_id)
            """))
            conn.execute(text("""
                CREATE INDEX idx_streak_history_date ON streak_history(date)
            """))
            conn.execute(text("""
                CREATE INDEX idx_streak_history_type ON streak_history(streak_type)
            """))
            print("Created table: streak_history")

        # Create gamification_events table
        if not table_exists("gamification_events"):
            conn.execute(text("""
                CREATE TABLE gamification_events (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,

                    event_type VARCHAR NOT NULL,
                    event_data JSONB,

                    xp_change INTEGER DEFAULT 0,

                    trigger_entity VARCHAR,
                    trigger_entity_id INTEGER,

                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE INDEX idx_gamification_events_user_id ON gamification_events(user_id)
            """))
            conn.execute(text("""
                CREATE INDEX idx_gamification_events_type ON gamification_events(event_type)
            """))
            conn.execute(text("""
                CREATE INDEX idx_gamification_events_created_at ON gamification_events(created_at)
            """))
            print("Created table: gamification_events")

        conn.commit()
        print("Migration completed successfully!")


def downgrade():
    """Drop gamification tables."""
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS gamification_events CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS streak_history CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS achievements CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS user_gamification_stats CASCADE"))
        conn.commit()
        print("Downgrade completed - gamification tables dropped.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Gamification tables migration")
    parser.add_argument("--downgrade", action="store_true", help="Rollback the migration")
    args = parser.parse_args()

    if args.downgrade:
        downgrade()
    else:
        upgrade()
