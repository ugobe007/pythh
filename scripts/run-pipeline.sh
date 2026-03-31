#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# PYTHH SIGNAL INTELLIGENCE PIPELINE — MASTER RUNNER
# ═══════════════════════════════════════════════════════════════════════════════
#
# Runs the full signal intelligence pipeline end-to-end:
#   0. Fetch fresh articles from 50 RSS sources → discovered_startups
#   1. Ingest signals from startup_uploads (skip already-ingested)
#   2. Ingest signals from discovered_startups (new RSS articles)
#   3. LLM second-pass (GPT-4o-mini) on entities with zero signals
#   4. Social signals — Google News, GitHub, iTunes (skip recent fetches)
#   5. Founder oracle — linguistic analysis → founder_voice_score
#   6. Compute trajectories (with signal decay) for all entities
#   7. Infer needs from trajectories
#   8. Compute matches against candidates
#
# Usage:
#   ./scripts/run-pipeline.sh                         # dry-run (no DB writes)
#   ./scripts/run-pipeline.sh --apply                 # full apply (all 5 steps)
#   ./scripts/run-pipeline.sh --apply --quick         # smaller limits
#   ./scripts/run-pipeline.sh --apply --signals-only  # steps 1+2 only (daily refresh)
#
# Recommended cron schedule:
#   Daily 6am:   ingest new signals from freshly scraped articles
#     0 6 * * * cd /path/to/hot-honey && ./scripts/run-pipeline.sh --apply --signals-only >> logs/pipeline.log 2>&1
#   Weekly Sunday 2am: full intelligence recompute
#     0 2 * * 0 cd /path/to/hot-honey && ./scripts/run-pipeline.sh --apply >> logs/pipeline.log 2>&1
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

# ── Parse args ───────────────────────────────────────────────────────────────
APPLY=""
QUICK=""
SIGNALS_ONLY=""
for arg in "$@"; do
  case "$arg" in
    --apply)        APPLY="--apply" ;;
    --quick)        QUICK="1" ;;
    --signals-only) SIGNALS_ONLY="1" ;;
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
echo "  Scope:  $([ -n "$SIGNALS_ONLY" ] && echo "signals only (steps 1-2)" || echo "full pipeline (steps 1-5)")"
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

# ── Step 0: Fetch fresh RSS articles into discovered_startups ─────────────────
run_step "0 — Fetch RSS articles (50 sources, 15 articles each)" \
  scripts/fetch-rss-articles.js $APPLY --sources 50 --articles 15

# ── Step 1: Ingest signals from startup_uploads ───────────────────────────────
run_step "1 — Ingest startup_uploads signals" \
  scripts/ingest-pythh-signals.js $APPLY --limit "$INGEST_LIMIT" --skip-existing

# ── Step 2: Ingest signals from discovered_startups (new RSS articles) ─────────
run_step "2 — Ingest discovered_startups headlines" \
  scripts/ingest-discovered-signals.js $APPLY --limit "$DISC_LIMIT" --skip-existing

# ── Step 3: LLM second-pass on entities with zero signals ─────────────────────
run_step "3 — LLM enrichment (GPT-4o-mini on 0-signal entities)" \
  scripts/enrich-signals-llm.js $APPLY --limit 500

# ── Step 4: Social signals — GitHub stars, Google News count, iTunes ratings ──
# Skips startups fetched within the last 30 days automatically (built-in dedup).
run_step "4 — Social signals (GitHub / Google News / iTunes)" \
  scripts/social-signals-fetcher.mjs $APPLY --limit 300

# ── Step 5: Founder oracle — score pitcher language quality ───────────────────
# Writes founder_voice_score + language_analysis to startup_uploads.
run_step "5 — Founder oracle (linguistic analysis)" \
  scripts/linguistic-oracle.js score $APPLY --limit 500

# ── Step 6-8: Intelligence recompute (skipped in --signals-only mode) ──────────
if [[ -z "$SIGNALS_ONLY" ]]; then
  run_step "6 — Compute trajectories (with signal decay)" \
    scripts/compute-trajectories.js $APPLY --limit "$TRAJ_LIMIT"

  run_step "7 — Infer entity needs" \
    scripts/compute-needs.js $APPLY --limit "$NEEDS_LIMIT"

  run_step "8 — Compute matches" \
    scripts/compute-matches.js $APPLY --limit "$MATCH_LIMIT" --top 15
else
  echo "───────────────────────────────────────────────────────────────"
  echo "  Signals-only mode: skipping steps 6-8 (trajectories/needs/matches)"
  echo "  Run without --signals-only on Sunday for full intelligence recompute."
  echo "───────────────────────────────────────────────────────────────"
fi

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
