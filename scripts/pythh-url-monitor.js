#!/usr/bin/env node

/**
 * PYTHH URL MONITOR - AI Health Agent
 * 
 * Monitors the SUBMIT URL and Matching Engine pipelines.
 * Auto-heals when issues are detected.
 * 
 * Runs via PM2 on a 5-minute cron schedule.
 * 
 * Monitors:
 * 1. Instant Submit API health
 * 2. Match generation rates
 * 3. Queue processor status
 * 4. Response times
 * 5. Error rates
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Thresholds for alerts
const THRESHOLDS = {
  // Response time
  INSTANT_API_MAX_MS: 5000, // 5 seconds max for instant API
  CACHED_API_MAX_MS: 1000,  // 1 second max for cached
  
  // Match rates
  MIN_MATCHES_PER_STARTUP: 50,
  MAX_ZERO_MATCH_STARTUPS: 10, // Alert if more than 10 startups have 0 matches
  
  // Queue health
  MAX_QUEUED_JOBS: 100,
  MAX_JOB_AGE_HOURS: 2,
  
  // Error rates
  MAX_ERROR_PERCENT: 10,
  
  // Data freshness
  MAX_STARTUP_AGE_HOURS: 6, // New startups should be created within 6 hours
};

/**
 * Check Instant API health
 */
async function checkInstantAPI() {
  const issues = [];
  let status = 'OK';
  
  try {
    const start = Date.now();
    const response = await fetch('http://localhost:3002/api/instant/health', {
      timeout: 10000
    });
    const elapsed = Date.now() - start;
    
    if (!response.ok) {
      status = 'ERROR';
      issues.push(`API health check failed: ${response.status}`);
    } else if (elapsed > THRESHOLDS.INSTANT_API_MAX_MS) {
      status = 'WARN';
      issues.push(`API slow: ${elapsed}ms (threshold: ${THRESHOLDS.INSTANT_API_MAX_MS}ms)`);
    }
    
    const data = await response.json();
    console.log(`  ✓ Instant API: ${elapsed}ms, ${data.active_investors} active investors`);
    
    if (data.active_investors < 100) {
      status = 'WARN';
      issues.push(`Low investor count: ${data.active_investors}`);
    }
  } catch (err) {
    status = 'ERROR';
    issues.push(`API unreachable: ${err.message}`);
  }
  
  return { name: 'Instant API Health', status, issues };
}

/**
 * Check match coverage
 */
async function checkMatchCoverage() {
  const issues = [];
  let status = 'OK';
  
  try {
    // Get count of startups with matches
    const { count: totalStartups } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    
    const { count: totalMatches } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'suggested');
    
    // Get startups created in last 6 hours that might need matches
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentStartups } = await supabase
      .from('startup_uploads')
      .select('id, name')
      .eq('status', 'approved')
      .gte('created_at', sixHoursAgo)
      .limit(50);
    
    // Check which recent startups have matches
    let zeroMatchCount = 0;
    const zeroMatchStartups = [];
    
    for (const startup of (recentStartups || [])) {
      const { count } = await supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true })
        .eq('startup_id', startup.id);
      
      if (!count || count === 0) {
        zeroMatchCount++;
        zeroMatchStartups.push(startup);
        if (zeroMatchStartups.length >= 5) break; // Limit for performance
      }
    }
    
    if (zeroMatchCount > THRESHOLDS.MAX_ZERO_MATCH_STARTUPS) {
      status = 'WARN';
      issues.push(`${zeroMatchCount} recent startups with 0 matches`);
      
      console.log(`  ⚠ Zero-match startups:`);
      zeroMatchStartups.slice(0, 5).forEach(s => {
        console.log(`    - ${s.name} (${s.id})`);
      });
    }
    
    const avgMatchesPerStartup = totalStartups > 0 ? Math.round(totalMatches / totalStartups) : 0;
    
    console.log(`  ✓ Match coverage: ${totalMatches} matches for ${totalStartups} startups (avg: ${avgMatchesPerStartup})`);
    
    if (avgMatchesPerStartup < THRESHOLDS.MIN_MATCHES_PER_STARTUP) {
      status = status === 'ERROR' ? 'ERROR' : 'WARN';
      issues.push(`Low avg matches: ${avgMatchesPerStartup} (threshold: ${THRESHOLDS.MIN_MATCHES_PER_STARTUP})`);
    }
    
  } catch (err) {
    status = 'ERROR';
    issues.push(`Check failed: ${err.message}`);
  }
  
  return { name: 'Match Coverage', status, issues };
}

/**
 * Check queue health
 */
async function checkQueueHealth() {
  const issues = [];
  let status = 'OK';
  
  try {
    // Check startup_jobs queue
    const { data: queuedJobs } = await supabase
      .from('startup_jobs')
      .select('id, status, created_at')
      .in('status', ['queued', 'building', 'scoring', 'matching'])
      .order('created_at', { ascending: true });
    
    const queueSize = queuedJobs?.length || 0;
    
    if (queueSize > THRESHOLDS.MAX_QUEUED_JOBS) {
      status = 'WARN';
      issues.push(`Queue backlog: ${queueSize} jobs (threshold: ${THRESHOLDS.MAX_QUEUED_JOBS})`);
    }
    
    // Check for stuck jobs
    const cutoff = new Date(Date.now() - THRESHOLDS.MAX_JOB_AGE_HOURS * 60 * 60 * 1000);
    const stuckJobs = queuedJobs?.filter(j => new Date(j.created_at) < cutoff) || [];
    
    if (stuckJobs.length > 0) {
      status = 'ERROR';
      issues.push(`${stuckJobs.length} stuck jobs (older than ${THRESHOLDS.MAX_JOB_AGE_HOURS}h)`);
    }
    
    // Check match generation queue
    const { data: matchQueue } = await supabase
      .from('match_generation_queue')
      .select('id, status, attempts, last_error')
      .in('status', ['pending', 'processing'])
      .limit(100);
    
    const matchQueueSize = matchQueue?.length || 0;
    const failedAttempts = matchQueue?.filter(m => m.attempts > 3).length || 0;
    
    console.log(`  ✓ Job queue: ${queueSize} jobs, Match queue: ${matchQueueSize} pending`);
    
    if (failedAttempts > 5) {
      status = status === 'ERROR' ? 'ERROR' : 'WARN';
      issues.push(`${failedAttempts} match jobs with repeated failures`);
    }
    
  } catch (err) {
    status = 'ERROR';
    issues.push(`Queue check failed: ${err.message}`);
  }
  
  return { name: 'Queue Health', status, issues };
}

/**
 * Check recent error rates
 */
async function checkErrorRates() {
  const issues = [];
  let status = 'OK';
  
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Check ai_logs for errors
    const { data: recentLogs } = await supabase
      .from('ai_logs')
      .select('log_type, action_type, output_data')
      .gte('created_at', oneHourAgo)
      .in('log_type', ['instant_submit', 'instant_match', 'error']);
    
    const totalLogs = recentLogs?.length || 0;
    const errorLogs = recentLogs?.filter(l => l.log_type === 'error').length || 0;
    const errorPercent = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;
    
    console.log(`  ✓ Error rate: ${errorPercent.toFixed(1)}% (${errorLogs}/${totalLogs} in last hour)`);
    
    if (errorPercent > THRESHOLDS.MAX_ERROR_PERCENT) {
      status = 'ERROR';
      issues.push(`High error rate: ${errorPercent.toFixed(1)}% (threshold: ${THRESHOLDS.MAX_ERROR_PERCENT}%)`);
    }
    
    // Check for recent instant_submit successes
    const instantLogs = recentLogs?.filter(l => l.log_type === 'instant_submit') || [];
    if (instantLogs.length > 0) {
      const avgTime = instantLogs.reduce((sum, l) => 
        sum + (l.output_data?.processing_time_ms || 0), 0) / instantLogs.length;
      
      console.log(`  ✓ Avg instant submit time: ${Math.round(avgTime)}ms (${instantLogs.length} requests)`);
      
      if (avgTime > THRESHOLDS.INSTANT_API_MAX_MS) {
        status = status === 'ERROR' ? 'ERROR' : 'WARN';
        issues.push(`Slow avg response: ${Math.round(avgTime)}ms`);
      }
    }
    
  } catch (err) {
    status = 'ERROR';
    issues.push(`Error rate check failed: ${err.message}`);
  }
  
  return { name: 'Error Rates', status, issues };
}

/**
 * Auto-heal issues
 */
async function performAutoHealing(checks) {
  const actions = [];
  
  for (const check of checks) {
    if (check.status === 'ERROR') {
      // Check for specific issues and attempt fixes
      
      // Fix: Restart discovery job processor if queue stuck
      if (check.name === 'Queue Health' && 
          check.issues.some(i => i.includes('stuck jobs'))) {
        console.log('  🔧 Auto-healing: Restarting discovery-job-processor...');
        try {
          const { exec } = require('child_process');
          await new Promise((resolve, reject) => {
            exec('pm2 restart discovery-job-processor', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          actions.push('Restarted discovery-job-processor');
        } catch (e) {
          console.error('  ✗ Failed to restart process:', e.message);
        }
      }
      
      // Fix: Trigger match generation for zero-match startups
      if (check.name === 'Match Coverage' &&
          check.issues.some(i => i.includes('0 matches'))) {
        console.log('  🔧 Auto-healing: Triggering matches for zero-match startups...');
        try {
          // Get startups needing matches
          const { data: needsMatches } = await supabase
            .from('startup_uploads')
            .select('id')
            .eq('status', 'approved')
            .is('startup_investor_matches.id', null)
            .limit(10);
          
          for (const s of (needsMatches || []).slice(0, 5)) {
            await fetch('http://localhost:3002/api/matches/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ startupId: s.id })
            });
          }
          actions.push(`Triggered matches for ${needsMatches?.length || 0} startups`);
        } catch (e) {
          console.error('  ✗ Failed to trigger matches:', e.message);
        }
      }
    }
  }
  
  return actions;
}

/**
 * Run all checks
 */
async function runMonitor() {
  console.log('\n🔍 PYTHH URL Monitor - Health Check');
  console.log('=' .repeat(50));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');
  
  const checks = [];
  
  // Run all checks
  console.log('📡 Checking Instant API...');
  checks.push(await checkInstantAPI());
  
  console.log('📊 Checking Match Coverage...');
  checks.push(await checkMatchCoverage());
  
  console.log('⏱️ Checking Queue Health...');
  checks.push(await checkQueueHealth());
  
  console.log('⚠️ Checking Error Rates...');
  checks.push(await checkErrorRates());
  
  // Determine overall status
  const hasError = checks.some(c => c.status === 'ERROR');
  const hasWarn = checks.some(c => c.status === 'WARN');
  const overallStatus = hasError ? 'ERROR' : (hasWarn ? 'WARN' : 'OK');
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  
  for (const check of checks) {
    const icon = check.status === 'OK' ? '✅' : (check.status === 'WARN' ? '⚠️' : '❌');
    console.log(`${icon} ${check.name}: ${check.status}`);
    if (check.issues.length > 0) {
      check.issues.forEach(i => console.log(`   └─ ${i}`));
    }
  }
  
  console.log('');
  console.log(`Overall Status: ${overallStatus === 'OK' ? '✅' : (overallStatus === 'WARN' ? '⚠️' : '❌')} ${overallStatus}`);
  
  // Auto-heal if needed
  let actions = [];
  if (overallStatus === 'ERROR') {
    console.log('\n🔧 Attempting auto-healing...');
    actions = await performAutoHealing(checks);
    if (actions.length > 0) {
      console.log('Actions taken:');
      actions.forEach(a => console.log(`  - ${a}`));
    }
  }
  
  // Log to database
  try {
    await supabase.from('ai_logs').insert({
      log_type: 'url_monitor',
      action_type: 'health_check',
      input_data: { timestamp: new Date().toISOString() },
      output_data: {
        overall: overallStatus,
        checks: checks.map(c => ({
          name: c.name,
          status: c.status,
          issues: c.issues
        })),
        actions
      },
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to log to database:', e.message);
  }
  
  console.log('\n✅ Monitor check complete\n');
}

// Run
runMonitor().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
