#!/usr/bin/env bash
# Continuous sparse-startup enrich loop for entity_gate=needs_url.
#
# Strategy (why not "html-only --run-all then news"):
#   A single --run-all html-only job on ~60k rows takes days and blocks news forever.
#   This supervisor runs forever as: HTML chunk → NEWS/press chunk → repeat.
#   Each chunk is a finite --limit process that exits cleanly (see process.exit in
#   enrich-sparse-startups.js). Junk names are parked as holding so they leave the queue.
#
# Usage:
#   npm run enrich:sparse:continuous
#   ENRICH_HTML_LIMIT=200 ENRICH_NEWS_LIMIT=40 bash scripts/enrich-sparse-continuous.sh
#
# Logs (durable; /opt/cursor/artifacts is ephemeral):
#   /workspace/logs/enrich-sparse/continuous.log
#   /workspace/logs/enrich-sparse/continuous.pid
#
# Stop:
#   kill "$(cat /workspace/logs/enrich-sparse/continuous.pid)"

set -uo pipefail

cd "$(dirname "$0")/.."

LOG_DIR="${ENRICH_SPARSE_LOG_DIR:-/workspace/logs/enrich-sparse}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/continuous.log"
PIDFILE="$LOG_DIR/continuous.pid"
echo $$ > "$PIDFILE"

HTML_LIMIT="${ENRICH_HTML_LIMIT:-200}"
NEWS_LIMIT="${ENRICH_NEWS_LIMIT:-40}"
CYCLE_PAUSE_SEC="${ENRICH_CYCLE_PAUSE_SEC:-5}"
EMPTY_SLEEP_SEC="${ENRICH_IDLE_SLEEP_SEC:-120}"
GOD_BELOW="${ENRICH_GOD_SCORE_BELOW:-100}"

export SPARSE_ENRICH_HTML_CONCURRENCY="${SPARSE_ENRICH_HTML_CONCURRENCY:-4}"
export SPARSE_ENRICH_NEWS_TIMEOUT_MS="${SPARSE_ENRICH_NEWS_TIMEOUT_MS:-120000}"

log() {
  mkdir -p "$LOG_DIR"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG"
}

log "=== continuous enrich START pid=$$ html_limit=$HTML_LIMIT news_limit=$NEWS_LIMIT god_score_below=$GOD_BELOW concurrency_html=$SPARSE_ENRICH_HTML_CONCURRENCY ==="
log "Strategy: alternate HTML URL-discovery chunks with NEWS/press chunks until killed"

cycle=0
consecutive_empty=0

while true; do
  cycle=$((cycle + 1))

  log "── CYCLE $cycle · HTML chunk (limit=$HTML_LIMIT) ──"
  SPARSE_ENRICH_HTML_CONCURRENCY="$SPARSE_ENRICH_HTML_CONCURRENCY" \
    npm run enrich:sparse -- \
      --gate-needs-url-only \
      --html-only \
      --no-require-signal \
      --limit="$HTML_LIMIT" \
      --god-score-below="$GOD_BELOW" \
      >>"$LOG" 2>&1
  html_ec=$?
  # Parse the most recent CHUNK SUMMARY block (last occurrence in the log)
  html_processed=$(awk '/CHUNK SUMMARY/{p=1; proc=""; enr=""} p && /Processed:/{proc=$2} p && /Enriched:/{enr=$2} p && /^══/{if(proc!=""){lastp=proc; laste=enr; p=0}} END{print lastp+0}' "$LOG")
  html_enriched=$(awk '/CHUNK SUMMARY/{p=1; proc=""; enr=""} p && /Processed:/{proc=$2} p && /Enriched:/{enr=$2} p && /^══/{if(proc!=""){lastp=proc; laste=enr; p=0}} END{print laste+0}' "$LOG")
  log "HTML chunk exit=$html_ec processed=${html_processed:-0} enriched=${html_enriched:-0}"

  log "── CYCLE $cycle · NEWS chunk (limit=$NEWS_LIMIT, QUICK_ENRICH_LITE=0) ──"
  QUICK_ENRICH_LITE=0 \
  SPARSE_ENRICH_NEWS_TIMEOUT_MS="$SPARSE_ENRICH_NEWS_TIMEOUT_MS" \
    npm run enrich:sparse -- \
      --gate-needs-url-only \
      --no-require-signal \
      --limit="$NEWS_LIMIT" \
      --god-score-below="$GOD_BELOW" \
      >>"$LOG" 2>&1
  news_ec=$?
  news_processed=$(awk '/CHUNK SUMMARY/{p=1; proc=""; enr=""} p && /Processed:/{proc=$2} p && /Enriched:/{enr=$2} p && /^══/{if(proc!=""){lastp=proc; laste=enr; p=0}} END{print lastp+0}' "$LOG")
  news_enriched=$(awk '/CHUNK SUMMARY/{p=1; proc=""; enr=""} p && /Processed:/{proc=$2} p && /Enriched:/{enr=$2} p && /^══/{if(proc!=""){lastp=proc; laste=enr; p=0}} END{print laste+0}' "$LOG")
  log "NEWS chunk exit=$news_ec processed=${news_processed:-0} enriched=${news_enriched:-0}"

  hp=${html_processed:-0}
  np=${news_processed:-0}
  if [[ "${hp}" == "0" && "${np}" == "0" ]]; then
    consecutive_empty=$((consecutive_empty + 1))
    log "Pool empty (or only holding left). idle sleep ${EMPTY_SLEEP_SEC}s (empty_streak=$consecutive_empty)"
    sleep "$EMPTY_SLEEP_SEC"
  else
    consecutive_empty=0
    sleep "$CYCLE_PAUSE_SEC"
  fi
done
