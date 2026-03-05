#!/bin/zsh
cd /Users/leguplabs/Desktop/hot-honey
npx tsx scripts/recalculate-scores.ts 2>&1 | grep -E "Phase.*complete|Updated:|Unchanged:|Bootstrap|Momentum|Elite|Hot|Investor|Total:|recalculation complete"
echo "EXIT: $?"
