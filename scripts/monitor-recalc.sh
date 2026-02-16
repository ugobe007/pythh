#!/bin/bash
# Monitor GOD score recalculation progress

echo "════════════════════════════════════════════════════════"
echo "🔄 GOD SCORE RECALCULATION MONITOR"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if process is running
PROCS=$(ps aux | grep "recalculate-scores" | grep -v grep | wc -l | tr -d ' ')

if [ "$PROCS" -gt 0 ]; then
    echo "✅  Status: RUNNING ($PROCS processes)"
else
    echo "⏹️  Status: NOT RUNNING"
fi

echo ""

# Check log file
if [ -f /tmp/full-recalc-v4.log ]; then
    LINES=$(wc -l < /tmp/full-recalc-v4.log | tr -d ' ')
    UPDATES=$(grep -c "✅" /tmp/full-recalc-v4.log)
    BOOTSTRAP=$(grep -c "🚀" /tmp/full-recalc-v4.log)
    
    echo "📊 Progress:"
    echo "  Log lines:       $LINES"
    echo "  Startups updated: ~$UPDATES"
    echo "  Bootstrap applied: $BOOTSTRAP"
    echo ""
    
    # Estimate progress (assuming ~9,691 total)
    if [ $UPDATES -gt 0 ]; then
        PCT=$((UPDATES * 100 / 9691))
        echo "  Estimated:       ${PCT}% complete (${UPDATES}/9,691)"
    fi
    
    echo ""
    echo "📝 Latest updates:"
    tail -10 /tmp/full-recalc-v4.log | grep "✅"
    
    echo ""
    
    # Check for summary (means it completed)
    if grep -q "SUMMARY" /tmp/full-recalc-v4.log 2>/dev/null; then
        echo "✅  COMPLETED!"
        echo ""
        grep -A 5 "SUMMARY" /tmp/full-recalc-v4.log
    fi
else
    echo "❌ Log file not found: /tmp/full-recalc-v4.log"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "Commands:"
echo "  Watch progress:  watch -n 5 ./scripts/monitor-recalc.sh"
echo "  View log:        tail -f /tmp/full-recalc-v4.log"
echo "  Check integrity: node scripts/check-data-integrity.js"
echo "════════════════════════════════════════════════════════"
