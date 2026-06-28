# Pythh.ai (hot-honey) — Cursor Copilot Handoff

**Repo:** `hot-honey` (this workspace)  
**Production site:** https://pythh.ai  
**Prepared:** May 2026 · **Updated:** June 2026

This document is the **source of truth for shipping pythh.ai from this repository**.

---

## 1. What this repo is (production)

| Layer | Where it runs | Role |
|--------|----------------|------|
| **Frontend** | **Vercel** | Vite build from **`site/`** → `dist/`. SPA routes → `index.html`. |
| **API proxy** | **Vercel** | `vercel.json` rewrites `/api/:path*` → `https://hot-honey.fly.dev/api/:path*` |
| **Backend** | **Fly.io** (`hot-honey`) | Node: `server/index.js` (via `tsx`), port **8080**. Serves API + `dist/` + tRPC from `site/`. |
| **Database / auth** | **Supabase** | Postgres + Auth. Server uses **service role** for admin routes. |

**Important:** Local `.env` is **not** deployed. Fly needs **`fly secrets set SUPABASE_SERVICE_KEY=...`**.

### 1.1 Frontend layout (read this first)

| Path | Status |
|------|--------|
| **`site/`** | **Production pythh.ai UI** — Vite root (`vite.config.ts`), all public routes (`/art`, `/activate`, `/matches`, …), tRPC client + `routers.ts`. |
| **`src/`** | **Legacy frontend** — older react-router app; **not built** for pythh.ai. Kept for admin/reference; do not add new product features here. |
| **`server/`** | **Shared backend** — Express API used by `site/` and cron/scripts. |

**Copilot rule:** New UI work → **`site/`** + **`server/`**. Only touch **`src/`** for legacy admin pages or explicit migration tasks.

### 1.2 Key files (production)

| Area | Path |
|------|------|
| Routes | `site/App.tsx` |
| Home / hero | `site/Home.tsx` |
| Signal Art | `site/pages/Art.tsx` |
| API base URL | `site/lib/apiConfig.ts` |
| tRPC router | `site/routers.ts`, `site/artRouter.ts`, … |
| Vite config | `vite.config.ts` (root → `site/`) |
| Vercel rewrites | `vercel.json` |
| Express monolith | `server/index.js` |
| Art generation | `server/lib/pythhArtGenerator.js` |

### 1.3 Commands

```bash
npm install
npm run dev:all     # Vite (site/) + API localhost:3002
npm run build       # dist/ from site/
fly deploy          # API + embedded dist
```

---

## 2. Legacy: `src/`

`src/` is the **pre-redesign** hot-honey React app (`react-router-dom`, `/signal-matches`, old admin tools). Root `index.html` + `/src/main.tsx` belong to this stack and are **not** the Vercel build entry.

Do not confuse with **`site/`**, which is what users see on pythh.ai today.

---

## 3. Nested handoff

| Document | Purpose |
|----------|---------|
| `site/Pythh.ai — Cursor Copilot Handoff.md` | Deeper product/stack notes (PYTHIA, plans, tRPC patterns) |
| `site/README.md` | Quick orientation for the production frontend folder |

---

## 4. Open follow-ups (optional)

- Retire or archive unused `src/` routes once parity is confirmed.
- After DB changes: apply Supabase migrations before deploy.

---

*End of handoff.*
