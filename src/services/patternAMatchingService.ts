/**
 * PATTERN A MATCHING SERVICE
 * RPC-first approach using Supabase database functions
 * 
 * Flow:
 * 1. start_match_run_fast(url) → Creates run, resolves startup_id
 * 2. get_match_run(run_id) → Poll for status + get matches
 * 
 * Benefits:
 * - URL resolution happens in PostgreSQL (faster, cached)
 * - Deduplication handled at DB level
 * - Match fetching is a single optimized query
 */

import { supabase } from '../lib/supabase';

// Types matching the RPC return types
export interface MatchRunResult {
  run_id: string;
  startup_id: string | null;
  startup_name: string | null;
  canonical_url: string;
  status: 'created' | 'queued' | 'processing' | 'completed' | 'error';
  step: 'resolve' | 'match' | 'finalize';
  match_count: number;
  error_code: string | null;
  error_message: string | null;
}

export interface MatchRunDetailResult extends MatchRunResult {
  matches: MatchResult[] | null;
}

export interface MatchResult {
  investor_id: string;
  investor_name: string;
  firm: string | null;
  match_score: number;
  sectors: string[] | null;
  stage: string[] | null;
  check_size_min: number | null;
  check_size_max: number | null;
}

/**
 * Start a match run for a URL
 * Uses the start_match_run_fast RPC which:
 * - Canonicalizes the URL
 * - Resolves to a startup_id (or finds existing)
 * - Creates a match_run record
 */
export async function startMatchRun(url: string): Promise<MatchRunResult> {
  console.log('[PatternA] Starting match run for:', url);
  
  const { data, error } = await supabase
    .rpc('start_match_run_fast', { input_url: url });
  
  if (error) {
    console.error('[PatternA] start_match_run_fast error:', error);
    throw new Error(`Failed to start match run: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    throw new Error('No data returned from start_match_run_fast');
  }
  
  const result = data[0] as MatchRunResult;
  console.log('[PatternA] Match run started:', result);
  
  return result;
}

/**
 * Get match run status and results
 * Uses the get_match_run RPC which returns:
 * - Current status/step
 * - Match count
 * - Full match results if completed
 */
export async function getMatchRun(runId: string): Promise<MatchRunDetailResult> {
  console.log('[PatternA] Getting match run:', runId);
  
  const { data, error } = await supabase
    .rpc('get_match_run', { input_run_id: runId });
  
  if (error) {
    console.error('[PatternA] get_match_run error:', error);
    throw new Error(`Failed to get match run: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    throw new Error('Match run not found');
  }
  
  const result = data[0] as MatchRunDetailResult;
  console.log('[PatternA] Match run status:', result.status, 'matches:', result.match_count);
  
  return result;
}

/**
 * Poll for match run completion
 * Waits for status to reach 'completed' or 'error'
 */
export async function waitForMatchRun(
  runId: string, 
  maxAttempts = 30, 
  intervalMs = 1000
): Promise<MatchRunDetailResult> {
  console.log('[PatternA] Waiting for match run:', runId);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await getMatchRun(runId);
    
    if (result.status === 'completed' || result.status === 'error') {
      return result;
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error('Match run timed out');
}

/**
 * Get matches directly for a startup (bypass run system)
 * Useful when startup_id is already known
 */
export async function getMatchesForStartup(
  startupId: string, 
  limit = 100
): Promise<MatchResult[]> {
  console.log('[PatternA] Getting matches for startup:', startupId);
  
  const { data, error } = await supabase
    .rpc('get_top_matches', { 
      p_startup_id: startupId,
      p_limit: limit 
    });
  
  if (error) {
    console.error('[PatternA] get_top_matches error:', error);
    throw new Error(`Failed to get matches: ${error.message}`);
  }
  
  return (data || []) as MatchResult[];
}

/**
 * Full matching flow: URL → Matches
 * Combines startMatchRun + waitForMatchRun
 */
export async function matchByUrl(url: string): Promise<{
  startupId: string;
  startupName: string;
  matches: MatchResult[];
}> {
  // Step 1: Start the match run
  const run = await startMatchRun(url);
  
  if (run.status === 'error') {
    throw new Error(run.error_message || 'Match run failed');
  }
  
  if (!run.startup_id) {
    throw new Error('Could not resolve startup from URL');
  }
  
  // Step 2: If already queued/processing, wait for completion
  // For now, we'll just fetch existing matches directly
  // (The match_runs system is for async processing)
  
  // Step 3: Get matches for the resolved startup
  const matches = await getMatchesForStartup(run.startup_id);
  
  return {
    startupId: run.startup_id,
    startupName: run.startup_name || 'Unknown Startup',
    matches
  };
}

/**
 * Quick lookup: Check if URL resolves to existing startup
 */
export async function resolveStartupFromUrl(url: string): Promise<{
  startupId: string | null;
  startupName: string | null;
  canonical_url: string;
}> {
  const run = await startMatchRun(url);
  
  return {
    startupId: run.startup_id,
    startupName: run.startup_name,
    canonical_url: run.canonical_url
  };
}
