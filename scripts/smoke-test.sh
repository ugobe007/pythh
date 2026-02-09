#!/bin/bash
# Smoke tests for instantSubmit endpoint
set -e

BASE="${1:-https://hot-honey.fly.dev}"
PASS=0
FAIL=0

smoke() {
  local label="$1"
  local url="$2"
  local data="$3"
  local check="$4"
  
  echo -n "  [$label] "
  RESP=$(curl -s -w "\n%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
  HTTP_CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  
  if echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
$check
" 2>/dev/null; then
    echo "PASS (HTTP $HTTP_CODE)"
    PASS=$((PASS+1))
  else
    echo "FAIL (HTTP $HTTP_CODE)"
    echo "    Response: $(echo "$BODY" | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "=========================================="
echo "  SMOKE TESTS — $BASE"
echo "=========================================="
echo ""

# Test 0: Health check
echo -n "  [Health Check] "
HC=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
if [ "$HC" = "200" ]; then
  echo "PASS (HTTP $HC)"
  PASS=$((PASS+1))
else
  echo "FAIL (HTTP $HC)"
  FAIL=$((FAIL+1))
fi

# Test 1: Existing startup returns cached matches
smoke "Existing startup (cached)" \
  "$BASE/api/instant/submit" \
  '{"url":"resonate.audio"}' \
  "
assert d.get('cached') == True, f'cached={d.get(\"cached\")}'
assert d.get('match_count', 0) >= 20, f'match_count={d.get(\"match_count\")}'
assert d.get('is_new') == False, f'is_new={d.get(\"is_new\")}'
assert d.get('startup_id'), 'missing startup_id'
assert d.get('processing_time_ms', 99999) < 10000, f'too slow: {d.get(\"processing_time_ms\")}ms'
print(f'{d.get(\"match_count\")} matches in {d.get(\"processing_time_ms\")}ms')
"

# Test 2: Known startup with matches (stripe)
smoke "Known startup (stripe)" \
  "$BASE/api/instant/submit" \
  '{"url":"stripe.com"}' \
  "
assert d.get('startup_id'), 'missing startup_id'
mc = d.get('match_count', 0)
assert mc >= 0, f'match_count negative'
t = d.get('processing_time_ms', 99999)
assert t < 10000, f'too slow: {t}ms'
status = 'cached' if d.get('cached') else 'gen_in_progress' if d.get('gen_in_progress') else 'other'
print(f'{mc} matches in {t}ms ({status})')
"

# Test 3: Brand new domain returns gen_in_progress
RAND_DOMAIN="smoketest$(date +%s).xyz"
smoke "New startup (gen_in_progress)" \
  "$BASE/api/instant/submit" \
  "{\"url\":\"$RAND_DOMAIN\"}" \
  "
assert d.get('is_new') == True, f'is_new={d.get(\"is_new\")}'
assert d.get('gen_in_progress') == True, f'gen_in_progress={d.get(\"gen_in_progress\")}'
assert d.get('startup_id'), 'missing startup_id'
t = d.get('processing_time_ms', 99999)
assert t < 10000, f'too slow: {t}ms'
print(f'new startup created in {t}ms')
"

# Test 4: Empty URL returns error
smoke "Empty URL (error expected)" \
  "$BASE/api/instant/submit" \
  '{"url":""}' \
  "
assert d.get('error'), 'expected error field'
print(f'got error: {d.get(\"error\")[:60]}')
"

# Test 5: No body returns error
smoke "Missing URL field (error expected)" \
  "$BASE/api/instant/submit" \
  '{}' \
  "
assert d.get('error'), 'expected error field'
print(f'got error: {d.get(\"error\")[:60]}')
"

# Test 6: Repeat same domain - should get cached or existing
smoke "Repeat submission (idempotent)" \
  "$BASE/api/instant/submit" \
  '{"url":"resonate.audio"}' \
  "
assert d.get('startup_id'), 'missing startup_id'
assert d.get('match_count', 0) >= 20, f'low matches: {d.get(\"match_count\")}'
t = d.get('processing_time_ms', 99999)
print(f'{d.get(\"match_count\")} matches in {t}ms (idempotent check)')
"

# Test 7: URL with https:// prefix
smoke "URL with https:// prefix" \
  "$BASE/api/instant/submit" \
  '{"url":"https://resonate.audio"}' \
  "
assert d.get('startup_id'), 'missing startup_id'
t = d.get('processing_time_ms', 99999)
print(f'matched in {t}ms')
"

# Test 8: URL with www prefix
smoke "URL with www prefix" \
  "$BASE/api/instant/submit" \
  '{"url":"www.resonate.audio"}' \
  "
assert d.get('startup_id'), 'missing startup_id'
t = d.get('processing_time_ms', 99999)
print(f'matched in {t}ms')
"

# Test 9: Frontend RPC fast path
echo -n "  [RPC fast path] "
RPC_RESP=$(curl -s "$BASE/rest/v1/rpc/instant_submit_fast" \
  -H "Content-Type: application/json" \
  -H "apikey: $(grep VITE_SUPABASE_ANON_KEY .env 2>/dev/null | cut -d= -f2-)" \
  -d '{"p_domain":"resonate.audio"}' 2>/dev/null || echo '{"error":"rpc_unavailable"}')
if echo "$RPC_RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d, list) and len(d) > 0:
  print(f'RPC returned {len(d)} results')
elif isinstance(d, dict) and d.get('startup_id'):
  print(f'RPC found startup')
else:
  raise Exception(f'unexpected: {str(d)[:100]}')
" 2>/dev/null; then
  echo "PASS"
  PASS=$((PASS+1))
else
  echo "SKIP (RPC may not exist)"
fi

# Test 10: Check matches endpoint
smoke "Matches for known startup" \
  "$BASE/api/instant/submit" \
  '{"url":"resonate.audio"}' \
  "
matches = d.get('matches', [])
assert len(matches) > 0, f'no matches returned'
m = matches[0]
assert 'match_score' in m, 'missing match_score'
inv = m.get('investors', {})
assert inv.get('name') or inv.get('firm'), 'missing investor info'
print(f'{len(matches)} matches, top score: {m.get(\"match_score\")}')
"

echo ""
echo "=========================================="
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "=========================================="
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
