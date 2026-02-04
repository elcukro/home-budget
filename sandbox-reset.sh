#!/bin/bash
# Reset Home Budget Sandbox - deletes all data!

set -e

cd "$(dirname "$0")"

echo "⚠️  This will DELETE all sandbox data (database, volumes)!"
echo ""
read -p "Are you sure? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🗑️  Stopping and removing containers..."
docker compose -f docker-compose.sandbox.yml down -v --remove-orphans

echo ""
echo "🧹 Removing any dangling images..."
docker image prune -f --filter "label=com.docker.compose.project=home-budget" 2>/dev/null || true

echo ""
echo "✅ Sandbox reset complete!"
echo "   Run ./sandbox-start.sh to start fresh."
