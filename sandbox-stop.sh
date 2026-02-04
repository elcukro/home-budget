#!/bin/bash
# Stop Home Budget Sandbox Environment

set -e

cd "$(dirname "$0")"

echo "🛑 Stopping Home Budget Sandbox..."

docker compose -f docker-compose.sandbox.yml down

echo ""
echo "✅ Sandbox stopped."
echo "   Data is preserved. Use ./sandbox-reset.sh to delete all data."
