import psycopg2
import os
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Database connection parameters from environment variables
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")
DB_HOST = os.environ.get("POSTGRES_HOST", "localhost")
DB_PORT = os.environ.get("POSTGRES_PORT", "5432")
DB_NAME = os.environ.get("POSTGRES_DB", "homebudget")

# Connect to the database
conn = psycopg2.connect(
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT
)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cursor = conn.cursor()

# Check if the table already exists
cursor.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_freedom')")
table_exists = cursor.fetchone()[0]

if table_exists:
    print("Table financial_freedom already exists, skipping creation")
else:
    # Create the financial_freedom table
    cursor.execute("""
    CREATE TABLE financial_freedom (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        steps JSONB,
        start_date TIMESTAMP DEFAULT NOW(),
        last_updated TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_financial_freedom_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    print("Created financial_freedom table")

# Close the connection
cursor.close()
conn.close() 