# Pythh — AI coding agent instructions

## Project overview

**Pythh** ([pythh.ai](https://pythh.ai)) is a startup–investor intelligence platform: React/TypeScript (Vite) plus a Node/Express API. Core matching uses the **GOD** scoring stack and Supabase (PostgreSQL). Canonical project facts: [`docs/PYTHH_PROJECT.md`](../docs/PYTHH_PROJECT.md).

## Architecture

### Frontend (Vite + React)
- Entry: [`src/App.tsx`](../src/App.tsx) — routes
- Supabase client: [`src/lib/supabase.ts`](../src/lib/supabase.ts)

### Backend
- Express: [`server/index.js`](../server/index.js) — API, uploads, integrations
- Env: [`.env.example`](../.env.example) — use `APP_URL` / `APP_BASE_URL` for production links (`https://pythh.ai`)

### Data
- Supabase project ref: `unkpogyhhjbvxxjvmxlt` (see `PYTHH_PROJECT.md`)

## Critical patterns
- Prefer **Pythh** / **pythh.ai** in user-facing copy. Legacy docs may say “Hot Honey”; product name is Pythh.
- Fly app name may remain `hot-honey` in [`fly.toml`](../fly.toml); public URL is still **pythh.ai** when configured.
