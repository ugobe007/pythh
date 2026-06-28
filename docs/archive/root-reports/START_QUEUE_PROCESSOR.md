# 🚀 Start Queue Processor

## Current Status

- **3,991 startups** waiting in queue
- **0 processed** in last 7 days
- **All queue entries are valid** (no orphaned entries)
- **Queue processor is NOT running**

---

## How to Start Queue Processor

### Option 1: Run Once (For Testing)

```bash
cd /Users/leguplabs/Desktop/hot-honey
node scripts/core/queue-processor-v16.js
```

This will process the queue once and exit. Useful for testing.

---

### Option 2: Run Continuously (Recommended)

The queue processor needs to run continuously to process all pending jobs.

**Using PM2 (Recommended):**

```bash
cd /Users/leguplabs/Desktop/hot-honey

# Start the queue processor with PM2
pm2 start scripts/core/queue-processor-v16.js --name queue-processor

# Check if it's running
pm2 status

# View logs
pm2 logs queue-processor

# Monitor in real-time
pm2 monit
```

**PM2 Commands:**

- `pm2 list` - Show all running processes
- `pm2 logs queue-processor` - View logs
- `pm2 restart queue-processor` - Restart the processor
- `pm2 stop queue-processor` - Stop the processor
- `pm2 delete queue-processor` - Remove from PM2

---

### Option 3: Background Process (Alternative)

```bash
cd /Users/leguplabs/Desktop/hot-honey
nohup node scripts/core/queue-processor-v16.js > logs/queue-processor.log 2>&1 &
```

---

## Verify It's Working

After starting the processor, check the queue status:

**Run this SQL in Supabase SQL Editor:**

```sql
-- Check if jobs are being processed
SELECT 
  COUNT(*) FILTER (WHERE processed_at IS NULL) as pending_jobs,
  COUNT(*) FILTER (WHERE processed_at >= NOW() - INTERVAL '5 minutes') as processed_last_5min,
  MAX(processed_at) as most_recent_processed
FROM matching_queue;
```

If `processed_last_5min` is increasing, the processor is working! ✅

---

## Check Processing Speed

The queue processor processes jobs in batches of 20, checking every 5 seconds.

- **3,991 pending jobs** ÷ **20 per batch** = **~200 batches** needed
- At **~20 jobs per 5 seconds** = **~4 jobs/second**
- **Estimated time**: ~17 minutes to process all 3,991 jobs

---

## Troubleshooting

### If processor stops immediately:

1. **Check logs:**
   ```bash
   pm2 logs queue-processor
   # or
   tail -f logs/queue-processor.log
   ```

2. **Check for errors:**
   - Missing environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY)
   - Database connection issues
   - Permission errors

3. **Verify environment:**
   ```bash
   # Make sure .env file has:
   # VITE_SUPABASE_URL=...
   # SUPABASE_SERVICE_KEY=...
   ```

### If no jobs are processing:

1. **Check queue status:**
   - Run `migrations/queue_processor_summary.sql` in Supabase
   - Verify jobs have status = 'pending'

2. **Check for stuck 'processing' jobs:**
   ```sql
   SELECT COUNT(*) 
   FROM matching_queue 
   WHERE status = 'processing' 
     AND processed_at IS NULL 
     AND created_at < NOW() - INTERVAL '1 hour';
   ```
   If there are stuck jobs, reset them:
   ```sql
   UPDATE matching_queue 
   SET status = 'pending' 
   WHERE status = 'processing' 
     AND processed_at IS NULL 
     AND created_at < NOW() - INTERVAL '1 hour';
   ```

---

## Expected Output

When running, you should see logs like:

```
🚀 Starting matching queue processor...
📊 Poll interval: 5s
📦 Batch size: 20
🔄 Max attempts: 3

📋 Processing 20 matching jobs...

🎯 Processing match job for startup: [uuid]
✅ Match job completed: 50 matches created

✅ Batch processing complete
```

---

## Next Steps

1. ✅ Start the queue processor (use Option 2 with PM2)
2. ✅ Monitor logs to ensure it's processing
3. ✅ Check queue status after 5 minutes to verify progress
4. ✅ Let it run until all 3,991 jobs are processed

---

**Note**: The queue processor will automatically stop when all pending jobs are completed. You can restart it anytime new jobs are added to the queue.
