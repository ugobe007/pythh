/**
 * MATCH RUN WORKER - Processes queued match runs
 * 
 * Pattern A v1.1 (Read-only, advisory-locked):
 * 1. Acquires advisory lock (prevents multiple instances)
 * 2. Claims next queued run (lease-based, atomic)
 * 3. Fetches top 200 matches using indexed get_top_matches RPC
 * 4. Marks run as ready with match_count = array length
 * 
 * Runs every 10 seconds via PM2 cron.
 * Returns "200+" when cap hit (exact counts computed offline if needed).
 * 
 * Advisory lock pattern ensures only ONE worker processes at a time,
 * preventing the "34 rogue processes" failure mode.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const WORKER_ID = process.env.WORKER_ID || `worker-${Math.random().toString(36).slice(2, 9)}`;
// Advisory lock key as bigint (hashtext equivalent for 'match_worker')
// Using fixed hash to ensure consistent lock across workers
const ADVISORY_LOCK_KEY = 123456789;  // Unique lock identifier for match_worker

// Feature flag: set to true after deploying migration 010
const USE_ADVISORY_LOCKS = process.env.USE_ADVISORY_LOCKS === 'true';

// Advisory lock: prevents multiple workers from running simultaneously
async function acquireAdvisoryLock() {
  if (!USE_ADVISORY_LOCKS) {
    console.log('[match-worker] Advisory locks disabled (USE_ADVISORY_LOCKS!=true)');
    return true;  // Proceed without lock
  }
  
  // Call PostgreSQL's try_advisory_lock RPC with bigint
  const { data, error } = await supabase.rpc('try_advisory_lock', {
    lock_key: ADVISORY_LOCK_KEY
  });
  
  if (error) {
    console.error('[match-worker] Lock acquisition failed:', error);
    return false;
  }
  
  return data === true;
}

async function releaseAdvisoryLock() {
  if (!USE_ADVISORY_LOCKS) {
    return;  // No lock to release
  }
  
  await supabase.rpc('release_advisory_lock', {
    lock_key: ADVISORY_LOCK_KEY
  });
}

async function processNextRun() {
  try {
    console.log('[match-worker] Claiming next run...');
    
    // 1. Claim next run (lease-based)
    const { data: claimData, error: claimError } = await supabase.rpc('claim_next_match_run', {
      worker_id: WORKER_ID
    });
    
    if (claimError) {
      console.error('[match-worker] Claim error:', claimError);
      return false;
    }
    
    const run = claimData?.[0];
    
    if (!run) {
      console.log('[match-worker] No work available');
      return false;
    }
    
    console.log(`[match-worker] Claimed run ${run.run_id} for startup ${run.startup_id}`);
    
    // 2. Get top matches (Pattern A: no heavy COUNT, just get the actual matches)
    const { data: matchesData, error: matchesError } = await supabase.rpc('get_top_matches', {
      p_startup_id: run.startup_id,
      p_limit: 200
    });
    
    if (matchesError) {
      console.error('[match-worker] Matches error:', matchesError);
      
      // Mark as error
      await supabase.rpc('complete_match_run', {
        input_run_id: run.run_id,
        final_status: 'error',
        final_match_count: 0,
        final_error_code: 'MATCHES_FAILED',
        final_error_message: matchesError.message
      });
      
      return false;
    }
    
    // Count = number returned (if 200, means "200+")
    const matchCount = matchesData?.length || 0;
    
    console.log(`[match-worker] Found ${matchCount}${matchCount === 200 ? '+' : ''} matches for startup ${run.startup_id}`);
    
    // 3. Mark as ready
    const { error: completeError } = await supabase.rpc('complete_match_run', {
      input_run_id: run.run_id,
      final_status: 'ready',
      final_match_count: matchCount,
      final_error_code: null,
      final_error_message: null
    });
    
    if (completeError) {
      console.error('[match-worker] Complete error:', completeError);
      return false;
    }
    
    console.log(`[match-worker] ✅ Completed run ${run.run_id} with ${matchCount} matches`);
    
    return true;
    
  } catch (err) {
    console.error('[match-worker] Unexpected error:', err);
    return false;
  }
}

async function processAllQueued() {
  console.log('[match-worker] Starting batch...');
  
  const startTime = Date.now();
  const MAX_RUNS = parseInt(process.env.MAX_RUNS_PER_BATCH) || 2;  // From env, default 2
  const MAX_TIME_MS = parseInt(process.env.BATCH_TIMEOUT_MS) || 8000;  // From env, default 8s
  
  let processed = 0;
  let hasMore = true;
  
  // Process until: MAX_RUNS runs OR MAX_TIME_MS elapsed
  while (hasMore && processed < MAX_RUNS) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= MAX_TIME_MS) {
      console.log(`[match-worker] Time limit reached (${elapsed}ms). Stopping batch.`);
      break;
    }
    
    const success = await processNextRun();
    
    if (success) {
      processed++;
    } else {
      hasMore = false;  // No more work or error occurred
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[match-worker] Batch complete. Processed ${processed} runs in ${elapsed}ms.`);
}

// Main execution with advisory lock protection
(async () => {
  try {
    // CRITICAL: Acquire advisory lock first
    const lockAcquired = await acquireAdvisoryLock();
    
    if (!lockAcquired) {
      console.log('[match-worker] Another instance is running. Exiting.');
      process.exit(0);
    }
    
    console.log('[match-worker] Advisory lock acquired. Processing batch...');
    
    await processAllQueued();
    
    console.log('[match-worker] Done');
    
  } catch (err) {
    console.error('[match-worker] Fatal error:', err);
    process.exit(1);
  } finally {
    // CRITICAL: Always release lock on exit
    await releaseAdvisoryLock();
    process.exit(0);
  }
})();

module.exports = { processNextRun, processAllQueued };

