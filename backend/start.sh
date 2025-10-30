#!/bin/bash
set -euo pipefail

# Ensure the script runs relative to the backend directory.
cd "$(dirname "$0")"

# Load environment variables from .env if present.
if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

# Activate local virtual environment (prefers ./env, falls back to ./venv).
if [[ -d "env" && -f "env/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "env/bin/activate"
elif [[ -d "venv" && -f "venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "venv/bin/activate"
else
  echo "Python virtual environment not found. Create backend/env or backend/venv before running this script."
  exit 1
fi

# Ensure required PostgreSQL variables are present.
: "${POSTGRES_HOST:?POSTGRES_HOST not set}"
: "${POSTGRES_PORT:?POSTGRES_PORT not set}"
: "${POSTGRES_USER:?POSTGRES_USER not set}"

# Confirm pg_isready exists.
if ! command -v pg_isready >/dev/null 2>&1; then
  echo "pg_isready is not available on PATH. Install PostgreSQL client tools to continue."
  exit 1
fi

# Wait for PostgreSQL to be ready.
echo "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" >/dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready!"

# Migration scripts are disabled for manual execution during local development.
# echo "Running migrations..."
# python migrations/add_financial_freedom_table.py || {
#   echo "Migration failed, trying alternative approach..."
#   python create_financial_freedom_table.py
# }

# Check database schema
echo "Checking database schema..."
python check_schema.py

# Create test user
echo "Creating test user..."
python create_test_user.py

# Start the application
echo "Starting the application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
