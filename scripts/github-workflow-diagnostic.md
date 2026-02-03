# GitHub Workflow Diagnostic

## Current Status

Your GitHub workflows are failing due to **Supabase connection timeouts** and missing environment variables.

## Workflows Affected

1. **god-score-health-check.yml** (runs every 6 hours)
2. **automated-scraper.yml** (runs every 12 hours)

## Root Causes

### 1. Missing GitHub Secrets
The workflows need these secrets configured in your repository:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key (not anon key)
- `VITE_SUPABASE_ANON_KEY` - Public anon key
- `OPENAI_API_KEY` - For AI-powered scrapers

### 2. Connection Timeouts
GitHub Actions runners have network restrictions that may block Supabase:
- 10-minute timeout on health checks (often too short)
- Firewall/network routing issues
- Supabase rate limiting

### 3. Missing Database Columns
The rescue agent fails with: `Could not find the 'metadata' column of 'discovered_startups'`

## Quick Fixes

### Fix #1: Add GitHub Secrets

1. Go to: https://github.com/YOUR_USERNAME/hot-honey/settings/secrets/actions
2. Click "New repository secret"
3. Add each of these:

```bash
# From your .env file
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc... (service_role key)
VITE_SUPABASE_ANON_KEY=eyJhbGc... (anon key)
OPENAI_API_KEY=sk-proj-... (your OpenAI key)
```

### Fix #2: Increase Timeouts

Already configured at reasonable levels:
- Health check: 10 minutes ✅
- Scraper: 30 minutes ✅

### Fix #3: Add Missing Database Column

Run this migration:

```sql
ALTER TABLE discovered_startups 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_discovered_startups_metadata 
ON discovered_startups USING GIN (metadata);
```

### Fix #4: Test Locally

Test the health check script locally:

```bash
cd /Users/leguplabs/Desktop/hot-honey
export $(cat .env | xargs)
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data, error } = await supabase.from('startup_uploads').select('id').limit(1);
  console.log(error ? '❌ Failed' : '✅ Connected');
})();
"
```

## Disable Failing Workflows (Temporary)

If you want to stop the notifications while fixing:

```bash
# Comment out the schedule trigger in each workflow file
# Change this:
on:
  schedule:
    - cron: '0 */6 * * *'

# To this:
on:
  # schedule:
  #   - cron: '0 */6 * * *'
  workflow_dispatch:  # Keep manual trigger
```

## Re-enable After Fixes

1. Add all GitHub secrets
2. Run the database migration
3. Test with manual trigger: "Actions" → select workflow → "Run workflow"
4. If successful, uncomment the schedule

## Current Rescue Agent Status

✅ **Working!** Successfully rescued 1 startup (14.3% hit rate)
- Using inference engine (FREE - no API costs)
- GPT-4 fallback disabled (API key issue, but not needed)
- Processing 7 events per run
- Running every 30 minutes via PM2

## Platform Stats (Live)

The new LiveStats component is now showing on your homepage:
- 6,029 startups
- 3,175 investors  
- 313,332 matches
- Live update every 30 seconds ✨
