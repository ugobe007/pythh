# Automation - Inference Enrichment

## Overview

The inference enrichment process is now **fully automated** and runs in two ways:

1. **As part of the automation pipeline** - Runs automatically when new startups are imported
2. **As a scheduled PM2 job** - Runs every 2 hours to enrich existing startups missing data

## How It Works

### 1. Automation Pipeline Integration

**File**: `automation-pipeline.js`

The enrichment runs as **Stage 2** of the automation pipeline:
1. **Stage 1**: Import discovered startups
2. **Stage 2**: Enrich startups (basic + AI inference) ← **NEW**
3. **Stage 3**: Calculate GOD scores
4. **Stage 4**: Auto-approve quality startups
5. **Stage 5**: Generate matches

**Schedule**: Runs every 6 hours via PM2 cron

### 2. Standalone PM2 Job

**File**: `ecosystem.config.js`

A dedicated PM2 process runs inference enrichment:

```javascript
{
  name: 'inference-enrichment',
  script: 'npx',
  args: 'tsx scripts/enrich-startups-inference.ts --limit 100 --missing',
  cron_restart: '0 */2 * * *',  // Every 2 hours
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
  }
}
```

**Schedule**: Every 2 hours at :00 (12:00 AM, 2:00 AM, 4:00 AM, etc.)

## Setup

### 1. Ensure Environment Variables

Make sure these are in your `.env` file:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 2. Start PM2 Processes

```bash
# Start all processes (including inference-enrichment)
pm2 start ecosystem.config.js

# Or start just the inference enrichment
pm2 start ecosystem.config.js --only inference-enrichment

# Save PM2 configuration
pm2 save

# Enable auto-start on reboot
pm2 startup
```

### 3. Monitor

```bash
# Check status
pm2 status

# View logs
pm2 logs inference-enrichment

# View real-time logs
pm2 logs inference-enrichment --lines 50

# Monitor dashboard
pm2 monit
```

## Configuration

### Adjust Schedule

Edit `ecosystem.config.js`:

```javascript
cron_restart: '0 */2 * * *',  // Every 2 hours
// Change to:
cron_restart: '0 */1 * * *',  // Every hour
cron_restart: '0 */4 * * *',  // Every 4 hours
cron_restart: '0 0 * * *',    // Daily at midnight
```

### Adjust Batch Size

Edit the PM2 args:

```javascript
args: 'tsx scripts/enrich-startups-inference.ts --limit 200 --missing',
// Or process all:
args: 'tsx scripts/enrich-startups-inference.ts --limit 1000 --missing',
```

### Adjust Pipeline Batch Size

Edit `automation-pipeline.js`:

```javascript
const CONFIG = {
  BATCH_SIZE: 50,  // Change to 100, 200, etc.
  // ...
};
```

## What Gets Enriched

The inference enrichment populates `extracted_data` JSONB with:

- **Traction**: `revenue`, `mrr`, `arr`, `growth_rate`, `active_users`, `customers`
- **Market**: `market_size`, `problem`, `solution`, `value_proposition`
- **Product**: `is_launched`, `has_demo`, `mvp_stage`
- **Team**: `founders_count`, `technical_cofounders`, `team_companies`
- **Funding**: `funding_amount`, `funding_stage`, `investors_mentioned`

## Monitoring

### Check Enrichment Status

```bash
# View recent logs
pm2 logs inference-enrichment --lines 100

# Check how many startups were enriched
# Look for: "✅ Enriched: X"
```

### Database Query

```sql
-- Check how many startups have enriched extracted_data
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN extracted_data->>'revenue' IS NOT NULL THEN 1 END) as has_revenue,
  COUNT(CASE WHEN extracted_data->>'problem' IS NOT NULL THEN 1 END) as has_problem,
  COUNT(CASE WHEN extracted_data->>'team_companies' IS NOT NULL THEN 1 END) as has_team
FROM startup_uploads
WHERE status IN ('pending', 'approved');
```

## Troubleshooting

### Enrichment Not Running?

1. **Check PM2 status**:
   ```bash
   pm2 status
   ```

2. **Check if process is enabled**:
   ```bash
   pm2 list
   # Look for inference-enrichment
   ```

3. **Check logs for errors**:
   ```bash
   pm2 logs inference-enrichment --err
   ```

4. **Verify API keys**:
   ```bash
   # Check .env file has ANTHROPIC_API_KEY
   cat .env | grep ANTHROPIC
   ```

### API Rate Limits?

The script includes 2-second delays between batches. If you hit rate limits:

1. **Reduce batch size** in PM2 config:
   ```javascript
   args: 'tsx scripts/enrich-startups-inference.ts --limit 50 --missing',
   ```

2. **Increase schedule interval**:
   ```javascript
   cron_restart: '0 */4 * * *',  // Every 4 hours instead of 2
   ```

### Manual Run

Run enrichment manually for testing:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... ANTHROPIC_API_KEY=... \
  npx tsx scripts/enrich-startups-inference.ts --limit 10
```

## Expected Impact

**Before Automation**:
- Only 7% of startups had `extracted_data` populated
- 94% missing traction/market/product data
- Component scores clustered at 8.0 (no differentiation)

**After Automation**:
- New startups automatically enriched on import
- Existing startups enriched every 2 hours
- Better GOD score differentiation
- More accurate scoring based on inferred data

## Next Steps After Enrichment

After enrichment runs, scores should be recalculated:

1. **Automatic**: The `score-recalc` PM2 job runs hourly and will pick up enriched data
2. **Manual**: Run `npx tsx scripts/recalculate-scores.ts` to force recalculation

---

**Status**: ✅ Fully Automated
**Schedule**: Every 2 hours + on pipeline runs
**Priority**: 🔴 Critical for unbiased GOD scoring



