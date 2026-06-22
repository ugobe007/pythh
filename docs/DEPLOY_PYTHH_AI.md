# Deploy pythh.ai (Vercel frontend)

**Symptom:** `curl -s https://pythh.ai/ | grep pythh-build` shows an old SHA (e.g. `10d36fec…`) while `main` is ahead → SPA routes like `/signup/investor` 404 in-app.

**Cause:** GitHub Actions deploys to the wrong Vercel project, or the domain is not aliased to the latest production deployment.

## Fix (recommended): Deploy Hook on the **pythh** project

1. [Vercel](https://vercel.com) → project **`pythh`** (must list **pythh.ai** under Domains).
2. **Settings → Git → Deploy Hooks** → Create hook → branch **main** → copy URL.
3. GitHub → **ugobe007/pythh** → **Settings → Secrets → Actions** → add:
   - `VERCEL_DEPLOY_HOOK` = hook URL from step 2
   - `VERCEL_PROJECT_ID` = **this project's** Project ID (Settings → General)
   - `VERCEL_ORG_ID` = Team ID
   - `VERCEL_TOKEN` = [account token](https://vercel.com/account/tokens)
4. **Actions → Vercel Deploy → Run workflow** on `main`.

The workflow prefers the deploy hook (always hits the project that owns the domain), then falls back to CLI.

## Verify

```bash
curl -s "https://pythh.ai/" | grep pythh-build
# should match latest main commit (see GitHub Actions run)

node scripts/check-pythh-frontend-deploy.mjs
open "https://pythh.ai/signup/investor"
```

## Do not use

- Vercel project **hot-money-honey** — legacy; does not serve pythh.ai.
- Root `node pipeline-weekly-dashboard.mjs` — use `node scripts/pipeline-weekly-dashboard.mjs`.
