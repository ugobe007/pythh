#!/bin/bash
# ============================================================================
# GOD Guardrails Deployment Script
# Run this to apply migrations in Supabase
# ============================================================================

set -e  # Exit on error

echo "🛡️  GOD Guardrails Deployment"
echo "========================================"
echo ""

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing Supabase credentials"
  echo "Please set:"
  echo "  export SUPABASE_URL='https://your-project.supabase.co'"
  echo "  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
  exit 1
fi

echo "✅ Supabase credentials found"
echo ""

# Step 1: Apply main migration
echo "📦 Step 1: Applying main migration (tables, triggers, RPC)..."
echo "File: server/migrations/20260129_god_guardrails.sql"
echo ""

# Use Supabase REST API to execute SQL
MIGRATION_SQL=$(cat server/migrations/20260129_god_guardrails.sql)

curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$MIGRATION_SQL" | jq -Rs .)}" \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Main migration applied successfully"
else
  echo "⚠️  Could not apply via API. Please paste SQL manually in Supabase SQL Editor:"
  echo "   ${SUPABASE_URL}/project/_/sql"
  echo ""
  echo "1. Open server/migrations/20260129_god_guardrails.sql"
  echo "2. Copy entire contents"
  echo "3. Paste into SQL Editor and run"
  echo ""
  echo "Then re-run this script to continue."
  exit 1
fi

echo ""

# Step 2: Apply seed data
echo "📦 Step 2: Applying seed data (god_v1_initial weights)..."
echo "File: server/migrations/20260129_god_guardrails_seed.sql"
echo ""

SEED_SQL=$(cat server/migrations/20260129_god_guardrails_seed.sql)

curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SEED_SQL" | jq -Rs .)}" \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Seed data applied successfully"
else
  echo "⚠️  Could not apply via API. Please paste SQL manually in Supabase SQL Editor:"
  echo "   ${SUPABASE_URL}/project/_/sql"
  echo ""
  echo "1. Open server/migrations/20260129_god_guardrails_seed.sql"
  echo "2. Copy entire contents"
  echo "3. Paste into SQL Editor and run"
  echo ""
fi

echo ""

# Step 3: Verify deployment
echo "🔍 Step 3: Verifying deployment..."
echo ""

# This will be done manually - print instructions
echo "Run these queries in Supabase SQL Editor to verify:"
echo ""
echo "-- Check tables exist"
echo "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'god_%';"
echo ""
echo "-- Check runtime config"
echo "SELECT * FROM get_god_runtime();"
echo ""
echo "-- Check initial version"
echo "SELECT weights_version, status, weights_sha256, comment FROM god_weight_versions;"
echo ""

echo "========================================"
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Restart server: pm2 restart server"
echo "2. Update scorer: See SIGNALS_STRATEGY.md for integration guide"
echo "3. Test API: curl ${SUPABASE_URL}/api/god/runtime"
echo "4. Run golden tests: node scripts/test-god-golden.js"
echo ""
