#!/bin/bash
set -e
pg_ctl -D ~/postgres_data start

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
while ! pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER; do
  sleep 1
done
echo "PostgreSQL is ready!"

# Run migrations
echo "Running migrations..."
python migrations/add_financial_freedom_table.py || {
  echo "Migration failed, trying alternative approach..."
  python create_financial_freedom_table.py
}

# Check database schema
echo "Checking database schema..."
python check_schema.py

# Create test user
echo "Creating test user..."
python create_test_user.py

# Start the application
echo "Starting the application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 
