"""
Migration: Add savings_goals table and goal_id to savings table
Run: cd backend && source venv/bin/activate && python migrations/add_savings_goals.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.database import SQLALCHEMY_DATABASE_URL

def run_migration():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

    with engine.connect() as conn:
        # 1. Create savings_goals table
        print("Creating savings_goals table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS savings_goals (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR NOT NULL,
                category VARCHAR NOT NULL,
                target_amount FLOAT NOT NULL,
                current_amount FLOAT DEFAULT 0,
                deadline DATE,
                icon VARCHAR,
                color VARCHAR,
                status VARCHAR DEFAULT 'active',
                priority INTEGER DEFAULT 0,
                notes VARCHAR,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ
            )
        """))

        # 2. Create indexes for savings_goals
        print("Creating indexes for savings_goals...")
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_savings_goals_category ON savings_goals(category)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_savings_goals_status ON savings_goals(status)
        """))

        # 3. Add goal_id column to savings table
        print("Adding goal_id column to savings table...")
        conn.execute(text("""
            ALTER TABLE savings
            ADD COLUMN IF NOT EXISTS goal_id INTEGER REFERENCES savings_goals(id) ON DELETE SET NULL
        """))

        # 4. Create index for goal_id
        print("Creating index for goal_id...")
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_savings_goal_id ON savings(goal_id)
        """))

        conn.commit()
        print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
