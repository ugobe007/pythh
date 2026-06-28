# Repository layout

| Path | Purpose |
|------|---------|
| **`site/`** | Production pythh.ai frontend (Vite → `dist/`) |
| **`server/`** | Express API, art generation, cron scripts |
| **`public/`** | Static assets (`/art`, images) |
| **`supabase/`** | Database migrations |
| **`agents/`** | Growth/product agent specs and queues |
| **`docs/`** | Active documentation + `docs/archive/` for old reports |
| **`src/`** | Legacy frontend — see `src/LEGACY.md` (not deployed) |
| **`scripts/`** | CLI utilities and batch jobs |

See `PYTHH_AI_CURSOR_COPILOT_HANDOFF.md` for deploy and env setup.
