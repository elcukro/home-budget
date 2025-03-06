from sqlalchemy import create_engine, inspect, text
import os
from datetime import datetime

# Database connection parameters from environment variables
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")
DB_HOST = os.environ.get("POSTGRES_HOST", "localhost")
DB_PORT = os.environ.get("POSTGRES_PORT", "5432")
DB_NAME = os.environ.get("POSTGRES_DB", "homebudget")

# Create SQLAlchemy engine
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

# Create inspector
inspector = inspect(engine)

def check_table(table_name):
    print(f"\nChecking table: {table_name}")
    
    # Get columns
    columns = inspector.get_columns(table_name)
    print("\nColumns:")
    for column in columns:
        print(f"  - {column['name']}: {column['type']} (nullable: {column['nullable']})")
    
    # Get primary key
    pk = inspector.get_pk_constraint(table_name)
    print("\nPrimary Key:", pk['constrained_columns'])
    
    # Get foreign keys
    fks = inspector.get_foreign_keys(table_name)
    print("\nForeign Keys:")
    for fk in fks:
        print(f"  - {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
    
    # Get indexes
    indexes = inspector.get_indexes(table_name)
    print("\nIndexes:")
    for index in indexes:
        print(f"  - {index['name']}: {index['column_names']} (unique: {index['unique']})")

# Check if tables exist
tables = inspector.get_table_names()
print("Tables in database:", tables)

# Check specific tables
tables_to_check = ['users', 'financial_freedom']
for table in tables_to_check:
    if table in tables:
        check_table(table)
    else:
        print(f"\nTable {table} does not exist!")

# Check if we can connect to the database
with engine.connect() as conn:
    result = conn.execute(text("SELECT version()")).scalar()
    print("\nPostgreSQL version:", result)
    
    # Check if we have any data in the financial_freedom table
    result = conn.execute(text("SELECT COUNT(*) FROM financial_freedom")).scalar()
    print("\nNumber of records in financial_freedom table:", result) 