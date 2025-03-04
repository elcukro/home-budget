from app.database import engine, SessionLocal
from app import models
from sqlalchemy import text

def init_db():
    # Create all tables
    models.Base.metadata.create_all(bind=engine)
    
    # Create a test user if it doesn't exist
    db = SessionLocal()
    try:
        # Check if test user exists
        result = db.execute(text("SELECT * FROM users WHERE id = 'test@example.com'"))
        if not result.first():
            # Create test user
            test_user = models.User(
                id='test@example.com',
                email='test@example.com',
                name='Test User'
            )
            db.add(test_user)
            db.commit()
            print("Created test user")
        else:
            print("Test user already exists")
    finally:
        db.close()

if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("Database initialization complete") 