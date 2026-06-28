# site/ — pythh.ai production frontend

This folder is the **live pythh.ai UI**. Vite builds it to repo-root `dist/` (see `vite.config.ts`).

| | |
|---|---|
| **Routes** | `App.tsx` (wouter) |
| **API client** | `lib/trpc.ts`, `lib/apiConfig.ts` |
| **Auth** | `pages/Login.tsx`, `context.ts`, `pythh_session` cookie |
| **tRPC server** | `routers.ts` — mounted at `/api/trpc` from `server/index.js` |

**Not here:** `src/` at repo root is the legacy frontend (not shipped). Backend lives in `server/`.

```bash
npm run dev          # Vite only (proxies /api → localhost:3002)
npm run dev:all      # Vite + Express
```
