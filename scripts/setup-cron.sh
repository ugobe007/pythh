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
CRON_MARKER="# pythh-signal-pipeline"

# Make sure pipeline script is executable
chmod +x "$PIPELINE_SCRIPT"

# Build the cron entry (runs every Sunday at 2:00am)
CRON_JOB="0 2 * * 0 cd \"$ROOT\" && PATH=\"/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:\$PATH\" $PIPELINE_SCRIPT --apply >> \"$LOG_FILE\" 2>&1 $CRON_MARKER"

case "${1:-install}" in
  --remove)
    echo "🗑  Removing Pythh cron job..."
    (crontab -l 2>/dev/null | grep -v "$CRON_MARKER") | crontab -
    echo "✅ Cron job removed."
    ;;
  --check)
    if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
      echo "✅ Pythh cron job is installed:"
      crontab -l 2>/dev/null | grep "$CRON_MARKER"
    else
      echo "❌ Pythh cron job is NOT installed."
      echo "   Run: ./scripts/setup-cron.sh to install."
    fi
    ;;
  *)
    echo "⚙️  Installing Pythh weekly pipeline cron job..."
    mkdir -p "$ROOT/logs"
    # Remove any existing entry then add fresh
    (crontab -l 2>/dev/null | grep -v "$CRON_MARKER"; echo "$CRON_JOB") | crontab -
    echo ""
    echo "✅ Cron job installed!"
    echo "   Schedule: Every Sunday at 2:00am"
    echo "   Command:  $PIPELINE_SCRIPT --apply"
    echo "   Log:      $LOG_FILE"
    echo ""
    echo "Current crontab:"
    crontab -l 2>/dev/null | grep "$CRON_MARKER" || true
    echo ""
    echo "To remove:  ./scripts/setup-cron.sh --remove"
    echo "To check:   ./scripts/setup-cron.sh --check"
    echo "To run now: ./scripts/run-pipeline.sh --apply"
    ;;
esac
