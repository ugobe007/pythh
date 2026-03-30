#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# PYTHH CRON SETUP
# ═══════════════════════════════════════════════════════════════════════════════
# Installs a weekly cron job to run the Pythh signal intelligence pipeline.
# Runs every Sunday at 2:00am, appending output to logs/pipeline.log
#
# Usage:
#   ./scripts/setup-cron.sh          # install weekly cron job
#   ./scripts/setup-cron.sh --remove # remove the cron job
#   ./scripts/setup-cron.sh --check  # check if job is installed
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIPELINE_SCRIPT="$ROOT/scripts/run-pipeline.sh"
LOG_FILE="$ROOT/logs/pipeline.log"
CRON_MARKER_DAILY="# pythh-signal-daily"
CRON_MARKER_WEEKLY="# pythh-pipeline-weekly"

# Make sure pipeline script is executable
chmod +x "$PIPELINE_SCRIPT"

NODE_PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin"

# Daily 6am: ingest new signals only (steps 1+2 — fast, ~2 min)
CRON_DAILY="0 6 * * * cd \"$ROOT\" && PATH=\"$NODE_PATH:\$PATH\" $PIPELINE_SCRIPT --apply --signals-only >> \"$LOG_FILE\" 2>&1 $CRON_MARKER_DAILY"
# Weekly Sunday 2am: full intelligence recompute (all 5 steps, ~20 min)
CRON_WEEKLY="0 2 * * 0 cd \"$ROOT\" && PATH=\"$NODE_PATH:\$PATH\" $PIPELINE_SCRIPT --apply >> \"$LOG_FILE\" 2>&1 $CRON_MARKER_WEEKLY"

case "${1:-install}" in
  --remove)
    echo "🗑  Removing Pythh cron jobs..."
    (crontab -l 2>/dev/null | grep -v "$CRON_MARKER_DAILY" | grep -v "$CRON_MARKER_WEEKLY") | crontab -
    echo "✅ Cron jobs removed."
    ;;
  --check)
    DAILY_OK=$(crontab -l 2>/dev/null | grep -c "$CRON_MARKER_DAILY" || true)
    WEEKLY_OK=$(crontab -l 2>/dev/null | grep -c "$CRON_MARKER_WEEKLY" || true)
    if [[ "$DAILY_OK" -gt 0 ]] && [[ "$WEEKLY_OK" -gt 0 ]]; then
      echo "✅ Both Pythh cron jobs are installed:"
    else
      echo "⚠️  Some Pythh cron jobs may be missing (daily=$DAILY_OK, weekly=$WEEKLY_OK):"
    fi
    crontab -l 2>/dev/null | grep -E "$CRON_MARKER_DAILY|$CRON_MARKER_WEEKLY" || echo "  (none found)"
    ;;
  *)
    echo "⚙️  Installing Pythh cron jobs..."
    mkdir -p "$ROOT/logs"
    # Remove old entries and add both fresh
    (crontab -l 2>/dev/null \
      | grep -v "$CRON_MARKER_DAILY" \
      | grep -v "$CRON_MARKER_WEEKLY"
    echo "$CRON_DAILY"
    echo "$CRON_WEEKLY") | crontab -
    echo ""
    echo "✅ Cron jobs installed!"
    echo ""
    echo "  📅 Daily   6:00am  — Signal ingestion only (steps 1+2, ~2 min)"
    echo "  📅 Weekly  Sun 2am — Full intelligence recompute (all 5 steps, ~20 min)"
    echo "  📋 Log:    $LOG_FILE"
    echo ""
    echo "Current crontab:"
    crontab -l 2>/dev/null | grep -E "$CRON_MARKER_DAILY|$CRON_MARKER_WEEKLY" || true
    echo ""
    echo "To remove:  ./scripts/setup-cron.sh --remove"
    echo "To check:   ./scripts/setup-cron.sh --check"
    echo "To run now: ./scripts/run-pipeline.sh --apply --signals-only"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📧 Weekly Investor Email Digest (manual setup required):"
    echo ""
    echo "  Add this line to crontab for Monday 8am digest:"
    echo "  0 8 * * 1 cd \"$ROOT\" && node scripts/send-weekly-signal-digest.js --to YOUR_EMAIL >> logs/digest.log 2>&1"
    echo ""
    echo "  Test with dry-run first:"
    echo "  node scripts/send-weekly-signal-digest.js --dry-run --to you@firm.com"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ;;
esac
