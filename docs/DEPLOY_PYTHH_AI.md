# Deploy pythh.ai (frontend on Vercel)

**Architecture (2026-08):** `pythh.ai` DNS → **Vercel** serves the Vite **`dist/`** SPA (`vercel.json` `outputDirectory: dist`). `/api/*` rewrites to **`https://hot-honey.fly.dev`**. Fly also builds `dist/` on every `main` push (API + embedded assets); Vercel is the canonical edge for `pythh.ai`.

| Layer | Deploy trigger | Verify |
|--------|----------------|--------|
| Frontend (pythh.ai) | `.github/workflows/vercel-deploy.yml` on push to `main` | `npm run check:deploy-cache` + `npm run check:deploy-sha` |
| API | `.github/workflows/fly-deploy.yml` on push to `main` | `curl -s https://hot-honey.fly.dev/ping` |

**Project:** Vercel **pythh** (not legacy **hot-money-honey**). Dashboard: [pythh deployments](https://vercel.com/ugobe07-gmailcoms-projects/pythh/deployments).

## Verify production

```bash
npm run check:deploy-cache    # homepage OK, not Fly placeholder
npm run check:deploy-sha      # pythh-build meta vs git HEAD (or EXPECTED_SHA)
curl -s "https://pythh.ai/" | grep pythh-build
open "https://pythh.ai/signup/investor"
```

`pythh-build` is injected at build time in `vite.config.ts` from `VERCEL_GIT_COMMIT_SHA` (or `GITHUB_SHA`).

## Dual deploy paths (important)

Two systems can both deploy **production** for the same merge:

1. **GitHub Actions** — `vercel deploy --prod` with `VERCEL_GIT_COMMIT_SHA=${GITHUB_SHA}` (merge commit).
2. **Vercel Git integration** — auto-build on push to `main` (may stamp the **feature-branch tip** SHA into `pythh-build` even when the tree matches `main`).

They race on every merge. Symptom: `check:deploy-sha` fails on merge SHA while **code is current** (same Git tree). Fix: workflow passes `--build-env VERCEL_GIT_COMMIT_SHA=$GITHUB_SHA`; prefer **disabling Vercel Git production auto-deploy** so only GHA promotes prod (Settings → Git → Production Branch, or Ignored Build Step).

## GHA Vercel workflow status (merge PRs)

Tracked from [Vercel Deploy workflow](https://github.com/ugobe007/pythh/actions/workflows/vercel-deploy.yml). **Failed/cancelled rows did not leave `main` behind** once a later successful deploy ran on cumulative `main`.

| Status | Merge PRs | Notes |
|--------|-----------|--------|
| **Success (prod path working)** | **#23–#50** | Each merge deployed; Fly + Vercel GHA both green on #50 |
| **Failed GHA only** | **#3–#22** (incl. duplicate #21/#22 reconcile) | Workflow failed; code still on `main` and shipped when **#23** first succeeded |
| **Failed GHA** | **#20** match-outcome-agent | Same — rolled into #23+ cumulative build |
| **Cancelled** | **#14, #18** (+ older pre-PR pushes) | Superseded by later merges |

**Current production (2026-08-22, after PR #50):**

- `main` HEAD: `3bde622d` (merge #50).
- Live `pythh-build`: `c0a92c25` (#50 feature tip — **same tree** as merge).
- **Hit@5 ops scripts are not gated on Vercel**; PR #50 backend/data changes are live via Fly + DB scripts you already ran.

## If pythh.ai looks stale

1. Confirm GHA: latest [Vercel Deploy](https://github.com/ugobe007/pythh/actions/workflows/vercel-deploy.yml) + [Fly Deploy](https://github.com/ugobe007/pythh/actions/workflows/fly-deploy.yml) succeeded on `main`.
2. `npm run check:deploy-cache` — asset hash on pythh.ai should not be a placeholder.
3. Vercel → **pythh** → Deployments → Production → Redeploy latest `main` (or wait for next push).
4. If SHA meta drifts but tree matches, `check:deploy-sha` still passes after tree-equivalence check; redeploy via GHA fixes the meta stamp.

## GitHub secrets (Vercel workflow)

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | CLI deploy |
| `VERCEL_ORG_ID` | `team_i9wBQr2ur295OmAB8COX5Q0r` |
| `VERCEL_PROJECT_ID` | `prj_BmDVCcXOsQrTW5iZCxiU1Mmo1vuW` |
| `VERCEL_DEPLOY_HOOK` | Optional CLI fallback |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Embedded anon config in `index.html` |

Preflight: `node scripts/verify-vercel-project.mjs` (also runs in CI).

## Optional: Deploy Hook only

If you disable GHA and use hooks only: Vercel → **pythh** → **Deploy Hooks** → `main`; set `VERCEL_DEPLOY_HOOK` in GitHub. Do **not** use project **hot-money-honey**.
