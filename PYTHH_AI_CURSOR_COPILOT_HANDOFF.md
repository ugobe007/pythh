# Pythh.ai (hot-honey) — Cursor Copilot Handoff

**Repo:** `hot-honey` (this workspace)  
**Production site:** https://pythh.ai  
**Prepared:** May 2026

This document is the **source of truth for shipping pythh.ai from this repository**.  
For the **parallel redesign / prototype bundle** under `NEW_pythh_site/`, see [§2 Parallel: `NEW_pythh_site`](#2-parallel-new_pythh_site) and the nested handoff there.

---

## 1. What this repo is (production)

| Layer | Where it runs | Role |
|--------|----------------|------|
| **Frontend** | **Vercel** | Static Vite build (`dist/`). SPA routes → `index.html`. |
| **API proxy** | **Vercel** | `vercel.json` rewrites `/api/:path*` → `https://hot-honey.fly.dev/api/:path*` so the browser uses **same-origin** `/api/...` on pythh.ai (avoids CORS noise on Fly 502/503). |
| **Backend** | **Fly.io** (`hot-honey`) | Node: `server/index.js` (via `tsx`), port **8080**, `/ping` health check. Serves API + can serve `dist` in image. |
| **Database / auth** | **Supabase** | Postgres + Auth. Server uses **service role** for admin routes and `ai_logs` batch insert. |

**Important:** Local `.env` is **not** deployed to Fly or Vercel. Fly needs **`fly secrets set SUPABASE_SERVICE_KEY=...`** (service_role JWT). Without it, the server falls back to anon/publishable keys and `/api/admin/*` often returns **503** (backoff) or fails RPCs.

### 1.1 Key files (production)

| Area | Path |
|------|------|
| Home / hero copy | `src/pages/PythhMain.tsx`, `src/components/pythh/PythhWhatYouGet.tsx` |
| API base URL (browser) | `src/lib/apiConfig.ts` — on `pythh.ai` / `www.pythh.ai`, strips `*.fly.dev` from `VITE_API_URL` so calls stay same-origin. |
| Vercel rewrites | `vercel.json` |
| Fly app config | `fly.toml` (public Supabase URL + anon in `[env]`; **secrets** for service key) |
| Express monolith | `server/index.js` (admin routes, analytics flush, CORS, Supabase backoff cache) |
| Server Supabase client | `server/lib/supabaseClient.js` |
| Analytics flush + RLS | `src/lib/analytics.ts` — prod uses `POST /api/analytics/flush` only; no browser `ai_logs` insert in prod. |

### 1.2 Environment (mental model)

- **Vercel:** `VITE_*` at **build** time. Prefer `VITE_API_URL` empty or same-origin-friendly; `apiConfig` handles pythh.ai + Fly URL combo.
- **Fly:** Runtime `SUPABASE_URL`, **`SUPABASE_SERVICE_KEY`** (required for admin), optional `CORS_EXTRA_ORIGINS` for preview hosts.
- **Do not** commit real `.env` secrets; rotate if ever leaked.

### 1.3 Commands

```bash
npm install
npm run dev          # Vite (frontend); API often localhost:3002 if you run server separately
npm run build        # dist/ for Vercel / Fly image
# Fly: fly deploy, fly logs -a hot-honey, fly secrets list
```

### 1.4 Product copy hierarchy (home hero)

Implemented in **`PythhWhatYouGet`** (workflow strip, “What founders get”, evidence / action / ultimate goal lines). SEO description aligned in **`PythhMain.tsx`** `<SEO />`.

---

## 2. Parallel: `NEW_pythh_site/`

`NEW_pythh_site/` holds a **separate product sketch** (React/tRPC/Drizzle-style layout, Stripe, “PYTHIA” naming). It is **not** wired as the live Vercel build root for pythh.ai today; treat it as **reference / future merge** unless you explicitly switch the build.

| Document | Purpose |
|----------|---------|
| `NEW_pythh_site/Pythh.ai — Cursor Copilot Handoff.md` | Deep handoff for that **prototype stack** (tRPC, TiDB, Manus OAuth, etc.). |
| `NEW_pythh_site/*.tsx` | Standalone-style files; paths do not match `src/` layout of hot-honey. |

**Copilot rule of thumb:** If the task says “production pythh.ai” → edit **`src/`** + **`server/`** in repo root. If the task says “redesign / NEW_pythh_site” → work under **`NEW_pythh_site/`** and reconcile merge separately.

---

## 3. Duplicate handoff at repo root (legacy)

The file **`Pythh.ai — Cursor Copilot Handoff`** (no `.md` extension) in the repo root duplicates the **NEW_pythh_site** prototype handoff. Prefer **`PYTHH_AI_CURSOR_COPILOT_HANDOFF.md`** (this file) for **hot-honey production**. Optionally delete or replace that extensionless file with a one-line pointer to this doc to avoid confusion.

---

## 4. Open follow-ups (optional)

- Preview deployments on non-`pythh.ai` hosts: ensure Fly **`CORS_EXTRA_ORIGINS`** includes Vercel preview URLs if the SPA ever calls Fly directly.
- After major DB changes: apply Supabase migrations; admin RPCs in `server/index.js` reference specific migration names in comments when missing.

---

*End of handoff.*
