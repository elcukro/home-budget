from sqlalchemy import create_engine, Column, Integer, String, Float, Date, ForeignKey, DateTime, Boolean, MetaData, Table, inspect, text
from sqlalchemy.sql import func
import os
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection parameters from environment variables
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")
DB_HOST = os.environ.get("POSTGRES_HOST", "localhost")
DB_PORT = os.environ.get("POSTGRES_PORT", "5432")
DB_NAME = os.environ.get("POSTGRES_DB", "homebudget")

# Create SQLAlchemy engine
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

# Create MetaData instance
metadata = MetaData()

# Check if the table already exists
inspector = inspect(engine)
table_exists = "savings" in inspector.get_table_names()

if table_exists:
    logger.info("Table savings already exists, skipping creation")
else:
    # Define the savings table
    savings = Table(
        "savings",
        metadata,
        Column("id", Integer, primary_key=True, index=True),
        Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE")),
        Column("category", String, nullable=False),
        Column("description", String, nullable=False),
        Column("amount", Float, nullable=False),
        Column("date", Date, nullable=False),
        Column("is_recurring", Boolean, default=False),
        Column("target_amount", Float, nullable=True),
        Column("saving_type", String, nullable=False),
        Column("created_at", DateTime(timezone=True), server_default=func.now()),
        Column("updated_at", DateTime(timezone=True), onupdate=func.now())
    )

def verify_table():
    """Verify the savings table structure and indexes."""
    inspector = inspect(engine)
    
    # Check if table exists
    if "savings" not in inspector.get_table_names():
        logger.error("Table 'savings' does not exist!")
        return False
    
    # Check columns
    columns = {col['name']: col for col in inspector.get_columns('savings')}
    logger.info("Table columns:")
    for col_name, col in columns.items():
        logger.info(f"  - {col_name}: {col['type']} (nullable: {col['nullable']})")
    
    # Check foreign keys
    foreign_keys = inspector.get_foreign_keys('savings')
    logger.info("\nForeign keys:")
    for fk in foreign_keys:
        logger.info(f"  - {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
    
    # Check indexes
    indexes = inspector.get_indexes('savings')
    logger.info("\nIndexes:")
    for index in indexes:
        logger.info(f"  - {index['name']}: {index['column_names']} (unique: {index['unique']})")
    
    # Check constraints
    constraints = inspector.get_unique_constraints('savings')
    logger.info("\nConstraints:")
    for constraint in constraints:
        logger.info(f"  - {constraint['name']}: {constraint['column_names']}")
    
    return True

def upgrade():
    """Create the savings table and add indexes."""
    if table_exists:
        logger.info("Skipping table creation as it already exists")
        return
    
    # Create the savings table
    savings.create(engine)
    logger.info("Created savings table")
    
    # Add indexes
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE INDEX idx_savings_user_id ON savings(user_id);
            CREATE INDEX idx_savings_category ON savings(category);
            CREATE INDEX idx_savings_date ON savings(date);
        """))
        conn.commit()
    logger.info("Added indexes to savings table")
    
    # Verify the table
    if verify_table():
        logger.info("Table verification successful!")
    else:
        logger.error("Table verification failed!")

def downgrade():
    """Drop the savings table."""
    if not table_exists:
        logger.info("Table does not exist, skipping downgrade")
        return
    
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS savings CASCADE"))
        conn.commit()
    logger.info("Dropped savings table")

if __name__ == "__main__":
    upgrade() 