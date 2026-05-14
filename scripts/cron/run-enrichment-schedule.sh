#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ENRICHMENT SCHEDULE — phased runs (daily / weekly / cold)
# ═══════════════════════════════════════════════════════════════════════════════
# Called by cron. See docs/ENRICHMENT_STAGES.md
#
# Usage (from repo root):
#   ./scripts/cron/run-enrichment-schedule.sh daily       # full tightening chain (capped RSS + sparse + gate + exclude-junk)
#   ./scripts/cron/run-enrichment-schedule.sh daily-full  # same + data-quality report at end
#   ./scripts/cron/run-enrichment-schedule.sh weekly
#   ./scripts/cron/run-enrichment-schedule.sh cold
#   ./scripts/cron/run-enrichment-schedule.sh smoke       # fast sanity (no DB work)
#
# "daily" delegates to scripts/cron/startup-data-tightening.js — one process runs entity gate,
# garbage cleanup, promote, metrics signals, RSS, integrity, quality gate, sync signals, recalc,
# sparse enrich, recalc again (see docs/ENRICHMENT_SCRIPTS_REFERENCE.md).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

# Prefer Homebrew node on Apple Silicon
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

MODE="${1:-}"

log() { echo "[$(date -Iseconds)] $*"; }

run_tighten() {
  # shellcheck disable=2068
  log "startup-data-tightening $*"
  node scripts/cron/startup-data-tightening.js "$@"
}

case "$MODE" in
  daily)
    # Full orchestrator: entity gate → cleanup → promote → metrics → RSS (exclude junk) → … → sparse → recalc
    log "=== DAILY enrichment (entity gate + exclude-junk RSS + capped RSS + sparse) ==="
    run_tighten \
      --run-entity-gate \
      --rss-gate-exclude-junk \
      --rss-capped --rss-limit=2500 \
      --sparse-limit=120 \
      --sparse-god-score-below=85 \
      --skip-dq-report
    ;;
  daily-full)
    log "=== DAILY FULL (same as daily + data-quality rollup at end) ==="
    run_tighten \
      --run-entity-gate \
      --rss-gate-exclude-junk \
      --rss-capped --rss-limit=2500 \
      --sparse-limit=120 \
      --sparse-god-score-below=85
    ;;
  weekly)
    log "=== WEEKLY enrichment (high RSS cap + larger sparse + gate + exclude-junk) ==="
    run_tighten \
      --run-entity-gate \
      --rss-gate-exclude-junk \
      --rss-capped --rss-limit=8000 \
      --sparse-limit=250 \
      --sparse-god-score-below=85 \
      --skip-dq-report
    ;;
  cold)
    # Cold cohort only: no URL — low concurrency implied by script; keep limit modest
    log "=== COLD sparse (no URL, widened GOD ceiling) ==="
    node scripts/enrich-sparse-startups.js --no-url-only --limit=60 --god-score-below=85
    log "=== Recalculate scores after cold sparse ==="
    npx tsx scripts/recalculate-scores.ts
    ;;
  smoke)
    log "=== SMOKE (node -v, repo path) ==="
    node -v
    pwd
    log "OK"
    ;;
  *)
    echo "Usage: $0 daily|daily-full|weekly|cold|smoke" >&2
    exit 1
    ;;
esac

log "done ($MODE)"
