/**
 * Match Worker - Pure State Machine
 * 
 * Processes match_runs from queue with lease-based locking
 * Guarantees:
 * - Idempotent processing (can resume after crash)
 * - Lease expiration allows takeover by other workers
 * - Progress tracking at each step
 * - Full observability via debug_context
 */

import { createClient } from '@supabase/supabase-js';
import { canonicalizeUrl, extractDomainKey } from './utils/urlCanonicalizer';

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;
const LEASE_SECONDS = 60;
const LEASE_EXTEND_INTERVAL = 30000; // Extend every 30s
const POLL_INTERVAL = 5000; // Poll for new jobs every 5s

interface MatchRun {
  run_id: string;
  startup_id: string;
  status: string;
  progress_step: string | null;
  debug_context: any;
}

interface StartupData {
  id: string;
  name: string;
  url: string;
  canonical_url: string;
  domain_key: string;
  extracted_data: any;
  sectors?: string[];
  stage?: string;
  team_score?: number;
  traction_score?: number;
  market_score?: number;
  product_score?: number;
  vision_score?: number;
  total_god_score?: number;
}

/**
 * Main worker loop
 */
async function runWorker() {
  console.log(`[Worker ${WORKER_ID}] Starting...`);
  
  while (true) {
    try {
      // Find next available run
      const run = await claimNextRun();
      
      if (run) {
        await processRun(run);
      } else {
        // No work available, wait before polling again
        await sleep(POLL_INTERVAL);
      }
      
    } catch (error) {
      console.error(`[Worker ${WORKER_ID}] Loop error:`, error);
      await sleep(POLL_INTERVAL);
    }
  }
}

/**
 * Claim next available run from queue
 */
async function claimNextRun(): Promise<MatchRun | null> {
  try {
    // Find runs that are queued OR have expired leases
    const { data: runs, error } = await supabase
      .from('match_runs')
      .select('*')
      .or('status.eq.queued,and(status.eq.processing,lock_expires_at.lt.now())')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (error || !runs || runs.length === 0) {
      return null;
    }
    
    const run = runs[0];
    
    // Try to acquire lease
    const { data: acquired, error: leaseError } = await supabase.rpc(
      'acquire_match_run_lease',
      {
        p_run_id: run.run_id,
        p_worker_id: WORKER_ID,
        p_lease_seconds: LEASE_SECONDS
      }
    );
    
    if (leaseError || !acquired) {
      // Another worker grabbed it
      return null;
    }
    
    console.log(`[Worker ${WORKER_ID}] Claimed run ${run.run_id}`);
    return run;
    
  } catch (error) {
    console.error(`[Worker ${WORKER_ID}] Claim error:`, error);
    return null;
  }
}

/**
 * Process a single match run through all steps
 */
async function processRun(run: MatchRun) {
  const runId = run.run_id;
  const startupId = run.startup_id;
  
  console.log(`[Worker ${WORKER_ID}] Processing run ${runId} for startup ${startupId}`);
  
  // Start lease extension interval
  const leaseInterval = setInterval(async () => {
    await extendLease(runId);
  }, LEASE_EXTEND_INTERVAL);
  
  try {
    const debugContext: any = { steps: [] };
    
    // Step 1: Resolve/validate startup
    await updateProgress(runId, 'resolve');
    const startup = await resolveStartup(startupId, debugContext);
    if (!startup) {
      await failRun(runId, 'STARTUP_NOT_FOUND', 'Startup not found in database');
      return;
    }
    
    // Step 2: Extract data (if not already done)
    await updateProgress(runId, 'extract');
    const extracted = await extractStartupData(startup, debugContext);
    if (!extracted) {
      await failRun(runId, 'EXTRACTION_FAILED', 'Failed to extract startup data');
      return;
    }
    
    // Step 3: Parse and validate data
    await updateProgress(runId, 'parse');
    const parsed = await parseStartupData(extracted, debugContext);
    if (!parsed.valid) {
      await failRun(runId, 'PARSE_FAILED', `Parsing failed: ${parsed.reason}`);
      return;
    }
    
    // Step 4: Generate matches
    await updateProgress(runId, 'match');
    const candidates = await generateMatches(startup, debugContext);
    debugContext.candidateCount = candidates.length;
    
    // Step 5: Rank matches
    await updateProgress(runId, 'rank');
    const ranked = await rankMatches(startup, candidates, debugContext);
    debugContext.rankedCount = ranked.length;
    
    // Step 6: Finalize (save to DB)
    await updateProgress(runId, 'finalize');
    const saved = await saveMatches(startupId, ranked, debugContext);
    debugContext.savedCount = saved;
    
    // Complete run
    await supabase.rpc('complete_match_run', {
      p_run_id: runId,
      p_worker_id: WORKER_ID,
      p_match_count: saved,
      p_status: 'ready'
    });
    
    // Update debug context
    await supabase
      .from('match_runs')
      .update({ debug_context: debugContext })
      .eq('run_id', runId);
    
    console.log(`[Worker ${WORKER_ID}] Completed run ${runId} - ${saved} matches`);
    
  } catch (error) {
    console.error(`[Worker ${WORKER_ID}] Processing error:`, error);
    await failRun(
      runId, 
      'PROCESSING_ERROR', 
      error instanceof Error ? error.message : 'Unknown error'
    );
  } finally {
    clearInterval(leaseInterval);
  }
}

/**
 * Update progress step
 */
async function updateProgress(runId: string, step: string) {
  await supabase
    .from('match_runs')
    .update({ progress_step: step })
    .eq('run_id', runId);
  
  console.log(`[Worker ${WORKER_ID}] Run ${runId} → ${step}`);
}

/**
 * Extend lease while processing
 */
async function extendLease(runId: string) {
  const { data: extended } = await supabase.rpc('extend_match_run_lease', {
    p_run_id: runId,
    p_worker_id: WORKER_ID,
    p_lease_seconds: LEASE_SECONDS
  });
  
  if (extended) {
    console.log(`[Worker ${WORKER_ID}] Extended lease for ${runId}`);
  }
}

/**
 * Fail a run
 */
async function failRun(runId: string, errorCode: string, errorMessage: string) {
  await supabase.rpc('fail_match_run', {
    p_run_id: runId,
    p_worker_id: WORKER_ID,
    p_error_code: errorCode,
    p_error_message: errorMessage
  });
  
  console.error(`[Worker ${WORKER_ID}] Run ${runId} failed: ${errorCode} - ${errorMessage}`);
}

/**
 * Step 1: Resolve startup
 */
async function resolveStartup(startupId: string, debugContext: any): Promise<StartupData | null> {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('id', startupId)
    .single();
  
  debugContext.steps.push({
    step: 'resolve',
    startupFound: !!data,
    error: error?.message
  });
  
  return data || null;
}

/**
 * Step 2: Extract startup data (scraping/API)
 */
async function extractStartupData(startup: StartupData, debugContext: any): Promise<StartupData | null> {
  // If already extracted, use existing data
  if (startup.extracted_data && Object.keys(startup.extracted_data).length > 5) {
    debugContext.steps.push({
      step: 'extract',
      source: 'cached',
      fieldCount: Object.keys(startup.extracted_data).length
    });
    return startup;
  }
  
  // TODO: Call your extractor service here
  // For now, assume extraction happens elsewhere or use existing data
  
  debugContext.steps.push({
    step: 'extract',
    source: 'skipped',
    reason: 'Using existing data'
  });
  
  return startup;
}

/**
 * Step 3: Parse and validate data
 */
async function parseStartupData(startup: StartupData, debugContext: any): Promise<{ valid: boolean; reason?: string }> {
  const issues = [];
  
  // Check for required fields
  if (!startup.name || startup.name === startup.domain_key) {
    issues.push('Missing real name');
  }
  
  if (!startup.sectors || startup.sectors.length === 0) {
    issues.push('Missing sectors');
  }
  
  if (!startup.total_god_score || startup.total_god_score < 40) {
    issues.push('GOD score too low or missing');
  }
  
  const valid = issues.length === 0;
  
  debugContext.steps.push({
    step: 'parse',
    valid,
    issues
  });
  
  return {
    valid,
    reason: issues.length > 0 ? issues.join(', ') : undefined
  };
}

/**
 * Step 4: Generate match candidates
 */
async function generateMatches(startup: StartupData, debugContext: any): Promise<any[]> {
  const { data: investors, error } = await supabase
    .from('investors')
    .select('*')
    .not('sectors', 'is', null);
  
  if (error || !investors) {
    debugContext.steps.push({
      step: 'match',
      error: error?.message,
      candidateCount: 0
    });
    return [];
  }
  
  // Filter by sector overlap
  const startupSectors = new Set(startup.sectors || []);
  const candidates = investors.filter(investor => {
    const investorSectors = investor.sectors || [];
    return investorSectors.some((s: string) => startupSectors.has(s));
  });
  
  debugContext.steps.push({
    step: 'match',
    totalInvestors: investors.length,
    candidateCount: candidates.length,
    sectorOverlapRequired: true
  });
  
  return candidates;
}

/**
 * Step 5: Rank matches
 */
async function rankMatches(startup: StartupData, candidates: any[], debugContext: any): Promise<any[]> {
  // Simple scoring: sector overlap + stage match + GOD score bonus
  const ranked = candidates.map(investor => {
    let score = 50; // Base score
    
    // Sector overlap
    const startupSectors = new Set(startup.sectors || []);
    const investorSectors = new Set(investor.sectors || []);
    const overlap = [...startupSectors].filter(s => investorSectors.has(s)).length;
    score += overlap * 5;
    
    // Stage match
    if (startup.stage && investor.stage && startup.stage === investor.stage) {
      score += 10;
    }
    
    // GOD score bonus
    if (startup.total_god_score) {
      score += (startup.total_god_score / 100) * 20;
    }
    
    return {
      investor_id: investor.id,
      match_score: Math.min(100, Math.round(score)),
      match_reasoning: `Sector overlap: ${overlap}, Stage: ${startup.stage || 'unknown'}`
    };
  });
  
  // Filter to 70+ score
  const filtered = ranked.filter(m => m.match_score >= 70);
  
  // Sort by score
  filtered.sort((a, b) => b.match_score - a.match_score);
  
  debugContext.steps.push({
    step: 'rank',
    totalCandidates: candidates.length,
    qualifiedMatches: filtered.length,
    threshold: 70
  });
  
  return filtered;
}

/**
 * Step 6: Save matches to database
 */
async function saveMatches(startupId: string, matches: any[], debugContext: any): Promise<number> {
  // Delete old suggested matches for this startup
  await supabase
    .from('startup_investor_matches')
    .delete()
    .eq('startup_id', startupId)
    .eq('status', 'suggested');
  
  if (matches.length === 0) {
    debugContext.steps.push({
      step: 'finalize',
      saved: 0
    });
    return 0;
  }
  
  // Insert new matches
  const rows = matches.map(m => ({
    startup_id: startupId,
    investor_id: m.investor_id,
    match_score: m.match_score,
    match_reasoning: m.match_reasoning,
    status: 'suggested'
  }));
  
  const { data, error } = await supabase
    .from('startup_investor_matches')
    .insert(rows)
    .select();
  
  const saved = data?.length || 0;
  
  debugContext.steps.push({
    step: 'finalize',
    attempted: matches.length,
    saved,
    error: error?.message
  });
  
  return saved;
}

/**
 * Utility: sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start worker if run directly
if (require.main === module) {
  console.log('Starting match worker...');
  runWorker().catch(error => {
    console.error('Worker crashed:', error);
    process.exit(1);
  });
}

export { runWorker, WORKER_ID };
