#!/usr/bin/env bash
# Verify OAuth credentials exist (names only — never prints secret values).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
APP="hot-honey"
ORIGIN="${SMOKE_ORIGIN:-https://pythh.ai}"

fail=0
ok() { echo "OK: $*"; }
warn() { echo "WARN: $*"; }
bad() { echo "FAIL: $*"; fail=1; }

echo "=== Local .env (presence only) ==="
for key in SUPABASE_URL VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY; do
  if grep -q "^${key}=" .env 2>/dev/null; then ok "local .env has $key"; else bad "local .env missing $key"; fi
done

echo ""
echo "=== Fly secrets (hot-honey) ==="
LIST="$(fly secrets list -a "$APP" 2>/dev/null || true)"
for key in SUPABASE_SERVICE_KEY VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY SUPABASE_URL; do
  if echo "$LIST" | grep -q "$key"; then ok "Fly has secret $key"; else bad "Fly missing secret $key"; fi
done
if echo "$LIST" | grep -q "not deployed"; then
  warn "Some Fly secrets are staged — run: fly secrets deploy -a $APP"
fi

echo ""
echo "=== Fly runtime env (public keys only) ==="
ENV_JSON="$(curl -fsS "https://${APP}.fly.dev/ping" 2>/dev/null || echo '{}')"
ok "Fly /ping reachable"

echo ""
echo "=== Prod API OAuth endpoints ==="
CB="$(curl -sI "${ORIGIN}/api/auth/supabase/callback?code=test" | head -1)"
echo "    callback: $CB"
if echo "$CB" | grep -q "302"; then ok "callback returns 302"; else bad "callback not redirecting"; fi

SYNC="$(curl -s -o /tmp/sync-out.json -w '%{http_code}' -X POST "${ORIGIN}/api/auth/sync-supabase" \
  -H 'Content-Type: application/json' \
  -d '{"access_token":""}')"
if [[ "$SYNC" == "400" ]]; then ok "sync-supabase rejects empty token (400)"; else bad "sync-supabase unexpected status $SYNC"; fi

echo ""
echo "=== Prod frontend OAuth assets ==="
HTML="$(curl -fsS "$ORIGIN/" 2>/dev/null || true)"
if echo "$HTML" | grep -q "pythh-oauth-hash-sync.js"; then
  ok "index.html loads pythh-oauth-hash-sync.js"
else
  bad "index.html missing pythh-oauth-hash-sync.js (Vercel not deployed yet)"
fi
HASH_JS="$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN/pythh-oauth-hash-sync.js")"
if [[ "$HASH_JS" == "200" ]]; then ok "pythh-oauth-hash-sync.js served"; else bad "hash-sync HTTP $HASH_JS"; fi

exit "$fail"
