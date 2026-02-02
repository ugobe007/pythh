# Match Engine Prevention Guide

## Problem
Startups can be added to the database (manually or via RSS scraper) but matches aren't generated automatically, causing the "No matches found" error.

## Solution: Multi-Layer Approach

### 1. **Automatic PM2 Cron Job** ✅ (PRIMARY)
The match regenerator now runs every **30 minutes** instead of every 2 hours.

**File**: `ecosystem.config.js`
```javascript
{
  name: 'match-regenerator',
  cron_restart: '*/30 * * * *',  // Every 30 minutes
}
```

**To start/restart:**
```bash
pm2 restart match-regenerator
pm2 status  # Verify it's running
```

### 2. **Manual Trigger** (BACKUP)
When you manually add a startup or need immediate matches:

```bash
# For all startups
node match-regenerator.js

# For specific startup (faster)
node generate-single-startup-matches.js <startup_id>
```

### 3. **Database Trigger** (FUTURE)
Create a Supabase function that auto-generates matches when startup status changes to "approved":

```sql
-- Create function to trigger match generation
CREATE OR REPLACE FUNCTION trigger_match_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'approved', mark for match generation
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Insert into a queue table for the match generator to process
    INSERT INTO match_generation_queue (startup_id, created_at)
    VALUES (NEW.id, NOW())
    ON CONFLICT (startup_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER on_startup_approved
  AFTER UPDATE ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_match_generation();
```

### 4. **Frontend Fallback** (IMPLEMENTED)
The `/matches` page now shows recent high-quality matches as fallback when no specific startup matches exist.

**File**: `src/pages/DiscoveryResultsPage.tsx`
- If no startup_id → loads recent matches (score 50+) from database
- Better than showing empty state

### 5. **System Guardian Monitoring** (IMPLEMENTED)
The System Guardian checks match quality every 10 minutes:

**File**: `scripts/archive/utilities/system-guardian.js`
- Checks if match count < 5,000 → triggers regeneration
- Monitors match score distribution
- Logs to `ai_logs` table

## Current Status

| Component | Status | Frequency | Notes |
|-----------|--------|-----------|-------|
| Match Regenerator | ✅ Running | Every 30 min | PM2 cron job |
| System Guardian | ✅ Running | Every 10 min | Monitors + auto-heals |
| RSS Scraper | ✅ Running | Every 15 min | Adds new startups |
| GOD Scorer | ✅ Running | Every 2 hours | Scores startups |
| Database Trigger | ❌ Not implemented | N/A | Future enhancement |

## How to Verify It's Working

### Check PM2 Status
```bash
pm2 status
pm2 logs match-regenerator --lines 20
```

### Check Match Counts
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { count } = await supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true });
  console.log('Total matches in database:', count);
  
  const { data } = await supabase.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved');
  console.log('Approved startups:', data.count);
})();
"
```

### Check Last Run Time
```bash
pm2 logs match-regenerator --lines 5
# Should show recent runs every 30 minutes
```

## What Happens When a New Startup is Added

### Timeline:
1. **T=0**: Startup added (via RSS scraper or manual upload)
2. **T=0-30min**: Startup has no matches yet (shows "No matches found")
3. **T=30min**: Match regenerator runs, generates ~50-200 matches per startup
4. **T=30min+**: Matches appear on `/matches` page

### Reducing Wait Time:
If you need immediate matches:
```bash
# Trigger manually instead of waiting 30 min
node match-regenerator.js
```

Or restart the PM2 job to run now:
```bash
pm2 restart match-regenerator
```

## Common Issues & Fixes

### Issue: "No matches found" after 30+ minutes
**Check:**
1. Is PM2 running? `pm2 status`
2. Is match-regenerator in the list? 
3. Check logs: `pm2 logs match-regenerator`

**Fix:**
```bash
pm2 restart match-regenerator
# Wait 2-3 minutes, then check again
```

### Issue: Match regenerator keeps crashing
**Check logs:**
```bash
pm2 logs match-regenerator --err --lines 50
```

**Common causes:**
- Out of memory (increase `max_memory_restart`)
- Supabase connection timeout (add retry logic)
- Too many startups (batch processing needed)

**Fix:**
```bash
# Restart with higher memory
pm2 restart match-regenerator --update-env
```

### Issue: Matches exist but wrong startup
**Problem:** URL resolver mapped to wrong startup ID

**Fix:**
1. Check `discovered_startups` table for URL
2. Verify `startup_uploads` has correct mapping
3. Re-run match generator for specific startup

## Best Practices

1. **Monitor Daily**: Check `pm2 status` daily to ensure all processes running
2. **Check Logs**: Review `pm2 logs` weekly for errors
3. **Run System Guardian**: `node scripts/archive/utilities/system-guardian.js` to verify health
4. **Test New Startups**: After adding startups manually, run match generator
5. **Database Backups**: Matches can be regenerated, but backup GOD scores

## Future Enhancements

- [ ] Implement database trigger for instant match generation
- [ ] Add match generation queue table
- [ ] Webhook notification when matches ready
- [ ] Real-time match generation for premium users
- [ ] Incremental matching (only new investors)

---

*Last updated: 2026-01-22*
*Match regenerator frequency: 30 minutes*
*System guardian frequency: 10 minutes*
