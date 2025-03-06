from sqlalchemy import create_engine, inspect
import os

# Database connection parameters from environment variables
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")
DB_HOST = os.environ.get("POSTGRES_HOST", "localhost")
DB_PORT = os.environ.get("POSTGRES_PORT", "5432")
DB_NAME = os.environ.get("POSTGRES_DB", "homebudget")

# Create SQLAlchemy engine
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

# Check if the table exists
inspector = inspect(engine)
tables = inspector.get_table_names()
print("Tables in the database:", tables)

if "financial_freedom" in tables:
    print("financial_freedom table exists!")
    # Get columns in the financial_freedom table
    columns = inspector.get_columns("financial_freedom")
    print("Columns in financial_freedom table:")
    for column in columns:
        print(f"  - {column['name']} ({column['type']})")
    
    # Get foreign keys in the financial_freedom table
    foreign_keys = inspector.get_foreign_keys("financial_freedom")
    print("Foreign keys in financial_freedom table:")
    for fk in foreign_keys:
        print(f"  - {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
else:
    print("financial_freedom table does not exist!") 