"""
Migration script to add Tink integration tables:
- tink_connections: OAuth tokens and connection info
- bank_transactions: Raw transactions from Tink
- Updates to income/expenses: add source and bank_transaction_id columns
"""

import os
import sys
from sqlalchemy import (
    create_engine, MetaData, Table, Column, String, Integer, Float,
    ForeignKey, DateTime, Boolean, Date, Index, func
)
from sqlalchemy.dialects.postgresql import JSONB
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection string
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "homebudget")

print(f"Connecting to database at {POSTGRES_HOST}:{POSTGRES_PORT} with user {POSTGRES_USER}")
DB_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"


def run_migration():
    from sqlalchemy import inspect, text

    engine = create_engine(DB_URL)
    metadata = MetaData()

    with engine.connect() as conn:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        # 1. Create tink_connections table
        if 'tink_connections' not in existing_tables:
            print("Creating tink_connections table...")
            conn.execute(text('''
                CREATE TABLE tink_connections (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                    tink_user_id VARCHAR UNIQUE NOT NULL,
                    access_token VARCHAR NOT NULL,
                    refresh_token VARCHAR NOT NULL,
                    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    authorization_code VARCHAR,
                    scopes VARCHAR DEFAULT 'accounts:read,transactions:read',
                    accounts JSONB,
                    account_details JSONB,
                    is_active BOOLEAN DEFAULT TRUE,
                    last_sync_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                );

                CREATE INDEX idx_tink_connections_user_id ON tink_connections(user_id);
                CREATE INDEX idx_tink_connections_tink_user_id ON tink_connections(tink_user_id);
            '''))
            conn.commit()
            print("tink_connections table created successfully!")
        else:
            print("Table tink_connections already exists.")

        # 2. Create bank_transactions table
        if 'bank_transactions' not in existing_tables:
            print("Creating bank_transactions table...")
            conn.execute(text('''
                CREATE TABLE bank_transactions (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                    tink_transaction_id VARCHAR UNIQUE NOT NULL,
                    tink_account_id VARCHAR NOT NULL,
                    provider_transaction_id VARCHAR,
                    amount FLOAT NOT NULL,
                    currency VARCHAR NOT NULL DEFAULT 'PLN',
                    date DATE NOT NULL,
                    booked_datetime TIMESTAMP WITH TIME ZONE,
                    description_display VARCHAR NOT NULL,
                    description_original VARCHAR,
                    description_detailed VARCHAR,
                    merchant_name VARCHAR,
                    merchant_category_code VARCHAR,
                    tink_category_id VARCHAR,
                    tink_category_name VARCHAR,
                    suggested_type VARCHAR,
                    suggested_category VARCHAR,
                    confidence_score FLOAT DEFAULT 0.0,
                    status VARCHAR NOT NULL DEFAULT 'pending',
                    linked_income_id INTEGER REFERENCES income(id),
                    linked_expense_id INTEGER REFERENCES expenses(id),
                    raw_data JSONB,
                    is_duplicate BOOLEAN DEFAULT FALSE,
                    duplicate_of INTEGER REFERENCES bank_transactions(id),
                    reviewed_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                );

                CREATE INDEX idx_bank_transactions_user_id ON bank_transactions(user_id);
                CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);
                CREATE INDEX idx_bank_transactions_date ON bank_transactions(date);
                CREATE INDEX idx_bank_transactions_tink_id ON bank_transactions(tink_transaction_id);
            '''))
            conn.commit()
            print("bank_transactions table created successfully!")
        else:
            print("Table bank_transactions already exists.")

        # 3. Add source and bank_transaction_id columns to income table
        income_columns = [col['name'] for col in inspector.get_columns('income')]

        if 'source' not in income_columns:
            print("Adding source column to income table...")
            conn.execute(text("ALTER TABLE income ADD COLUMN source VARCHAR DEFAULT 'manual';"))
            conn.commit()
            print("source column added to income table!")
        else:
            print("Column source already exists in income table.")

        if 'bank_transaction_id' not in income_columns:
            print("Adding bank_transaction_id column to income table...")
            conn.execute(text('''
                ALTER TABLE income ADD COLUMN bank_transaction_id INTEGER REFERENCES bank_transactions(id);
            '''))
            conn.commit()
            print("bank_transaction_id column added to income table!")
        else:
            print("Column bank_transaction_id already exists in income table.")

        # 4. Add source and bank_transaction_id columns to expenses table
        expenses_columns = [col['name'] for col in inspector.get_columns('expenses')]

        if 'source' not in expenses_columns:
            print("Adding source column to expenses table...")
            conn.execute(text("ALTER TABLE expenses ADD COLUMN source VARCHAR DEFAULT 'manual';"))
            conn.commit()
            print("source column added to expenses table!")
        else:
            print("Column source already exists in expenses table.")

        if 'bank_transaction_id' not in expenses_columns:
            print("Adding bank_transaction_id column to expenses table...")
            conn.execute(text('''
                ALTER TABLE expenses ADD COLUMN bank_transaction_id INTEGER REFERENCES bank_transactions(id);
            '''))
            conn.commit()
            print("bank_transaction_id column added to expenses table!")
        else:
            print("Column bank_transaction_id already exists in expenses table.")


if __name__ == "__main__":
    try:
        run_migration()
        print("\nMigration completed successfully!")
    except Exception as e:
        import traceback
        print(f"Error running migration: {str(e)}")
        traceback.print_exc()
        sys.exit(1)
