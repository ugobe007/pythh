# Scraper Review

## Overview

Scrapers and ingestion jobs in `ecosystem.config.js`, what they write, and how health is measured.

---

## Scraper / ingestion jobs

| Process | Script | Schedule | Writes to | Purpose |
|--------|--------|----------|-----------|---------|
| **rss-scraper** | `ssot-rss-scraper.js` | Every 30 min | `startup_events`, `startup_uploads` (new), `rss_sources` (read) | SSOT RSS: parse feeds → events, create/join startups. Does **not** write to `rss_articles` or `scraper_logs`. |
| **simple-rss-discovery** | `simple-rss-scraper.js` | Every 2h | `discovered_startups` | Legacy RSS: extract startups from feeds → discovered_startups. Does **not** write to `rss_articles` or `scraper_logs`. |
| **enrich-from-rss-news** | `enrich-from-rss-news.js` | Every 4h at :25 | `startup_uploads.extracted_data` (web_signals) | Match `startup_events` to startups, merge press/funding into profiles. |
| **html-scraper** | `html-startup-scraper.js` | Every 6h | (see script) | University/accelerator pages (YC, Princeton, etc.). |
| **event-rescue-agent** | `event-rescue-agent.js` | Every 30 min | (rescues events) | Reclassify misclassified events. |
| **auto-import-pipeline** | `auto-import-pipeline.js` | Every hour at :15 | `startup_uploads`, matching queue | `discovered_startups` → `startup_uploads` with quality filter + GOD score. |
| **match-worker** | (queue processor) | Every 5 min | `startup_investor_matches` | Generate matches for queued startups. |
| **vc-team-scraper** | `vc-team-scraper.js` | Every 6h | (investors) | VC team data. |
| **social-signals-scraper** | `social-signals-scraper.js` | Every 4h | (social signals) | Reddit/HN/social mentions. |

---

## Health check vs reality

**`scripts/comprehensive-system-health-check.js`** currently checks:

- **scraper_logs** (last 24h) — WARNING if 0  
- **rss_articles** (last 24h) — WARNING if 0  
- **discovered_startups** (last 24h) — WARNING if 0  
- **scraper_jobs** (last 24h)

**Gap:** The main RSS scrapers do **not** write to `scraper_logs` or `rss_articles`:

- **ssot-rss-scraper** writes to `startup_events` and `startup_uploads`.
- **simple-rss-scraper** writes to `discovered_startups`.

So “No scraper logs” and “No RSS articles” are expected unless another pipeline (e.g. NewsScraper / VC news jobs) populates those tables.

---

## Recommendations

1. **Align health check with actual writers**  
   - Add checks for **startup_events** (last 24h or 7d) and optionally **discovered_startups** (last 24h).  
   - Treat `scraper_logs` and `rss_articles` as optional / legacy, or document which process is supposed to fill them.

2. **Single source of RSS truth**  
   - **ssot-rss-scraper** is the main feed: `rss_sources` → `startup_events` → `startup_uploads`.  
   - **simple-rss-scraper** is a second path into `discovered_startups` → later **auto-import-pipeline**.  
   - Decide whether both are needed long term or one should be deprecated.

3. **Monitoring**  
   - Ensure PM2/cron is running on the host (e.g. Fly) so `rss-scraper` and `simple-rss-discovery` run on schedule.  
   - Optional: log run count or last run time to `ai_logs` or a small `scraper_runs` table for dashboards.

4. **rss_articles / scraper_logs**  
   - If nothing is supposed to write there, remove or relax those health checks.  
   - If a separate “news” or “VC news” job is supposed to fill them, add that job to this doc and to the health check.

---

## Quick reference: where data comes from

- **startup_events** ← rss-scraper (ssot-rss-scraper)
- **discovered_startups** ← simple-rss-discovery, possibly html-scraper
- **startup_uploads** (new rows) ← rss-scraper (from events), auto-import-pipeline (from discovered_startups)
- **startup_uploads** (enrichment) ← enrich-from-rss-news, enrich-web-signals, etc.
