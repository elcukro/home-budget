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
if pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" >/dev/null 2>&1; then
  echo "PostgreSQL is ready!"
else
if [[ "${POSTGRES_HOST}" == "localhost" || "${POSTGRES_HOST}" == "127.0.0.1" ]]; then
    # ---- SYSTEMD POSTGRES (Ubuntu) ----
    if ! systemctl is-active --quiet postgresql; then
        echo "Starting system PostgreSQL..."
        systemctl start postgresql
    fi

    until pg_isready -h localhost -p 5432 >/dev/null 2>&1; do
        echo "Waiting for PostgreSQL..."
        sleep 1
    done
    echo "PostgreSQL is ready!"
else
    # ---- REMOTE DB ----
    until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" >/dev/null 2>&1; do
        echo "Waiting for remote PostgreSQL..."
        sleep 1
    done
    echo "PostgreSQL is ready!"
fi
fi

# Ensure database schema exists.
echo "Initializing database (ensuring tables exist)..."
python init_db.py

if [[ "${RUN_SCHEMA_CHECK:-false}" == "true" ]]; then
  echo "Checking database schema..."
  python check_schema.py
fi

# Start the application
echo "Starting the application..."
UVICORN_LOG_LEVEL=${UVICORN_LOG_LEVEL:-warning}
UVICORN_ACCESS_LOG=${UVICORN_ACCESS_LOG:-false}
UVICORN_PORT=${UVICORN_PORT:-8000}

UVICORN_ARGS=(app.main:app --host 0.0.0.0 --port "${UVICORN_PORT}" --reload --log-level "${UVICORN_LOG_LEVEL}")
if [[ "${UVICORN_ACCESS_LOG}" != "true" ]]; then
  UVICORN_ARGS+=(--no-access-log)
fi

exec uvicorn "${UVICORN_ARGS[@]}"
