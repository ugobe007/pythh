#!/bin/bash
# Stop current chunks and restart with new configuration

echo "🛑 Stopping current chunk processes..."
pm2 delete score-recalc-chunk-* 2>/dev/null || true

echo ""
echo "⏳ Waiting 2 seconds..."
sleep 2

echo ""
echo "🚀 Starting chunks with NEW configuration:"
echo "   normalizationDivisor: 20.5"
echo "   baseBoostMinimum: 1.5"
echo "   signalCap: +9"
echo ""

TOTAL_CHUNKS=10

for i in $(seq 0 $((TOTAL_CHUNKS - 1))); do
  echo "Starting chunk $((i + 1))/$TOTAL_CHUNKS..."
  pm2 start npx --name "score-recalc-chunk-$i" -- \
    tsx scripts/recalculate-scores-chunked.ts --chunk=$i --total-chunks=$TOTAL_CHUNKS
  sleep 2
done

echo ""
echo "✅ All chunks restarted with new configuration!"
echo ""
echo "Monitor with:"
echo "   pm2 logs score-recalc-chunk-32 --lines 20"
echo "   pm2 status | grep score-recalc-chunk"
