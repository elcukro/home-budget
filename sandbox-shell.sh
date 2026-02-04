#!/bin/bash
# Open shell in sandbox container

cd "$(dirname "$0")"

SERVICE="${1:-backend}"

case "$SERVICE" in
    backend|be|api)
        echo "🐚 Opening shell in backend container..."
        docker compose -f docker-compose.sandbox.yml exec backend /bin/sh
        ;;
    frontend|fe|web)
        echo "🐚 Opening shell in frontend container..."
        docker compose -f docker-compose.sandbox.yml exec frontend /bin/sh
        ;;
    db|database|postgres)
        echo "🐚 Opening psql in database container..."
        docker compose -f docker-compose.sandbox.yml exec db psql -U sandbox -d home_budget_sandbox
        ;;
    *)
        echo "Usage: ./sandbox-shell.sh [backend|frontend|db]"
        echo ""
        echo "  backend  - Shell in FastAPI container"
        echo "  frontend - Shell in Next.js container"
        echo "  db       - PostgreSQL psql shell"
        exit 1
        ;;
esac
