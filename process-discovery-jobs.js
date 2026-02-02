#!/usr/bin/env node

/**
 * DISCOVERY JOB PROCESSOR
 * 
 * This worker processes startup_jobs table, advancing job status:
 * queued → building → scoring → matching → ready
 * 
 * It coordinates with match_generation_queue to ensure matches exist.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { getExactCount } = require('./server/lib/supabaseHelpers');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const POLL_INTERVAL = 5000; // 5 seconds
const MATCH_COUNT_TARGET = 1000; // Minimum matches for "ready" state

/**
 * Log structured JSON for observability
 */
function logJobDecision(jobId, startupId, queueStatus, matchCount, decision, extra = {}) {
  const logLine = {
    timestamp: new Date().toISOString(),
    job_id: jobId,
    startup_id: startupId,
    queue_status: queueStatus || 'not_queued',
    match_count: matchCount,
    target: MATCH_COUNT_TARGET,
    decision,
    ...extra
  };
  console.log('📊 JOB_DECISION:', JSON.stringify(logLine));
}

/**
 * Process a single job through its lifecycle
 */
async function processJob(job) {
  console.log(`\n📋 Processing job ${job.id.slice(0, 8)}... (status: ${job.status})`);
  
  try {
    // STAGE 1: queued → building (5%)
    if (job.status === 'queued') {
      await supabase
        .from('startup_jobs')
        .update({ 
          status: 'building', 
          progress_percent: 5,
          started_at: new Date().toISOString()
        })
        .eq('id', job.id);
      console.log('  ✅ Advanced to building (5%)');
      return { success: true };
    }
    
    // STAGE 2: building → scoring (30%)
    if (job.status === 'building') {
      // Verify startup exists and has basic data
      const { data: startup, error: startupErr } = await supabase
        .from('startup_uploads')
        .select('id, name, total_god_score, sectors, stage')
        .eq('id', job.startup_id)
        .single();
      
      if (startupErr || !startup) {
        await supabase
          .from('startup_jobs')
          .update({ 
            status: 'failed',
            error_message: 'Startup not found',
            finished_at: new Date().toISOString()
          })
          .eq('id', job.id);
        console.log('  ❌ Failed: startup not found');
        return { success: false, error: 'Startup not found' };
      }
      
      // Check if startup has GOD score
      if (!startup.total_god_score || startup.total_god_score < 40) {
        console.log(`  ⚠️  Low/missing GOD score (${startup.total_god_score}), waiting for scoring...`);
        // Keep in building state, will retry
        return { success: true, waiting: true };
      }
      
      await supabase
        .from('startup_jobs')
        .update({ status: 'scoring', progress_percent: 30 })
        .eq('id', job.id);
      console.log('  ✅ Advanced to scoring (30%)');
      return { success: true };
    }
    
    // STAGE 3: scoring → matching (60%)
    if (job.status === 'scoring') {
      // Ensure startup is queued for match generation
      const { error: queueErr } = await supabase.rpc('manually_queue_startup', {
        p_startup_id: job.startup_id,
        p_priority: 200 // High priority for user submissions
      });
      
      if (queueErr) {
        console.log(`  ⚠️  Queue error (non-fatal): ${queueErr.message}`);
      }
      
      await supabase
        .from('startup_jobs')
        .update({ status: 'matching', progress_percent: 60 })
        .eq('id', job.id);
      console.log('  ✅ Advanced to matching (60%), queued for match generation');
      return { success: true };
    }
    
    // STAGE 4: matching → ready (100%)
    // 
    // TRUTH HIERARCHY (check in this order):
    // 1. match_count >= TARGET → ready (durable truth)
    // 2. queue item exists and processing → wait (ephemeral state)
    // 3. match_count == 0 and no queue item → enqueue (needs work)
    if (job.status === 'matching') {
      // Get durable truth: how many matches exist?
      const matchCount = await getExactCount(
        supabase.from('startup_investor_matches').eq('startup_id', job.startup_id)
      );
      
      // Get ephemeral state: is queue still processing?
      const { data: queueItem } = await supabase
        .from('match_generation_queue')
        .select('status, attempts, last_error')
        .eq('startup_id', job.startup_id)
        .in('status', ['pending', 'processing'])
        .maybeSingle();
      
      const queueStatus = queueItem?.status || null;
      
      // DECISION TREE (monotonic, idempotent)
      
      // CASE 1: Matches meet target → READY (SOURCE OF TRUTH)
      if (matchCount >= MATCH_COUNT_TARGET) {
        await supabase
          .from('startup_jobs')
          .update({ 
            status: 'ready', 
            progress_percent: 100,
            match_count: matchCount,
            finished_at: new Date().toISOString()
          })
          .eq('id', job.id);
        
        logJobDecision(job.id, job.startup_id, queueStatus, matchCount, 'advance_ready');
        console.log(`  ✅ Advanced to ready (100%) with ${matchCount} matches`);
        return { success: true };
      }
      
      // CASE 2: Queue is actively processing → WAIT
      if (queueStatus === 'pending' || queueStatus === 'processing') {
        logJobDecision(job.id, job.startup_id, queueStatus, matchCount, 'wait_queue');
        console.log(`  ⏳ Waiting for match generation (queue: ${queueStatus}, matches: ${matchCount}/${MATCH_COUNT_TARGET})`);
        return { success: true, waiting: true };
      }
      
      // CASE 3: No queue item, no matches → ENQUEUE
      if (matchCount === 0) {
        await supabase.rpc('manually_queue_startup', {
          p_startup_id: job.startup_id,
          p_priority: 200
        });
        logJobDecision(job.id, job.startup_id, queueStatus, matchCount, 'enqueue', { 
          reason: 'no_matches_no_queue' 
        });
        console.log(`  🔄 Enqueued for match generation (matches: ${matchCount})`);
        return { success: true, waiting: true };
      }
      
      // CASE 4: Partial matches but no queue item → WAIT (might be processing)
      logJobDecision(job.id, job.startup_id, queueStatus, matchCount, 'wait_partial', {
        reason: 'below_target_no_active_queue'
      });
      console.log(`  ⏳ Partial matches (${matchCount}/${MATCH_COUNT_TARGET}), waiting for completion...`);
      return { success: true, waiting: true };
    }
    
    return { success: true, skipped: true };
    
  } catch (err) {
    console.error(`  ❌ Error processing job:`, err.message);
    
    // Mark as failed
    await supabase
      .from('startup_jobs')
      .update({ 
        status: 'failed',
        error_message: err.message,
        finished_at: new Date().toISOString()
      })
      .eq('id', job.id);
    
    return { success: false, error: err.message };
  }
}

/**
 * Main processing loop
 */
async function runProcessor() {
  console.log('🚀 Discovery Job Processor Starting...\n');
  
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let waiting = 0;
  
  while (true) {
    try {
      // Get all active jobs (not ready, not failed)
      const { data: jobs, error: jobsErr } = await supabase
        .from('startup_jobs')
        .select('id, startup_id, url, url_normalized, status, progress_percent, created_at, updated_at')
        .in('status', ['queued', 'building', 'scoring', 'matching'])
        .order('created_at', { ascending: true })
        .limit(10); // Process 10 at a time
      
      if (jobsErr) {
        console.error('❌ Error fetching jobs:', jobsErr.message);
        await sleep(POLL_INTERVAL);
        continue;
      }
      
      if (!jobs || jobs.length === 0) {
        // No jobs to process, wait
        if (processed > 0) {
          console.log(`\n📊 Cycle complete: ${processed} processed, ${succeeded} succeeded, ${failed} failed, ${waiting} waiting`);
          processed = succeeded = failed = waiting = 0;
        }
        await sleep(POLL_INTERVAL);
        continue;
      }
      
      console.log(`\n📋 Found ${jobs.length} active jobs`);
      
      // Process each job
      for (const job of jobs) {
        const result = await processJob(job);
        processed++;
        
        if (result.success) {
          if (result.waiting) {
            waiting++;
          } else {
            succeeded++;
          }
        } else {
          failed++;
        }
        
        // Small delay between jobs
        await sleep(500);
      }
      
      // Wait before next cycle
      await sleep(POLL_INTERVAL);
      
    } catch (err) {
      console.error('\n❌ Fatal error in processing loop:', err);
      await sleep(POLL_INTERVAL * 2); // Longer wait on fatal error
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Run
runProcessor().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
