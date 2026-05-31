#!/usr/bin/env bash
# Proprietary-tech pipeline: backfill → (optional HTML) → GOD recalc → match regen
# Run in tmux/screen or a dedicated terminal — Cursor background jobs may be killed.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs

run_phase() {
  local label="$1"
  shift
  echo ""
  echo "[$(date -Iseconds)] $label"
  if "$@"; then
    echo "[$(date -Iseconds)] OK: $label"
    return 0
  fi
  local code=$?
  echo "[$(date -Iseconds)] FAILED ($code): $label" >&2
  return "$code"
}

run_phase "Phase 1: text assessment (resume-capable)" \
  node scripts/backfill-proprietary-tech.js --force --resume >> logs/backfill-proprietary-tech.log 2>&1

if [ "${PROPRIETARY_TECH_HTML:-0}" = "1" ]; then
  run_phase "Phase 2: HTML rescrape (slow — optional)" \
    node scripts/backfill-proprietary-tech.js --html-rescrape --force --resume >> logs/backfill-proprietary-tech-html.log 2>&1
else
  echo "[$(date -Iseconds)] Phase 2 skipped (set PROPRIETARY_TECH_HTML=1 to enable website rescrape)"
fi

run_phase "Phase 3: GOD score recalculation" \
  npx tsx scripts/recalculate-scores.ts >> logs/recalculate-scores-post-tech.log 2>&1

run_phase "Phase 4: full match regeneration (tech VC fit)" \
  node match-regenerator.js --full >> logs/match-regenerator-full-techvc.log 2>&1

echo "[$(date -Iseconds)] Pipeline complete"
