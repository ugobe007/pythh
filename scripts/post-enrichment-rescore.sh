#!/usr/bin/env bash
# post-enrichment-rescore.sh
# Run this after any bulk enrichment to push new data through the full scoring stack.
# Usage: bash scripts/post-enrichment-rescore.sh
set -e

cd "$(dirname "$0")/.."
source .env 2>/dev/null || true

echo "═══════════════════════════════════════════════════════"
echo " Post-Enrichment Rescore Pipeline"
echo " $(date)"
echo "═══════════════════════════════════════════════════════"

echo ""
echo "▶ Step 1: Ingest metrics signals from promoted fields…"
node scripts/ingest-metrics-signals.js --apply

echo ""
echo "▶ Step 2: Sync signal dimension scores → startup_signal_scores…"
node scripts/sync-signal-scores.js --apply --limit=5000

echo ""
echo "▶ Step 3: Bridge signals_bonus → startup_uploads (SQL)…"
PGPASSWORD="$PGPASSWORD" psql "$DATABASE_URL" -c "
UPDATE startup_uploads su
SET
  signals_bonus = LEAST(ROUND(sss.signals_total::numeric, 2), 9),
  signals_updated_at = NOW()
FROM startup_signal_scores sss
WHERE sss.startup_id = su.id
  AND su.signals_bonus IS DISTINCT FROM LEAST(ROUND(sss.signals_total::numeric, 2), 9);
" 2>&1 || echo "  (psql bridge skipped — run manually if DATABASE_URL not set)"

echo ""
echo "▶ Step 4: Recalculate GOD scores with new signal bonuses…"
npx tsx scripts/recalculate-scores.ts

echo ""
echo "═══════════════════════════════════════════════════════"
echo " ✅ Rescore pipeline complete"
echo " $(date)"
echo "═══════════════════════════════════════════════════════"
