# Deploy pythh.ai (frontend)

**Architecture (2026-06):** `pythh.ai` DNS → Vercel edge → **proxies to `hot-honey.fly.dev`** for all routes. Fly builds `dist/` on every push to `main` (GitHub Actions `Fly Deploy`). Vercel no longer serves a stale static bundle.

## Verify

```bash
curl -s "https://pythh.ai/assets/" | head -1   # should hit Fly asset hashes (not index-pZQtM62L.js)
curl -s "https://hot-honey.fly.dev/assets/" | head -1
npm run check:pythh-frontend   # compares ai_logs / fly bundle when pythh-build meta missing on proxy
open "https://pythh.ai/signup/investor"
```

## If pythh.ai still shows old routes

1. **Vercel** → project with **pythh.ai** domain → **Deployments → Redeploy** (picks up `vercel.json` rewrites).
2. Or **Settings → Git** → confirm repo `ugobe007/pythh` is connected and redeploy latest `main`.
3. Confirm **Fly** is fresh: `curl -sI https://hot-honey.fly.dev/ping` and check [Fly Deploy workflow](https://github.com/ugobe007/pythh/actions/workflows/fly-deploy.yml).

## Optional: Deploy Hook (legacy CLI path)

If you disable Fly proxy and return to Vercel static builds:

1. Vercel → **pythh** project → **Deploy Hooks** → create hook for `main`.
2. GitHub secret `VERCEL_DEPLOY_HOOK` + correct `VERCEL_PROJECT_ID`.

Do **not** use project **hot-money-honey** — it does not own pythh.ai.
