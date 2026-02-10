#!/bin/bash
set -e

echo "🔍 Running pre-commit checks for home-budget..."
echo ""

cd "$(dirname "$0")/frontend"

echo "📝 TypeScript type checking..."
npx tsc --noEmit
echo "✅ TypeScript OK"
echo ""

echo "🧹 ESLint checking..."
npm run lint
echo "✅ ESLint OK"
echo ""

echo "✅ All checks passed! Safe to commit."
