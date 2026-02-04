#!/bin/bash
# View Home Budget Sandbox Logs

cd "$(dirname "$0")"

SERVICE="${1:-}"

if [[ -z "$SERVICE" ]]; then
    echo "📋 Viewing all logs (Ctrl+C to exit)..."
    docker compose -f docker-compose.sandbox.yml logs -f
else
    echo "📋 Viewing $SERVICE logs (Ctrl+C to exit)..."
    docker compose -f docker-compose.sandbox.yml logs -f "$SERVICE"
fi
