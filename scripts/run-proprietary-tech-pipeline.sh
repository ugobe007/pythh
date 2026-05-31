#!/usr/bin/env bash
# Full proprietary-tech pipeline: backfill → HTML rescrape → GOD recalc → match regen
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs

echo "[$(date -Iseconds)] Phase 1: text assessment (all approved startups)"
node scripts/backfill-proprietary-tech.js --force 2>&1 | tee -a logs/backfill-proprietary-tech.log

echo "[$(date -Iseconds)] Phase 2: HTML rescrape (websites)"
node scripts/backfill-proprietary-tech.js --html-rescrape --force 2>&1 | tee -a logs/backfill-proprietary-tech-html.log

echo "[$(date -Iseconds)] Phase 3: GOD score recalculation"
npx tsx scripts/recalculate-scores.ts 2>&1 | tee -a logs/recalculate-scores-post-tech.log

echo "[$(date -Iseconds)] Phase 4: full match regeneration (tech VC fit)"
node match-regenerator.js --full 2>&1 | tee -a logs/match-regenerator-full-techvc.log

echo "[$(date -Iseconds)] Pipeline complete"
