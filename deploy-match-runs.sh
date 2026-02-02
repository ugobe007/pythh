#!/bin/bash
#
# deploy-match-runs.sh
# Deploys the Bulletproof Matching Engine V1 to Supabase
#

set -e  # Exit on error

echo "🚀 Deploying Match Runs Migration..."

# Load .env
source .env

# Apply migration
echo "📦 Applying SQL migration..."
psql "$DATABASE_URL" -f migrations/001-match-runs-orchestration.sql

echo ""
echo "✅ Migration applied successfully!"
echo ""
echo "Next steps:"
echo "1. Restart server: pm2 restart server"
echo "2. Add worker to PM2:"
echo "   pm2 start server/matchRunWorker.js --name match-worker --cron '*/10 * * * * *'"
echo "3. Test API:"
echo "   curl -X POST http://localhost:3002/api/match/run -H 'Content-Type: application/json' -d '{\"url\":\"https://example.com\"}'"
echo ""
