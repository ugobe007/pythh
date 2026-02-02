/**
 * INTEGRATION TEST: Job Transitions
 * ==================================
 * Tests the full job lifecycle with real database state.
 * 
 * Setup:
 * 1. Seed 1 test startup with 1000 matches
 * 2. Create a job in "matching" status
 * 3. Run worker tick
 * 4. Assert job becomes "ready" without queue insert
 * 
 * This validates:
 * - Worker uses getExactCount() correctly
 * - Worker checks matches before queue
 * - Job transitions are idempotent
 * - No infinite requeueing
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function setupTestData() {
  console.log('📦 Setting up test data...\n');
  
  // 1. Create test startup
  const { data: startup, error: startupErr } = await supabase
    .from('startup_uploads')
    .insert({
      name: 'Test Startup for Job Transition',
      url: 'test-job-transition.com',
      url_normalized: 'test-job-transition.com',
      status: 'approved',
      sectors: ['Technology'],
      stage: 2,
      total_god_score: 65,
      signal_strength: 7.5,
      phase_score: 0.8,
      signal_band: 'high',
      tier: 'promising'
    })
    .select('id')
    .single();
  
  if (startupErr) {
    throw new Error(`Failed to create test startup: ${startupErr.message}`);
  }
  
  const startupId = startup.id;
  console.log(`  ✅ Created test startup: ${startupId}`);
  
  // 2. Get first 1000 active investors
  const { data: investors } = await supabase
    .from('investors')
    .select('id')
    .eq('status', 'active')
    .limit(1000);
  
  if (!investors || investors.length < 1000) {
    throw new Error(`Not enough active investors (found ${investors?.length || 0})`);
  }
  
  console.log(`  ✅ Found ${investors.length} active investors`);
  
  // 3. Create 1000 matches (batch insert)
  const matches = investors.map((inv, idx) => ({
    startup_id: startupId,
    investor_id: inv.id,
    match_score: 50 + Math.random() * 50, // 50-100 range
    status: 'active',
    reasoning: { test: true }
  }));
  
  const { error: matchErr } = await supabase
    .from('startup_investor_matches')
    .insert(matches);
  
  if (matchErr) {
    throw new Error(`Failed to create matches: ${matchErr.message}`);
  }
  
  console.log(`  ✅ Created 1000 matches`);
  
  // 4. Create job in "matching" status (simulating stuck job)
  const { data: job, error: jobErr } = await supabase
    .from('startup_jobs')
    .insert({
      startup_id: startupId,
      url: 'test-job-transition.com',
      url_normalized: 'test-job-transition.com',
      status: 'matching',
      progress_percent: 60
    })
    .select('id')
    .single();
  
  if (jobErr) {
    throw new Error(`Failed to create job: ${jobErr.message}`);
  }
  
  console.log(`  ✅ Created job: ${job.id}`);
  
  return { startupId, jobId: job.id };
}

async function cleanupTestData(startupId) {
  console.log('\n🧹 Cleaning up test data...');
  
  // Delete in reverse dependency order
  await supabase.from('startup_jobs').delete().eq('startup_id', startupId);
  await supabase.from('startup_investor_matches').delete().eq('startup_id', startupId);
  await supabase.from('startup_uploads').delete().eq('id', startupId);
  
  console.log('  ✅ Cleanup complete');
}

async function runWorkerTick(jobId) {
  console.log('\n⚙️  Running worker tick...\n');
  
  // Import the actual worker logic
  const { processJob } = require('../process-discovery-jobs');
  
  // Get the job
  const { data: job } = await supabase
    .from('startup_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (!job) {
    throw new Error('Job not found');
  }
  
  // Process it
  const result = await processJob(job);
  
  console.log(`  Worker result:`, result);
  
  return result;
}

async function verifyJobReady(jobId, startupId) {
  console.log('\n🔍 Verifying job state...\n');
  
  // 1. Check job status
  const { data: job } = await supabase
    .from('startup_jobs')
    .select('status, progress_percent, match_count')
    .eq('id', jobId)
    .single();
  
  if (!job) {
    throw new Error('Job not found after processing');
  }
  
  console.log(`  Job status: ${job.status}`);
  console.log(`  Progress: ${job.progress_percent}%`);
  console.log(`  Match count: ${job.match_count}`);
  
  // Assertions
  if (job.status !== 'ready') {
    throw new Error(`Expected status='ready', got '${job.status}'`);
  }
  
  if (job.progress_percent !== 100) {
    throw new Error(`Expected progress=100, got ${job.progress_percent}`);
  }
  
  if (job.match_count < 1000) {
    throw new Error(`Expected match_count >= 1000, got ${job.match_count}`);
  }
  
  // 2. Check no queue item was created
  const { data: queueItem } = await supabase
    .from('match_generation_queue')
    .select('id')
    .eq('startup_id', startupId)
    .maybeSingle();
  
  if (queueItem) {
    throw new Error('Queue item should NOT exist (job should transition without enqueueing)');
  }
  
  console.log('\n  ✅ Job correctly transitioned to ready');
  console.log('  ✅ No queue item created (idempotent)');
  console.log('  ✅ Match count captured correctly');
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runIntegrationTest() {
  console.log('🧪 INTEGRATION TEST: Job Transition with Existing Matches');
  console.log('='.repeat(80));
  console.log('');
  
  let testData = null;
  
  try {
    // Setup
    testData = await setupTestData();
    
    // Wait 2 seconds for database to settle
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run worker
    await runWorkerTick(testData.jobId);
    
    // Verify
    await verifyJobReady(testData.jobId, testData.startupId);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ INTEGRATION TEST PASSED');
    console.log('='.repeat(80));
    
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ INTEGRATION TEST FAILED');
    console.error('='.repeat(80));
    console.error('\nError:', err.message);
    console.error('\nStack:', err.stack);
    
    throw err;
    
  } finally {
    // Always cleanup
    if (testData) {
      await cleanupTestData(testData.startupId);
    }
  }
}

// Run if called directly
if (require.main === module) {
  runIntegrationTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runIntegrationTest };
