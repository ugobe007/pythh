# Batch jobs (GitHub Actions)

Production batch work is **not** run on Fly. Fly (`hot-honey`) serves the API + SPA shell only. All scheduled workers run as **GitHub Actions** workflows against Supabase.

## Architecture

| Tier | Host | Role |
|------|------|------|
| Frontend | Vercel | Static SPA; `/api/*` proxied to Fly |
| API | Fly (1× machine) | `npx tsx server/index.js` — request path only |
| Batch | GitHub Actions | Scrapers, scoring, matching, portfolio, social |
| Data | Supabase | Shared database |

## Reusable runner

Most jobs call [`.github/workflows/reusable-node-batch.yml`](../.github/workflows/reusable-node-batch.yml) with `secrets: inherit`.

Required repo secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (aliases: `VITE_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`).

Optional: `OPENAI_API_KEY`, `RESEND_API_KEY`, `PORTFOLIO_DIGEST_EMAIL`, social platform tokens (see `batch-social-poster.yml`).

## Schedule map

| Workflow | Schedule (UTC) | Script / job |
|----------|----------------|--------------|
| [automated-scraper.yml](../.github/workflows/automated-scraper.yml) | Every 12h | SSOT RSS scraper + ML ontology + RSS enrich |
| [god-score-recalculation.yml](../.github/workflows/god-score-recalculation.yml) | Every 2h | `scripts/recalculate-scores.ts` |
| [god-score-monitor.yml](../.github/workflows/god-score-monitor.yml) | Every 2h :05 | Score monitor |
| [god-score-health-check.yml](../.github/workflows/god-score-health-check.yml) | Every 6h | Health check |
| [enrich-vcs.yml](../.github/workflows/enrich-vcs.yml) | Daily 03:00 | VC/investor enrichment |
| [batch-startup-enrichment.yml](../.github/workflows/batch-startup-enrichment.yml) | Every 6h | Sparse startup enrich |
| [batch-platform-daily.yml](../.github/workflows/batch-platform-daily.yml) | 03:00 | Holding review worker |
| | 04:00 | Oracle signal backfill |
| | 05:00 | RSS enrich (M&A + funding) |
| | 06:00 | Portfolio monitor |
| | 06:30 | Portfolio digest email |
| [batch-platform-weekly.yml](../.github/workflows/batch-platform-weekly.yml) | Sun 02:00 | Full match regen |
| | Wed 02:00 | Social signals fetcher |
| | Mon 07:00 | Portfolio signal refresh |
| | Mon 08:00 | Portfolio funding verification |
| [batch-match-engine.yml](../.github/workflows/batch-match-engine.yml) | Every 15 min | Match run worker (queued runs) |
| | Every 2 days 03:00 | Delta match regen |
| [batch-social-poster.yml](../.github/workflows/batch-social-poster.yml) | Mon/Wed/Fri 09:00 | LinkedIn/X/Threads poster |
| [cleanup.yml](../.github/workflows/cleanup.yml) | Monthly | DB cleanup |

## Manual runs

Each batch workflow supports **workflow_dispatch** with a job picker where applicable. Use the Actions tab in GitHub to re-run a single job.

## Local development

Full PM2 stack (all workers): `pm2 start ecosystem.config.js` on your machine. This is for dev/debug only — do not mirror on Fly.

## Adding a new batch job

1. Add a job to an existing schedule workflow, or create a new workflow calling `reusable-node-batch.yml`.
2. Document the schedule in this file.
3. Do **not** add PM2 cron entries to `ecosystem.prod.config.js`.
