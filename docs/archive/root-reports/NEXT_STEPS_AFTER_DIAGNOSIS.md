# Next Steps After Running Diagnosis

## What to Check

Run the full diagnostic: `migrations/diagnose_matching_system_full.sql`

This will tell you:

### ✅ Good Signs:
- Startups count > 0
- Investors count > 0  
- `matching_queue` table exists

### ❌ Problems to Fix:

#### Problem 1: `matching_queue` table doesn't exist
**Fix**: Run this SQL:
```sql
CREATE TABLE IF NOT EXISTS matching_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(startup_id)
);

CREATE INDEX IF NOT EXISTS idx_matching_queue_status ON matching_queue(status);
CREATE INDEX IF NOT EXISTS idx_matching_queue_startup_id ON matching_queue(startup_id);
```

#### Problem 2: Queue is empty (no pending jobs)
**Fix**: Run this script:
```bash
node scripts/populate-matching-queue-all-startups.js
```

This adds all approved startups to the queue.

#### Problem 3: No matches generated (matches = 0)
**Fix**: Start the queue processor:
```bash
node scripts/core/queue-processor-v16.js
```

Or with PM2 (runs continuously):
```bash
pm2 start scripts/core/queue-processor-v16.js --name queue-processor
pm2 logs queue-processor
```

## Expected Results After Fix

After running the queue processor, you should see:
- `startup_investor_matches` table filling up
- ~100-300 matches per startup (top matches only)
- Frontend will show matches immediately

## The System Flow

```
startup_uploads (3000 startups)
         ↓
populate-matching-queue-all-startups.js
         ↓
matching_queue (queue of startups to process)
         ↓
queue-processor-v16.js (reads queue, generates matches)
         ↓
startup_investor_matches (the matches!)
         ↓
MatchingEngine.tsx (frontend displays matches)
```

Simple. No spaghetti code.
