# Automated Investor Enrichment Guide

## Overview

The automated enrichment system uses OpenAI to research and populate investor data including:
- Partner names and titles
- Investment thesis
- Fund size / AUM
- Exit counts
- Notable investments

## Quick Start

```bash
# Check current stats
node scripts/auto-enrich-with-limits.js --stats

# Run one batch (5 investors)
node scripts/auto-enrich-with-limits.js --once

# Dry run (test without API calls)
node scripts/auto-enrich-with-limits.js --once --dry-run

# Run continuously (with token limits)
node scripts/auto-enrich-with-limits.js
```

## Token Limits & Cost Control

### Default Limits
| Limit | Value | Effect |
|-------|-------|--------|
| Daily budget | 100,000 tokens | ~$0.06/day max |
| Hourly budget | 15,000 tokens | Prevents burst spending |
| Per request | 800 tokens | Limits individual responses |

### Adjusting Limits
Edit `CONFIG` in `scripts/auto-enrich-with-limits.js`:

```javascript
const CONFIG = {
  DAILY_TOKEN_BUDGET: 100000,    // Increase for more enrichments
  HOURLY_TOKEN_BUDGET: 15000,    // Increase for faster processing
  BATCH_SIZE: 5,                 // Investors per batch
  DELAY_BETWEEN_BATCHES: 10000,  // 10 seconds
};
```

### Cost Reference (gpt-4o-mini)
- ~300 tokens per enrichment
- 100 enrichments ≈ $0.018
- 1000 enrichments ≈ $0.18/day

## Running as Background Service

### Option 1: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start the service
pm2 start scripts/auto-enrich-with-limits.js --name "investor-enrichment"

# Monitor
pm2 logs investor-enrichment
pm2 monit

# Stop
pm2 stop investor-enrichment
```

### Option 2: Screen/tmux

```bash
# Start in screen
screen -S enrichment
node scripts/auto-enrich-with-limits.js

# Detach: Ctrl+A, D
# Reattach: screen -r enrichment
```

### Option 3: Cron (periodic runs)

```bash
# Edit crontab
crontab -e

# Add: Run once per hour
0 * * * * cd /path/to/hot-honey && node scripts/auto-enrich-with-limits.js --once >> logs/enrichment.log 2>&1
```

## Monitoring

### Check Progress
```bash
node scripts/auto-enrich-with-limits.js --stats
```

Output:
```
📊 Investor Stats:
{
  "total": 171,
  "enriched": 45,
  "withExits": 30,
  "withPartners": 45
}
```

### View Logs (PM2)
```bash
pm2 logs investor-enrichment --lines 100
```

## Schema Notes

The script automatically maps OpenAI responses to available API columns:

| OpenAI Field | Database Column |
|--------------|-----------------|
| partners | partners (JSONB) |
| exits | total_investments |
| fund_size | active_fund_size |
| investment_pace | investment_pace_per_year |
| investment_thesis | investment_thesis |
| website | blog_url |
| linkedin | linkedin_url |
| notable_investments | notable_investments |

## Troubleshooting

### "Column not found in schema cache"
The Supabase API caches schema. If you added new columns:
1. Wait 24 hours for auto-refresh, OR
2. Go to Supabase Dashboard → Settings → API → Reload Schema

### "Budget exhausted"
Token limits prevent runaway costs. Options:
1. Wait for hourly/daily reset
2. Increase `DAILY_TOKEN_BUDGET` in config
3. Run `--once` for single batches

### API Errors
Check `.env` has valid keys:
```
VITE_OPENAI_API_KEY=sk-...
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

## Cost Estimation

| Investors | Tokens | Cost (gpt-4o-mini) |
|-----------|--------|-------------------|
| 100 | ~30,000 | $0.02 |
| 500 | ~150,000 | $0.09 |
| 1,000 | ~300,000 | $0.18 |

With default 100K daily budget: ~330 investors/day max

## Files

- `scripts/auto-enrich-with-limits.js` - Main enrichment script with token limits
- `auto-enrich-investors.js` - Legacy script (no limits)
