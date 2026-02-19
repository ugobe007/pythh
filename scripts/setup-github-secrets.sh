#!/bin/bash
# GitHub Secrets Setup Helper
# Run this to get your secret values for GitHub Actions

echo "======================================"
echo "GitHub Secrets Setup for pythh repo"
echo "======================================"
echo ""
echo "📋 Go to: https://github.com/ugobe007/pythh/settings/secrets/actions"
echo ""
echo "Click 'New repository secret' for each of these:"
echo ""

cd "$(dirname "$0")/.." || exit 1
source .env 2>/dev/null || { echo "❌ .env file not found"; exit 1; }

echo "1️⃣  Secret name: SUPABASE_URL"
echo "   Value to paste:"
echo "   $VITE_SUPABASE_URL"
echo ""

echo "2️⃣  Secret name: SUPABASE_SERVICE_KEY"
echo "   Value to paste:"
echo "   $SUPABASE_SERVICE_KEY"
echo ""

echo "3️⃣  Secret name: SUPABASE_ANON_KEY"
echo "   Value to paste:"
echo "   $VITE_SUPABASE_ANON_KEY"
echo ""

echo "4️⃣  Secret name: OPENAI_API_KEY"
echo "   Value to paste:"
echo "   $OPENAI_API_KEY"
echo ""

echo "======================================"
echo "After adding all 4 secrets, trigger the workflow:"
echo "https://github.com/ugobe007/pythh/actions/workflows/god-score-recalculation.yml"
echo ""
echo "Click 'Run workflow' → Select 'main' → Click 'Run workflow'"
echo "======================================"
