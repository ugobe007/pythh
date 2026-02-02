#!/bin/bash
# Monitor backfill progress
# Usage: ./monitor-backfill.sh

LOG_FILE="/tmp/backfill-complete.log"

echo "📊 Backfill Monitor"
echo "==================="
echo ""

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log file not found: $LOG_FILE"
    exit 1
fi

# Check if process is running
PID=$(ps aux | grep "backfill-startup-signals" | grep -v grep | awk '{print $2}' | head -1)

if [ -z "$PID" ]; then
    echo "⚠️  Process not running"
    echo ""
    echo "📄 Final log output:"
    echo "==================="
    tail -50 "$LOG_FILE"
    exit 0
fi

echo "✅ Process running (PID: $PID)"
echo ""

# Extract progress
LAST_LINE=$(tail -1 "$LOG_FILE")
echo "📍 Current status:"
echo "$LAST_LINE"
echo ""

# Estimate completion
PROCESSED=$(echo "$LAST_LINE" | grep -oE "Processed [0-9]+/[0-9]+" | grep -oE "[0-9]+/[0-9]+" || echo "unknown")
SIGNALS=$(echo "$LAST_LINE" | grep -oE "[0-9]+ total signals" || echo "unknown signals")

echo "   $PROCESSED | $SIGNALS"
echo ""

# Calculate ETA if possible
if [ "$PROCESSED" != "unknown" ]; then
    CURRENT=$(echo "$PROCESSED" | cut -d'/' -f1)
    TOTAL=$(echo "$PROCESSED" | cut -d'/' -f2)
    REMAINING=$((TOTAL - CURRENT))
    
    if [ $CURRENT -gt 0 ]; then
        # Estimate: 10 startups per second (rough estimate)
        ETA_SECONDS=$((REMAINING / 10))
        ETA_MINUTES=$((ETA_SECONDS / 60))
        
        echo "⏱️  Estimated time remaining: ~${ETA_MINUTES} minutes"
    fi
fi

echo ""
echo "💡 To watch live:"
echo "   tail -f $LOG_FILE"
echo ""
echo "💡 To check if complete:"
echo "   grep 'BACKFILL COMPLETE' $LOG_FILE"
