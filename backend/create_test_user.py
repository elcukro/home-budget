from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from app.models import Base, User
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

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def create_test_user():
    """Create a test user if it doesn't exist."""
    try:
        # Check if test user exists
        test_user = db.query(User).filter(User.email == "test@example.com").first()
        
        if not test_user:
            print("Creating test user...")
            test_user = User(
                id="test@example.com",
                email="test@example.com",
                name="Test User",
                created_at=datetime.now()
            )
            db.add(test_user)
            db.commit()
            print("Test user created successfully!")
        else:
            print("Test user already exists!")
            
        return test_user
    except Exception as e:
        print(f"Error creating test user: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user() 