#!/bin/bash
# Start Home Budget Sandbox Environment
# Mirrors production environment for safe local development

set -e

cd "$(dirname "$0")"

echo "🚀 Starting Home Budget Sandbox..."
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please start OrbStack first:"
    echo "   open -a OrbStack"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon not running. Please start OrbStack:"
    echo "   open -a OrbStack"
    exit 1
fi

# Build and start containers
echo "📦 Building containers (first time may take a few minutes)..."
docker compose -f docker-compose.sandbox.yml up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check health
echo ""
echo "🔍 Checking service status..."
docker compose -f docker-compose.sandbox.yml ps

echo ""
echo "✅ Sandbox is ready!"
echo ""
echo "   Frontend: http://localhost:3100"
echo "   Backend:  http://localhost:8100"
echo "   Database: localhost:5433 (user: sandbox, pass: sandbox_dev_only)"
echo ""
echo "📋 Useful commands:"
echo "   View logs:     docker compose -f docker-compose.sandbox.yml logs -f"
echo "   Stop:          ./sandbox-stop.sh"
echo "   Reset (clean): ./sandbox-reset.sh"
