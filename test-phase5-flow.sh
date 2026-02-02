#!/bin/bash
echo "=== Phase 5 UI Test Flow ==="
echo ""
echo "Step 1: Submit a URL (nucleoresearch.com)"
SUBMIT=$(curl -s -X POST http://localhost:3002/api/discovery/submit \
  -H "Content-Type: application/json" \
  -d '{"url":"nucleoresearch.com"}')
echo "$SUBMIT" | jq '.'

JOB_ID=$(echo "$SUBMIT" | jq -r '.job_id')
echo ""
echo "Job ID: $JOB_ID"
echo ""

if [ "$JOB_ID" != "null" ] && [ -n "$JOB_ID" ]; then
  echo "Step 2: Poll until ready..."
  for i in {1..10}; do
    RESULTS=$(curl -s "http://localhost:3002/api/discovery/results?job_id=$JOB_ID")
    STATUS=$(echo "$RESULTS" | jq -r '.status')
    echo "Poll $i: Status = $STATUS"
    
    if [ "$STATUS" = "ready" ]; then
      echo ""
      echo "Step 3: Check Phase 5 readiness..."
      PHASE5=$(echo "$RESULTS" | jq -r '.debug.phase5Ready')
      STARTUP_ID=$(echo "$RESULTS" | jq -r '.startup_id')
      
      echo "phase5Ready: $PHASE5"
      echo "startup_id: $STARTUP_ID"
    #!/bin/bash
echo "=== Phase 5 UI Test Flow ==="
echo ""
echo "Step 1: Subep 4echo "=== ltecho ""
echo "Step 1: Submit a URLlhecho "02SUBMIT=$(curl -s -X POST http://localhost:3002/jq  -H "Content-Type: application/json" \
  -d '{"url":"nucleoresearch(e  -d '{"url":"nucleoresearch.com"}')
eunecho "$SUBMIT" | jq '.'

JOB_ID=$(e s
JOB_ID=$(echo "$SUBMI  becak
    fi
    
    sleep 2
  done
fi
