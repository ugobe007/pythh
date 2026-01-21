#!/usr/bin/env bash
#
# Backend API Smoke Test
# Tests critical endpoints for timeouts, rate limiting, and caching
#
# Usage:
#   chmod +x scripts/smoke-api.sh
#   BASE=http://localhost:3002 scripts/smoke-api.sh https://example.com
#

set -euo pipefail

BASE="${BASE:-http://localhost:3002}"
TEST_URL="${1:-https://example.com}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
  echo -e "${GREEN}✅${NC} $1"
}

fail() {
  echo -e "${RED}❌${NC} $1"
}

warn() {
  echo -e "${YELLOW}⚠️${NC}  $1"
}

echo "🔍 Hot Honey API Smoke Test"
echo "Base URL: $BASE"
echo "Test URL: $TEST_URL"
echo "================================================"

# 1. Health Check
echo -e "\n== Test 1: Health Endpoint =="
HTTP_CODE=$(curl -sS -o /tmp/health.json -w "%{http_code}" "$BASE/api/health")
if [ "$HTTP_CODE" == "200" ]; then
  pass "Health endpoint returned 200"
  if grep -q '"status":"ok"' /tmp/health.json; then
    pass "Health response contains status:ok"
  else
    fail "Health response missing status:ok"
  fi
else
  fail "Health endpoint returned $HTTP_CODE (expected 200)"
fi

# Check for X-Request-ID header
curl -sS -I "$BASE/api/health" > /tmp/health-headers.txt
if grep -qi "x-request-id" /tmp/health-headers.txt; then
  pass "X-Request-ID header present"
else
  fail "X-Request-ID header missing"
fi

# 2. Matches Endpoint (First Request - Cache MISS)
echo -e "\n== Test 2: /api/matches (First Request) =="
ENCODED_URL=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$TEST_URL'''))")

# Try to find a real startup ID from the database
STARTUP_ID="11cd88ad-d464-4f5c-9e65-82da8ffe7e8a" # Fallback test ID

HTTP_CODE=$(curl -sS -o /tmp/matches1.json -w "%{http_code}" -D /tmp/matches1-headers.txt \
  "$BASE/api/matches?startup_id=$STARTUP_ID")

if [ "$HTTP_CODE" == "200" ]; then
  pass "Matches endpoint returned 200"
  
  # Check response structure
  if grep -q '"startup"' /tmp/matches1.json; then
    pass "Response contains startup object"
  else
    warn "Response missing startup object (might be error)"
  fi
  
  # Check for degraded flag
  if grep -q '"degraded":true' /tmp/matches1.json; then
    warn "Response is degraded (check logs for cause)"
  else
    pass "Response not degraded"
  fi
  
  # Check cache header
  if grep -qi "x-cache: MISS" /tmp/matches1-headers.txt; then
    pass "Cache header shows MISS (expected for first request)"
  elif grep -qi "x-cache: HIT" /tmp/matches1-headers.txt; then
    warn "Cache header shows HIT (unexpected for first request - cache already warm)"
  else
    warn "No X-Cache header found"
  fi
  
elif [ "$HTTP_CODE" == "429" ]; then
  warn "Rate limited (429) - wait before retrying"
elif [ "$HTTP_CODE" == "504" ]; then
  fail "Gateway timeout (504) - query too slow"
elif [ "$HTTP_CODE" == "400" ]; then
  warn "Bad request (400) - check startup_id parameter"
else
  fail "Matches endpoint returned $HTTP_CODE"
fi

# 3. Matches Endpoint (Second Request - Cache HIT expected)
echo -e "\n== Test 3: /api/matches (Second Request - Cache Test) =="
sleep 1 # Brief pause

HTTP_CODE=$(curl -sS -o /tmp/matches2.json -w "%{http_code}" -D /tmp/matches2-headers.txt \
  "$BASE/api/matches?startup_id=$STARTUP_ID")

if [ "$HTTP_CODE" == "200" ]; then
  pass "Matches endpoint returned 200 (second request)"
  
  # Check for cache hit
  if grep -qi "x-cache: HIT" /tmp/matches2-headers.txt; then
    pass "Cache header shows HIT (cache working!)"
  else
    warn "Cache header still shows MISS (cache might not be working)"
  fi
  
  # Check for cached:true in body
  if grep -q '"cached":true' /tmp/matches2.json; then
    pass "Response body indicates cached result"
  fi
  
elif [ "$HTTP_CODE" == "429" ]; then
  warn "Rate limited (429) - too many requests"
else
  fail "Second request returned $HTTP_CODE"
fi

# 4. Rate Limiting Test
echo -e "\n== Test 4: Rate Limiting =="
echo "Sending 5 rapid requests..."
RATE_LIMITED=0

for i in {1..5}; do
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/matches?startup_id=$STARTUP_ID" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" == "429" ]; then
    RATE_LIMITED=1
    break
  fi
  sleep 0.5
done

if [ $RATE_LIMITED -eq 1 ]; then
  pass "Rate limiting triggered after rapid requests"
else
  warn "Rate limiting not triggered (might need more requests or burst limiter is generous)"
fi

# 5. Request ID Consistency
echo -e "\n== Test 5: Request ID Middleware =="
REQ_ID=$(curl -sS -I "$BASE/api/health" 2>/dev/null | grep -i "x-request-id" | cut -d: -f2 | tr -d ' \r\n')
if [ -n "$REQ_ID" ]; then
  pass "Request ID generated: $REQ_ID"
  
  # Check if it's a valid UUID format
  if [[ $REQ_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
    pass "Request ID is valid UUID format"
  else
    warn "Request ID format unexpected: $REQ_ID"
  fi
else
  fail "No Request ID found in headers"
fi

# Summary
echo -e "\n================================================"
echo "✅ Smoke test complete"
echo ""
echo "Next steps:"
echo "  1. Check PM2 logs: pm2 logs api-server --lines 50"
echo "  2. Verify no timeout errors in logs"
echo "  3. Confirm cache hit rate increases with repeated requests"

# Cleanup
rm -f /tmp/health.json /tmp/health-headers.txt /tmp/matches*.json /tmp/matches*-headers.txt
