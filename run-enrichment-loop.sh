#!/bin/bash
cd /Users/leguplabs/Desktop/hot-honey
LOG=/tmp/enrich-web-signals.log

for i in $(seq 1 20); do
  echo "=== Run $i / 20 ===" >> $LOG
  node scripts/enrich-web-signals.mjs --limit 500 >> $LOG 2>&1
  echo "Run $i complete" >> $LOG
  sleep 3
done

echo "=== ALL DONE ===" >> $LOG
