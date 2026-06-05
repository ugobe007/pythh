#!/usr/bin/env bash
# Deploy OAuth fixes: Fly API (supabaseAuthSync) + Vercel frontend (hash sync script).
# Usage: ./scripts/deploy-oauth.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
APP="hot-honey"
ORIGIN="${SMOKE_ORIGIN:-https://pythh.ai}"

echo "==> 1/5 Fly secrets (activate staged secrets incl. SUPABASE_SERVICE_KEY)"
fly secrets deploy -a "$APP"

echo "==> 2/5 Fly deploy (server/routes/supabaseAuthSync.js + API)"
fly deploy -a "$APP" --ha=false

echo "==> 3/5 Git push main (triggers Vercel if repo is connected)"
if git diff --quiet && git diff --cached --quiet; then
  echo "    (no uncommitted changes — pushing current HEAD)"
else
  echo "    ERROR: commit OAuth changes before running this script."
  exit 1
fi
git push origin main

echo "==> 4/5 Wait for Vercel static deploy (hash-sync.js + index.html)"
for i in $(seq 1 36); do
  HTML="$(curl -fsS "$ORIGIN/" 2>/dev/null || true)"
  if echo "$HTML" | grep -q "pythh-oauth-hash-sync.js"; then
    echo "    Vercel deploy detected (pythh-oauth-hash-sync.js in index.html)"
    break
  fi
  if [[ "$i" -eq 36 ]]; then
    echo "    WARN: Vercel may still be building — run: npm run test:oauth-smoke"
  else
    echo "    waiting... ($i/36)"
    sleep 10
  fi
done

echo "==> 5/5 OAuth smoke tests"
npm run test:oauth-smoke

echo "==> Done. Try Google login at $ORIGIN/login"
