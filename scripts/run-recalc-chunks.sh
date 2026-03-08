#!/bin/bash
# Run recalculation in chunks via PM2
# Usage: ./scripts/run-recalc-chunks.sh [total-chunks] [chunk-size]

TOTAL_CHUNKS=${1:-10}  # Default 10 chunks
CHUNK_SIZE=${2:-860}   # Default ~860 startups per chunk (8600 total / 10)

echo "🔢 Starting chunked recalculation: $TOTAL_CHUNKS chunks"
echo "   Chunk size: ~$CHUNK_SIZE startups per chunk"
echo ""

# Stop any existing chunk processes
pm2 delete score-recalc-chunk-* 2>/dev/null || true

# Start chunk processes
for i in $(seq 0 $((TOTAL_CHUNKS - 1))); do
  echo "Starting chunk $((i + 1))/$TOTAL_CHUNKS..."
  pm2 start npx --name "score-recalc-chunk-$i" -- \
    tsx scripts/recalculate-scores-chunked.ts --chunk=$i --total-chunks=$TOTAL_CHUNKS
  sleep 2  # Stagger starts to avoid DB connection spikes
done

echo ""
echo "✅ All chunks started. Monitor with:"
echo "   pm2 logs score-recalc-chunk-*"
echo "   pm2 status"
echo ""
echo "To stop all chunks:"
echo "   pm2 delete score-recalc-chunk-*"
