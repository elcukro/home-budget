from sqlalchemy import create_engine, text
import os

# Get database URL from environment or use a default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/homebudget")

def run_migration():
    print(f"Using database URL: {DATABASE_URL}")
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # SQL to add new columns
    sql = """
    -- Add new columns to insights_cache table if they don't exist
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='insights_cache' AND column_name='last_refresh_date') THEN
            ALTER TABLE insights_cache 
            ADD COLUMN last_refresh_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='insights_cache' AND column_name='total_income') THEN
            ALTER TABLE insights_cache 
            ADD COLUMN total_income FLOAT DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='insights_cache' AND column_name='total_expenses') THEN
            ALTER TABLE insights_cache 
            ADD COLUMN total_expenses FLOAT DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='insights_cache' AND column_name='total_loans') THEN
            ALTER TABLE insights_cache 
            ADD COLUMN total_loans FLOAT DEFAULT 0;
        END IF;
    END
    $$;
    
    -- Update existing records
    UPDATE insights_cache 
    SET last_refresh_date = created_at,
        total_income = 0,
        total_expenses = 0,
        total_loans = 0
    WHERE last_refresh_date IS NULL;
    """
    
    # Execute the SQL
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration() 