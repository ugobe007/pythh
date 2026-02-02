## 🛡️ Multi-Layer Fallback System for Match Generation

### Problem
When a startup submits their URL, matches might not exist yet because:
1. **Match generator runs every 30 minutes** (PM2 cron)
2. **Database trigger queues new startups** but processing happens async
3. **User expects instant results** but system is batch-oriented

### Solution: 4-Layer Defense

---

## Layer 1: Database Trigger + Queue ✨ NEW

**What it does:** Automatically queues new startups for matching when approved

**File:** `supabase/migrations/20260122_match_queue_trigger.sql`

**How it works:**
1. When startup status changes to "approved" → Auto-queued for matching
2. User submissions get **priority 200** (processed first)
3. Auto-discoveries get **priority 100** (normal processing)
4. Queue processor runs every 5 minutes via PM2

**Apply the migration:**
```bash
# Option 1: Via Supabase CLI (recommended)
supabase db push

# Option 2: Copy SQL and paste into Supabase SQL Editor
# Open: https://app.supabase.com/project/YOUR_PROJECT/sql
```

**Start the queue processor:**
```bash
pm2 start process-match-queue.js --name match-queue-processor
pm2 save
```

**Manual queue:**
```sql
-- Queue a specific startup with high priority
SELECT manually_queue_startup('697d7775-8c3c-43a9-9b3b-927cf99d88cb', 200);

-- Check queue status
SELECT * FROM queue_status;
```

---

## Layer 2: Sector-Based Fallback ✨ NEW

**What it does:** Shows investors in the same sector when no matches exist

**File:** `src/pages/DiscoveryResultsPage.tsx`

**How it works:**
1. Query `startup_investor_matches` for specific startup
2. If 0 matches → Get startup's sectors
3. Find investors with matching sectors
4. Show as "Similar Investors" with neutral score (50)

**User sees:**
```
⚠️ Matches are being generated...
Meanwhile, here are investors in your sector (AI, SaaS):
```

---

## Layer 3: Recent High-Quality Matches

**What it does:** Shows recent matches from other startups (score 50+)

**File:** `src/pages/DiscoveryResultsPage.tsx` (already implemented)

**How it works:**
1. If no startup_id provided → Load recent matches
2. Filters: `status = 'suggested'`, `match_score >= 50`
3. Orders by `created_at DESC`
4. Limit: 10 matches

**User sees:**
```
✨ Recent High-Quality Matches
These matches are from other startups in our platform.
Submit your URL to get personalized matches.
```

---

## Layer 4: Manual Trigger Button ✨ COMING SOON

**What it does:** Lets user manually request immediate match generation

**UI:**
```tsx
<button onClick={triggerMatching}>
  Generate My Matches Now
</button>
```

**Backend:**
```javascript
async function triggerMatching(startupId) {
  // Queue with highest priority
  await supabase.rpc('manually_queue_startup', {
    p_startup_id: startupId,
    p_priority: 300  // Urgent
  });
  
  // Show processing state
  setQueueStatus('queued');
}
```

---

## User Flow Examples

### ✅ Best Case (Matches Exist)
```
1. User submits spatial-ai.com
2. Startup already has 47 matches in database
3. Page loads instantly with personalized results
```

### ⏱️ Queued Case (Processing)
```
1. User submits new-startup.com
2. Database trigger queues startup (priority 200)
3. Page shows: "⚙️ Generating your matches... (usually < 5 min)"
4. Shows sector-based fallback investors
5. Auto-refreshes when matches ready
```

### 🔄 Fallback Case (No Matches + Not Queued)
```
1. User navigates to /matches without params
2. Shows recent high-quality matches from platform
3. CTA: "Submit your URL for personalized matches"
```

---

## Timeline Comparison

### ❌ OLD SYSTEM (Before Database Trigger)
```
T=0:    User submits URL
T=0:    Shows "No matches found" error ☹️
T=30m:  Match regenerator runs (cron)
T=30m:  Matches finally appear
```

### ✅ NEW SYSTEM (With Database Trigger + Queue)
```
T=0:    User submits URL
T=0:    Database trigger queues startup (priority 200)
T=0:    Shows sector-based fallback investors ✅
T=0-5m: Queue processor picks up item
T=2-5m: Matches generated and appear ✅
```

**Wait time reduced from 0-30 minutes → 2-5 minutes**

---

## Monitoring & Debugging

### Check Queue Status
```bash
# Via CLI
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
supabase.from('queue_status').select('*').then(r => console.log(r.data));
"

# Via SQL
SELECT * FROM queue_status;
```

### Check if Startup is Queued
```sql
SELECT * FROM match_generation_queue
WHERE startup_id = '697d7775-8c3c-43a9-9b3b-927cf99d88cb'
ORDER BY created_at DESC;
```

### Manual Queue Processing
```bash
# Process entire queue
node process-match-queue.js

# Process one item
node process-match-queue.js --once

# Process max 5 items
node process-match-queue.js --limit 5
```

### View Logs
```bash
# Queue processor logs
pm2 logs match-queue-processor

# Match regenerator logs (legacy cron)
pm2 logs match-regenerator

# System guardian (monitors everything)
pm2 logs system-guardian
```

---

## PM2 Configuration

Add to `ecosystem.config.js`:

```javascript
{
  name: 'match-queue-processor',
  script: 'node',
  args: 'process-match-queue.js',
  cwd: './',
  instances: 1,
  autorestart: false,
  watch: false,
  max_memory_restart: '1G',
  cron_restart: '*/5 * * * *',  // Every 5 minutes
  env: {
    NODE_ENV: 'production'
  }
},
{
  name: 'match-regenerator',  // Keep as backup
  cron_restart: '*/30 * * * *',  // Every 30 minutes
  autorestart: false
}
```

Start services:
```bash
pm2 start ecosystem.config.js --update-env
pm2 save
```

---

## What Happens Now

### When RSS Scraper Finds New Startup
```
1. RSS scraper inserts into discovered_startups
2. Admin approves → status = 'approved'
3. Database trigger fires → Queued (priority 100)
4. Queue processor picks it up within 5 minutes
5. Matches generated automatically
```

### When User Submits URL
```
1. URL resolver finds/creates startup
2. Status set to 'approved'
3. Database trigger fires → Queued (priority 200 - URGENT)
4. Queue processor prioritizes user submissions
5. Matches appear within 2-5 minutes
6. Meanwhile, user sees sector-based fallback
```

### When Match Generator Runs (Cron)
```
1. Every 30 minutes (backup/cleanup)
2. Regenerates matches for ALL startups
3. Catches anything queue missed
4. Refreshes stale matches
```

---

## Key Files

| File | Purpose |
|------|---------|
| [supabase/migrations/20260122_match_queue_trigger.sql](supabase/migrations/20260122_match_queue_trigger.sql) | Database trigger + queue system |
| [process-match-queue.js](process-match-queue.js) | Queue processor script |
| [src/pages/DiscoveryResultsPage.tsx](src/pages/DiscoveryResultsPage.tsx) | Frontend with fallback logic |
| [match-regenerator.js](match-regenerator.js) | Legacy batch processor (backup) |
| [ecosystem.config.js](ecosystem.config.js) | PM2 configuration |

---

## Future Enhancements

- [ ] Real-time match generation via WebSockets
- [ ] Email notification when matches ready
- [ ] Premium tier: Instant matching (<30 seconds)
- [ ] Match quality scoring in queue (skip low-quality startups)
- [ ] Auto-retry failed matches with exponential backoff
- [ ] Queue analytics dashboard

---

*Last updated: January 22, 2026*
*Status: ✅ Database trigger ready, queue processor implemented*
