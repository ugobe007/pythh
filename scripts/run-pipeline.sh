#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# PYTHH SIGNAL INTELLIGENCE PIPELINE — MASTER RUNNER
# ═══════════════════════════════════════════════════════════════════════════════
#
# Runs the full signal intelligence pipeline end-to-end:
#   1. Ingest signals from startup_uploads (skip already-ingested)
#   2. Ingest signals from discovered_startups (article headlines)
#   3. Compute trajectories for all entities
#   4. Infer needs from trajectories
#   5. Compute matches against candidates
#
# Usage:
#   ./scripts/run-pipeline.sh                  # dry-run (no DB writes)
#   ./scripts/run-pipeline.sh --apply          # full apply
#   ./scripts/run-pipeline.sh --apply --quick  # quick mode (smaller limits)
#
# Cron example (every Sunday at 2am):
#   0 2 * * 0 cd /Users/leguplabs/Desktop/hot-honey && ./scripts/run-pipeline.sh --apply >> logs/pipeline.log 2>&1
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

# ── Parse args ───────────────────────────────────────────────────────────────
APPLY=""
QUICK=""
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY="--apply" ;;
    --quick) QUICK="1" ;;
  esac
done

# ── Limits (quick vs full) ───────────────────────────────────────────────────
if [[ -n "$QUICK" ]]; then
  INGEST_LIMIT=2000
  DISC_LIMIT=5000
  TRAJ_LIMIT=3000
  NEEDS_LIMIT=3000
  MATCH_LIMIT=3000
else
  INGEST_LIMIT=15000
  DISC_LIMIT=20000
  TRAJ_LIMIT=15000
  NEEDS_LIMIT=15000
  MATCH_LIMIT=15000
fi

# ── Header ───────────────────────────────────────────────────────────────────
START_TIME=$(date +%s)
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         PYTHH SIGNAL INTELLIGENCE PIPELINE RUNNER           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "  Mode:   $([ -n "$APPLY" ] && echo "✍  APPLY" || echo "🔍 DRY-RUN")"
echo "  Quick:  $([ -n "$QUICK" ] && echo "yes (smaller limits)" || echo "no (full run)")"
echo "  Start:  $(date)"
echo ""

# ── Helper ───────────────────────────────────────────────────────────────────
run_step() {
  local step="$1"; shift
  echo "───────────────────────────────────────────────────────────────"
  echo "  STEP $step"
  echo "───────────────────────────────────────────────────────────────"
  local step_start=$(date +%s)
  node "$@" || { echo "  ❌ Step $step failed (exit $?)"; exit 1; }
  local step_end=$(date +%s)
  echo "  ✅ Done in $((step_end - step_start))s"
  echo ""
}

cd "$ROOT"

# ── Step 1: Ingest signals from startup_uploads ───────────────────────────────
run_step "1/5 — Ingest startup_uploads signals" \
  scripts/ingest-pythh-signals.js $APPLY --limit "$INGEST_LIMIT" --skip-existing

# ── Step 2: Ingest signals from discovered_startups (headlines) ───────────────
run_step "2/5 — Ingest discovered_startups headlines" \
  scripts/ingest-discovered-signals.js $APPLY --limit "$DISC_LIMIT" --skip-existing

# ── Step 3: Compute trajectories ──────────────────────────────────────────────
run_step "3/5 — Compute trajectories" \
  scripts/compute-trajectories.js $APPLY --limit "$TRAJ_LIMIT"

# ── Step 4: Infer needs ───────────────────────────────────────────────────────
run_step "4/5 — Infer entity needs" \
  scripts/compute-needs.js $APPLY --limit "$NEEDS_LIMIT"

# ── Step 5: Compute matches ───────────────────────────────────────────────────
run_step "5/5 — Compute matches" \
  scripts/compute-matches.js $APPLY --limit "$MATCH_LIMIT" --top 15

# ── Summary ───────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINS=$((ELAPSED / 60))
SECS=$((ELAPSED % 60))

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              PIPELINE COMPLETE                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "  Total time: ${MINS}m ${SECS}s"
echo "  Finished:   $(date)"
echo ""
