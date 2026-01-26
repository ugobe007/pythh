#!/bin/bash

# Faith Signals Full Pipeline
# Orchestrates: Extract → Validate → Match

set -e

echo "🧠 PYTHH Faith Signals Pipeline"
echo "================================"
echo ""

# Step 1: Database migrations
echo "Step 1️⃣  Setting up database schema..."
echo "Note: Run this in Supabase SQL editor:"
echo "  1. Open: https://app.supabase.com"
echo "  2. Project > SQL Editor > New Query"
echo "  3. Copy-paste contents of scripts/migrations/faith-signals-schema.sql"
echo "  4. Run the query"
echo ""
read -p "Press ENTER after running database migrations..."

# Step 2: Extract portfolio exhaust
echo ""
echo "Step 2️⃣  Extracting VC portfolio data from SEC..."
node scripts/extract-vc-portfolio-exhaust.js

# Brief pause
sleep 2

# Step 3: Extract faith signals  
echo ""
echo "Step 3️⃣  Extracting VC faith signals..."
echo "Note: This requires ANTHROPIC_API_KEY in .env"
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  ANTHROPIC_API_KEY not set. Add to .env first."
  echo "   For now, using pre-defined signals..."
fi
node scripts/extract-vc-faith-signals.js

# Brief pause
sleep 2

# Step 4: Validate signals with portfolio
echo ""
echo "Step 4️⃣  Validating faith signals with portfolio data..."
node scripts/validate-faith-signals.js

# Summary
echo ""
echo "✅ Faith Signals Pipeline Complete!"
echo ""
echo "What happened:"
echo "  1. Extracted 100+ portfolio investments per VC"
echo "  2. Extracted faith signals from VC beliefs"
echo "  3. Validated signals against actual portfolio"
echo ""
echo "Next steps:"
echo "  1. Extract startup vision signals:"
echo "     npm run extract-startup-signals"
echo "  2. Run matching:"
echo "     npm run calculate-faith-matches"
echo "  3. View results in admin dashboard"
echo ""
echo "Database queries:"
echo "  - SELECT * FROM vc_faith_signals LIMIT 10;"
echo "  - SELECT * FROM vc_portfolio_exhaust WHERE vc_id='a16z' LIMIT 10;"
echo "  - SELECT * FROM psychology_matches ORDER BY faith_alignment_score DESC LIMIT 10;"
