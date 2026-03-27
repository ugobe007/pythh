# Lookup Growth and Reliability Runbook

## SLO Targets

- API uptime (`/api/health`): `>= 99.9%` monthly
- Lookup route availability (`/lookup`): `>= 99.9%` monthly
- Lookup response p95 (`/lookup` TTFB): `< 400ms`
- Critical RPC error rate (`get_sector_heat`, `get_startup_context`): `< 1%`
- Deploy check pass rate (`scripts/post-deploy-health-check.js`): `100%`

## Alerting Triggers

- `/api/health` non-200 for 2 consecutive checks
- `/lookup` non-200 for 2 consecutive checks
- `status != healthy` from `/api/health/deep`
- RPC error rate exceeds 1% in trailing 15 minutes
- Post-deploy checks fail on any release

## Canonical Analytics Pipeline

Use `src/lib/analytics.ts` as the only client analytics writer. Funnel events:

- `lookup_industry_selected`
- `lookup_top10_generated`
- `lookup_signup_cta_clicked`
- `lookup_signup_completed`
- `lookup_first_outreach_started`
- `lookup_save_list_clicked`
- `lookup_feedback_submitted`

`src/analytics.ts` now proxies to this canonical pipeline for backward compatibility.

## Weekly Funnel Review

Run:

```bash
LOOKBACK_DAYS=7 node scripts/lookup-funnel-report.js
```

Track:

- selected -> top10 generation rate
- top10 -> signup click rate
- signup click -> signup completion rate
- signup completion -> first outreach start rate

## Post-Deploy Verification

Run:

```bash
APP_URL=https://pythh.ai node scripts/post-deploy-health-check.js
```

Must pass before release is considered complete.

## Data Freshness Workflow

SLA targets:

- investor: 30 days
- startup: 14 days

Queue refresh work:

```bash
node scripts/data-freshness-audit.js
```

This writes stale records into `stale_data_queue` for remediation jobs.
