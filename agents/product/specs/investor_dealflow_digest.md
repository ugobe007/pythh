# Investor Dealflow Digest

**Status:** Validating (shipped 2026-06-24)  
**Opportunity ID:** `investor_dealflow_digest`  
**Priority:** P1 (investor retention)

## Problem

Investors complete signup but lack a recurring reason to return. Founder supply grows via preview funnel; investors need matched inventory delivered to them.

## Solution

Weekly email digest: top 5 **unique startups** from `pythh_top_matches` (capital_match). The view is one row per entity×candidate pair — the digest dedupes by `entity_name` and keeps the best-scoring pair per startup (shows `candidate_name` as thesis-fit investor).

## Implementation

| Component | Path |
|-----------|------|
| Sender script | `scripts/investor-dealflow-digest.mjs` |
| npm | `npm run digest:investor` / `digest:investor:dry` |
| Telemetry | `ai_logs.operation = investor_dealflow_digest_sent` |
| Legacy script | `scripts/send-weekly-signal-digest.js` (deprecated — delegates conceptually) |

### Recipients

- `--to signed-up` (default batch): investors with `investor_signup_completed` event in last 90d, or created in last 90d
- `--to all`: any investor row with email
- `--to email@firm.com`: single send

Dedup: skips if same email received digest in last 6 days (override with `--force`).

### Links

- Per-startup: `/portfolio/:id` when entity id available, else `/investors?q=name`
- Footer CTA: `/investors?utm_source=dealflow_digest`

### Env

- `RESEND_API_KEY` (required for live send)
- `EMAIL_FROM` (default `Pythh Dealflow <notifications@pythh.ai>`)
- `SITE_URL` (default `https://pythh.ai`)

## Cron

```bash
# Mondays 8am UTC
0 8 * * 1 cd /path/to/hot-honey && npm run digest:investor >> logs/investor-digest.log 2>&1
```

Dry run before first live batch:
```bash
npm run digest:investor:dry -- --to you@firm.com
npm run digest:investor:dry -- --to signed-up
```

## Metrics

| Metric | Source | Target |
|--------|--------|--------|
| Digests sent / week | `ai_logs` `investor_dealflow_digest_sent` | ≥1 batch/week |
| Investor WAU | `growth_experiment_events` + session | 15% of signed-up investors |
| Intro acceptance | `match_intro_requested` (investor side) | TBD |

Funnel snapshot includes `investor_dealflow_digest_sent` count.

## Rollout

1. Dry-run to team inbox
2. `--to signed-up` live batch (small cohort)
3. Monitor Resend delivery + bounce
4. 14d: compare investor return visits vs pre-digest baseline

## Open questions

- Unsubscribe / preference center (currently profile link only)
- Per-investor match personalization vs global top-5
- Should inactive intake investors (`status=inactive`) auto-activate on first digest open?
