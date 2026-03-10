# Scrapers, Scheduling & Email Guide

> Answers to: scraper success rates, scheduling strategy, ML integration, and reducing email noise.

---

## 1. How Scrapers Work & Success Tracking

### Scraper Types

| Scraper | Schedule | Purpose | Output |
|---------|----------|---------|--------|
| **rss-scraper** (SSOT) | Every 15 min | RSS feeds → events, graph joins | `rss_events`, `rss_sources` |
| **simple-rss-discovery** | Every 2 h | Simple RSS → discovered_startups | `discovered_startups` |
| **html-scraper** | Every 6 h | YC, universities, accelerators | Startup records |
| **high-volume-discovery** | Every 2 h | AI extraction from 65+ RSS + Google News | 200+ startups/day target |
| **vc-team-scraper** | Every 6 h | VC firm team pages | Investor records |
| **social-signals-scraper** | Every 4 h | Reddit, HN, Twitter, ProductHunt | Psych/sentiment signals |
| **auto-import-pipeline** | Hourly | discovered_startups → startup_uploads | Imports + GOD scores |

### Success / Failure Tracking

- **`rss_sources` table**: `last_scraped`, `total_discoveries`, `avg_yield_per_scrape`, `consecutive_failures`
- **`ai_logs` table**: Logs from `rss_scraper`, `god-score-monitor`, `enrich_health_check`, `alerts_sweep`, `digest_sweep`
- **Adaptive backoff**: SSOT scraper skips failing sources; backoff increases with `consecutive_failures`

### Where to Check Success Rate

```sql
-- RSS source health
SELECT url, last_scraped, total_discoveries, avg_yield_per_scrape, consecutive_failures 
FROM rss_sources 
ORDER BY consecutive_failures DESC, last_scraped ASC;

-- Recent ai_logs (scraper, GOD, enrich)
SELECT agent_name, action, created_at, details 
FROM ai_logs 
WHERE agent_name IN ('rss_scraper', 'god-score-monitor', 'enrich_health_check') 
ORDER BY created_at DESC LIMIT 50;
```

**No built-in scraper “success rate” dashboard exists** — metrics are in DB. Consider adding a lightweight `/api/admin/scraper-stats` endpoint that aggregates `rss_sources` and `ai_logs`.

---

## 2. Scheduling: Continuous vs Controlled

### Current Schedule (ecosystem.config.js)

| Job | Interval | Notes |
|-----|----------|-------|
| rss-scraper | 15 min | High frequency — core discovery |
| match-worker | 2 min | Very frequent — processes match queue |
| event-rescue-agent | 30 min | Self-healing |
| pythh-url-monitor | 5 min | Health checks |
| system-guardian | 10 min | Process watchdog |
| score-recalc | 2 h | GOD score recalculation |
| ML training, Pythia, enrichment | 2 h | Staggered (:00, :15, :30, :45) |
| signal-scoring, market-signals | 6 h | Heavier work |

### Recommendations

| Change | Rationale |
|--------|-----------|
| **Slow RSS scraper to 30–60 min** | 15 min is aggressive; RSS feeds rarely update faster. Reduces load and noise. |
| **Match-worker: 5 min** | 2 min may be overkill if queue is small; 5 min still responsive. |
| **GOD / ML / Pythia: keep 2 h** | Good balance. Staggering (:00, :15, :30, :45) avoids thundering herd. |
| **Daily jobs (holding-review, oracle-backfill, junk-cleanup)** | Keep daily; timing is fine. |

### Suggested Cron Changes (ecosystem.config.js)

```javascript
// rss-scraper: 15 min → 30 min
cron_restart: '*/30 * * * *',

// match-worker: 2 min → 5 min
cron_restart: '*/5 * * * *',
```

---

## 3. ML Integration & Data Flow

### Data Flow

```
Scrapers (RSS, HTML, social)
    → discovered_startups / rss_events / startup_uploads
    → startupScoringService.ts (GOD score)
    → score_history, startup_uploads.total_god_score
    → run-ml-training.js (every 2 h)
    → ml_recommendations, algorithm_metrics
    → ml-auto-apply.js (every 2 h) → algorithm_metrics
    → startupScoringService (reads componentWeights)
```

### ML Components

| Component | Schedule | Purpose |
|-----------|----------|---------|
| **ml-training-scheduler** | Every 2 h | GOD distributions, data quality → `ml_recommendations` |
| **ml-auto-apply** | Every 2 h (:30) | Applies high-confidence ML recs to `algorithm_metrics` |
| **ml-ontology-agent** | Every 6 h | Entity classification (sectors, stages) |
| **Pythia** (collect → score → sync) | Every 2 h (:15, :30, :45) | Forum signals → GOD bonus |

### Adjustments to Consider

1. **Scraper → ML lag**: New startups need enrichment + GOD score before ML sees them. Auto-import runs hourly; score-recalc every 2 h. Gap is acceptable.
2. **ML training inputs**: Uses GOD scores, startup quality, match coverage. No direct scraper output — all via `startup_uploads` and scoring.
3. **Pythia**: Separate pipeline for forum signals; syncs into startup data. Ensure `pythia-sync` runs after `pythia-scorer` (it does — :45 after :30).

---

## 4. Email Notifications — Reducing Noise

### Current Email Triggers

| Source | Frequency | Recipient | Notes |
|--------|-----------|-----------|-------|
| **Alerts sweep** | 15 min (creates notifications) | Elite users | Emails only when `deliverPendingAlertEmails` runs (admin endpoint) |
| **Daily digest** | 5 min check, 1×/user/day | Elite users | Sends when user's local time matches `digest_time_local` |
| **daily-health-email.js** | If in cron (e.g. 9 AM) | `ALERT_EMAIL` | Health metrics, GOD scores, scraper activity |
| **daily-report.ts** | If in cron | `ALERT_EMAIL` | Full daily report |
| **emailNotifications.ts** | On events | `ADMIN_EMAIL` | `notifyPendingStartups`, `notifyScraperComplete`, `sendWeeklyDigest` (if invoked) |

### Likely Cause of "All Day" Emails

1. **`ALERT_EMAIL` / `ADMIN_EMAIL`** — If `daily-health-email.js` or `daily-report.ts` is in a **frequent** cron (e.g. every 2 h instead of daily), you get many admin emails.
2. **Digest sweep** — Runs every 5 min. If `digest_time_local` is misconfigured or timezone handling is off, digests might fire more than once per day for some users.
3. **ScriptsControlPanel** — Manually running "Health Email" or "Daily Report" repeatedly.

### Fixes

#### A. Check System Cron

```bash
# On the server / Fly.io
crontab -l
# Look for: daily-health-email, daily-report
# They should run once daily (e.g. 0 9 * * *)
# If you see */2 or similar, that's the problem.
```

#### B. Consolidate Admin Emails

- **Option 1**: One daily admin digest (e.g. 9 AM) — merge health + report.
- **Option 2**: Disable `daily-health-email` and `daily-report` email, use `ai_logs` + a weekly summary instead.
- **Option 3**: Add `DRY_RUN` or `EMAIL_ENABLED=false` env var to skip sending during testing.

#### C. Reduce Digest Frequency

- Daily digest check: change from every 5 min to every 30 min.
- Or only run digest logic 2–3 times per day (e.g. 8:00, 12:00, 18:00) to catch different timezones.

#### D. Verify `notifyScraperComplete` Usage

`emailNotifications.notifyScraperComplete` exists but **is not called** by current scraper code. If you added calls per scraper run, that would flood inbox — remove or gate behind a daily summary.

---

## 5. Quick Reference

### Key Files

| Area | File |
|------|------|
| PM2 schedule | `ecosystem.config.js` |
| RSS success tracking | `scripts/core/ssot-rss-scraper.js` (rss_sources updates) |
| GOD score | `scripts/recalculate-scores.ts`, `server/services/startupScoringService.ts` |
| ML training | `run-ml-training.js`, `ml-auto-apply.js` |
| Admin emails | `scripts/daily-health-email.js`, `scripts/daily-report.ts`, `server/services/emailNotifications.ts` |
| User alerts/digest | `server/index.js` (alerts sweep, digest delivery) |

### Env Vars for Emails

- `ALERT_EMAIL` — Who gets health/daily report emails
- `ADMIN_EMAIL` — Who gets startup/scraper admin notifications
- `RESEND_API_KEY` — Required for sending
- **`ADMIN_EMAIL_ENABLED`** — Set to `false` or `0` to disable all admin-targeted emails (health, daily report, pending startups, scraper complete). Reduces inbox noise. Default: enabled.

### Suggested Next Steps

1. **Inspect cron** — Ensure health/report scripts run once daily, not every few hours.
2. **Slow down** — RSS to 30 min, match-worker to 5 min.
3. **Add scraper stats API** — `/api/admin/scraper-stats` for visibility.
4. **Email consolidation** — Single daily admin digest, or disable and rely on `ai_logs` + dashboards.
