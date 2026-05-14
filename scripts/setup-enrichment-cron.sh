#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ENRICHMENT CRON — install phased startup-data jobs (see docs/ENRICHMENT_STAGES.md)
# ═══════════════════════════════════════════════════════════════════════════════
# Does NOT remove jobs from scripts/setup-cron.sh (signal pipeline).
#
# Usage:
#   ./scripts/setup-enrichment-cron.sh install   # add enrichment lines
#   ./scripts/setup-enrichment-cron.sh remove   # remove only enrichment lines
#   ./scripts/setup-enrichment-cron.sh check     # show enrichment lines if present
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$ROOT/scripts/cron/run-enrichment-schedule.sh"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

DAILY_LOG="$LOG_DIR/enrichment-daily.log"
WEEKLY_LOG="$LOG_DIR/enrichment-weekly.log"
COLD_LOG="$LOG_DIR/enrichment-cold.log"

chmod +x "$RUNNER"

NODE_PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

MARK_DAILY="# pythh-enrichment-daily"
MARK_WEEKLY="# pythh-enrichment-weekly"
MARK_COLD="# pythh-enrichment-cold"

# Every day 5:40 — full tightening (entity gate + exclude-junk RSS + capped RSS + sparse); edit to 1-5 for weekdays only
CRON_DAILY="40 5 * * * cd \"$ROOT\" && PATH=\"$NODE_PATH:\$PATH\" \"$RUNNER\" daily >> \"$DAILY_LOG\" 2>&1 $MARK_DAILY"
# Sunday 3:15 — full RSS + larger sparse (edit run-enrichment-schedule.sh weekly to match capacity)
CRON_WEEKLY="15 3 * * 0 cd \"$ROOT\" && PATH=\"$NODE_PATH:\$PATH\" \"$RUNNER\" weekly >> \"$WEEKLY_LOG\" 2>&1 $MARK_WEEKLY"
# Thursday 1:30 — cold-only sparse (separate from warm daily path)
CRON_COLD="30 1 * * 4 cd \"$ROOT\" && PATH=\"$NODE_PATH:\$PATH\" \"$RUNNER\" cold >> \"$COLD_LOG\" 2>&1 $MARK_COLD"

filter_out_enrichment() {
  grep -v "$MARK_DAILY" | grep -v "$MARK_WEEKLY" | grep -v "$MARK_COLD" || true
}

case "${1:-install}" in
  --remove|remove)
    echo "🗑  Removing Pythh enrichment cron jobs..."
    (crontab -l 2>/dev/null | filter_out_enrichment) | crontab -
    echo "✅ Enrichment cron entries removed."
    ;;
  --check|check)
    echo "Enrichment markers in crontab:"
    crontab -l 2>/dev/null | grep -E "$MARK_DAILY|$MARK_WEEKLY|$MARK_COLD" || echo "  (none found)"
    ;;
  *)
    echo "⚙️  Installing Pythh enrichment cron jobs..."
    (
      crontab -l 2>/dev/null | filter_out_enrichment
      echo "$CRON_DAILY"
      echo "$CRON_WEEKLY"
      echo "$CRON_COLD"
    ) | crontab -
    echo ""
    echo "✅ Enrichment cron installed."
    echo ""
    echo "  📅 Every day 5:40am — daily (entity gate + RSS exclude-junk + capped RSS + sparse) → $DAILY_LOG"
    echo "  📅 Sun 3:15am     — weekly (high RSS cap + larger sparse) → $WEEKLY_LOG"
    echo "  📅 Thu 1:30am     — cold sparse cohort → $COLD_LOG"
    echo ""
    echo "Docs: docs/ENRICHMENT_STAGES.md"
    echo "Remove: ./scripts/setup-enrichment-cron.sh remove"
    echo "Test now: $RUNNER smoke && $RUNNER daily   # daily is long; use smoke first"
    echo "Daily + DQ rollup: $RUNNER daily-full"
    ;;
esac
