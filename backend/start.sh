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
    POSTGRES_BIN=${POSTGRES_BIN:-/opt/homebrew/opt/postgresql@14/bin/postgres}
    POSTGRES_DATA_DIR=${POSTGRES_DATA_DIR:-/opt/homebrew/var/postgresql@14}
    POSTGRES_LOG_FILE=${POSTGRES_LOG_FILE:-/tmp/home-budget-postgres.log}

    if [[ ! -x "${POSTGRES_BIN}" ]]; then
      echo "PostgreSQL binary not found at ${POSTGRES_BIN}. Install PostgreSQL or update POSTGRES_BIN."
      exit 1
    fi
    if [[ ! -d "${POSTGRES_DATA_DIR}" ]]; then
      echo "PostgreSQL data directory ${POSTGRES_DATA_DIR} does not exist. Initialize it or update POSTGRES_DATA_DIR."
      exit 1
    fi

    echo "PostgreSQL not running; starting with ${POSTGRES_BIN} -D ${POSTGRES_DATA_DIR}"
    "${POSTGRES_BIN}" -D "${POSTGRES_DATA_DIR}" >>"${POSTGRES_LOG_FILE}" 2>&1 &
    POSTGRES_PID=$!

    until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" >/dev/null 2>&1; do
      if ! kill -0 "${POSTGRES_PID}" >/dev/null 2>&1; then
        echo "PostgreSQL failed to start. See ${POSTGRES_LOG_FILE} for details."
        exit 1
      fi
      sleep 1
    done
    echo "PostgreSQL started (PID ${POSTGRES_PID}). Logs: ${POSTGRES_LOG_FILE}"
  else
    until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" >/dev/null 2>&1; do
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
