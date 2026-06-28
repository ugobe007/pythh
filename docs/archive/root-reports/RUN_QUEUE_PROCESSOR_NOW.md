# Fix: Generate Matches NOW

## Problem
- ✅ 3,823 startups
- ✅ 3,180 investors  
- ❌ 0 matches (queue processor hasn't run)

## Solution (3 Steps)

### Step 1: Create matching_queue table
Run in Supabase SQL Editor:
```sql
-- File: migrations/create_matching_queue_table.sql
```
This creates the table the queue processor needs.

### Step 2: Populate the queue with all startups
```bash
node scripts/populate-matching-queue-all-startups.js
```

This adds all 3,823 approved startups to `matching_queue` with status='pending'.

### Step 3: Run the queue processor
```bash
node scripts/core/queue-processor-v16.js
```

This will:
1. Read startups from `matching_queue` (status='pending')
2. For each startup, match with all 3,180 investors
3. Generate match scores
4. Insert top matches (score >= 35) into `startup_investor_matches`

## Expected Result

After running, you'll have:
- ~100-300 matches per startup (top quality matches only)
- Total: ~380,000 - 1,150,000 matches in database
- Frontend will immediately show matches

## Monitor Progress

The queue processor will log:
```
🚀 Queue Processor v16 started
📦 Cached 3180 investors
✅ Startup Name: 150 quality matches (filtered from 3180, top 100)
```

## Run in Background (Optional)

To run continuously with PM2:
```bash
pm2 start scripts/core/queue-processor-v16.js --name queue-processor
pm2 logs queue-processor
```

This will process all startups automatically.

## Time Estimate

- ~1-2 seconds per startup
- 3,823 startups × 1.5 seconds = ~1.5 hours total
- Or let it run overnight

## Check Progress

Run this SQL to see progress:
```sql
SELECT 
    status,
    COUNT(*) as count
FROM matching_queue
GROUP BY status;
```

You'll see:
- `pending` - startups waiting to be processed
- `processing` - currently being processed
- `completed` - done
- `failed` - errors (if any)
