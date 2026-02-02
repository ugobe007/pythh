/**
 * Match Run API Routes
 * 
 * Two endpoints only:
 * - POST /api/match/run - Start or get existing run (idempotent)
 * - GET /api/match/run/:runId - Check status and get results
 * - GET /api/match/run/:runId/debug - Debug info (dev/admin only)
 * 
 * Frontend contract: poll GET until status = ready or error
 */

import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { canonicalizeUrl, extractDomainKey, validateStartupUrl } from '../utils/urlCanonicalizer';

const router = express.Router();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface MatchRunResponse {
  runId: string;
  startupId: string;
  status: 'created' | 'queued' | 'processing' | 'ready' | 'error';
  progressStep?: string;
  matchCount: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  matches?: any[]; // Only included when status = ready
}

/**
 * POST /api/match/run
 * 
 * Start a match run or return existing active run (idempotent)
 * 
 * Body: { url: string }
 * Returns: { runId, startupId, status, ... }
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Validate URL
    const validation = validateStartupUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid URL', 
        reason: validation.reason 
      });
    }
    
    // Canonicalize
    const canonicalUrl = canonicalizeUrl(url);
    const domainKey = extractDomainKey(url);
    
    console.log('[match/run] Canonicalized:', { url, canonicalUrl, domainKey });
    
    // Find or create startup
    let startup;
    
    // Try to find by domain_key first
    const { data: existingByDomain } = await supabase
      .from('startup_uploads')
      .select('id, name, canonical_url, domain_key')
      .eq('domain_key', domainKey)
      .single();
    
    if (existingByDomain) {
      startup = existingByDomain;
      console.log('[match/run] Found existing startup by domain_key:', startup.id);
    } else {
      // Try by canonical_url
      const { data: existingByUrl } = await supabase
        .from('startup_uploads')
        .select('id, name, canonical_url, domain_key')
        .eq('canonical_url', canonicalUrl)
        .single();
      
      if (existingByUrl) {
        startup = existingByUrl;
        console.log('[match/run] Found existing startup by canonical_url:', startup.id);
      } else {
        // Create new startup placeholder
        const { data: newStartup, error: createError } = await supabase
          .from('startup_uploads')
          .insert({
            name: domainKey, // Temporary name, will be extracted later
            canonical_url: canonicalUrl,
            domain_key: domainKey,
            url: url,
            status: 'pending',
            source: 'match_engine'
          })
          .select()
          .single();
        
        if (createError) {
          console.error('[match/run] Failed to create startup:', createError);
          return res.status(500).json({ 
            error: 'Failed to create startup',
            details: createError.message 
          });
        }
        
        startup = newStartup;
        console.log('[match/run] Created new startup:', startup.id);
      }
    }
    
    // Get or create match run (idempotent via DB function)
    const { data: runId, error: runError } = await supabase.rpc(
      'get_or_create_match_run',
      { p_startup_id: startup.id }
    );
    
    if (runError) {
      console.error('[match/run] Failed to get/create run:', runError);
      return res.status(500).json({ 
        error: 'Failed to create match run',
        details: runError.message 
      });
    }
    
    // Fetch run details
    const { data: run, error: fetchError } = await supabase
      .from('match_runs')
      .select('*')
      .eq('run_id', runId)
      .single();
    
    if (fetchError || !run) {
      console.error('[match/run] Failed to fetch run:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch run details' });
    }
    
    // Queue for worker processing if newly created
    if (run.status === 'created') {
      await supabase
        .from('match_runs')
        .update({ status: 'queued' })
        .eq('run_id', runId);
      
      run.status = 'queued';
    }
    
    const response: MatchRunResponse = {
      runId: run.run_id,
      startupId: run.startup_id,
      status: run.status,
      progressStep: run.progress_step,
      matchCount: run.match_count || 0,
      errorCode: run.error_code,
      errorMessage: run.error_message,
      createdAt: run.created_at,
      updatedAt: run.updated_at
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('[match/run] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/match/run/:runId
 * 
 * Get status and results of a match run
 * 
 * Returns: { runId, status, progressStep, matchCount, matches?, ... }
 */
router.get('/run/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    
    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }
    
    // Fetch run
    const { data: run, error: runError } = await supabase
      .from('match_runs')
      .select('*')
      .eq('run_id', runId)
      .single();
    
    if (runError || !run) {
      return res.status(404).json({ error: 'Match run not found' });
    }
    
    const response: MatchRunResponse = {
      runId: run.run_id,
      startupId: run.startup_id,
      status: run.status,
      progressStep: run.progress_step,
      matchCount: run.match_count || 0,
      errorCode: run.error_code,
      errorMessage: run.error_message,
      createdAt: run.created_at,
      updatedAt: run.updated_at
    };
    
    // If ready, include matches
    if (run.status === 'ready') {
      const { data: matches, error: matchesError } = await supabase
        .from('startup_investor_matches')
        .select(`
          id,
          match_score,
          match_reasoning,
          investor_id,
          investors (
            id,
            name,
            firm,
            logo_url,
            sectors,
            stage,
            check_size_min,
            check_size_max
          )
        `)
        .eq('startup_id', run.startup_id)
        .eq('status', 'suggested')
        .gte('match_score', 70)
        .order('match_score', { ascending: false })
        .limit(50);
      
      if (!matchesError && matches) {
        response.matches = matches;
      }
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('[match/run] Get run error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/match/run/:runId/debug
 * 
 * Debug info for troubleshooting (dev/admin only)
 * 
 * Returns: { run, logs, stats, diagnostics }
 */
router.get('/run/:runId/debug', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    
    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }
    
    // Fetch run with full details
    const { data: run, error: runError } = await supabase
      .from('match_runs')
      .select('*')
      .eq('run_id', runId)
      .single();
    
    if (runError || !run) {
      return res.status(404).json({ error: 'Match run not found' });
    }
    
    // Fetch startup details
    const { data: startup } = await supabase
      .from('startup_uploads')
      .select('id, name, url, canonical_url, domain_key, status, extracted_data')
      .eq('id', run.startup_id)
      .single();
    
    // Fetch related logs from ai_logs
    const { data: logs } = await supabase
      .from('ai_logs')
      .select('*')
      .or(`output->>runId.eq.${runId},output->>startupId.eq.${run.startup_id}`)
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Count matches by status
    const { data: matchStats } = await supabase
      .from('startup_investor_matches')
      .select('status')
      .eq('startup_id', run.startup_id);
    
    const statusCounts = matchStats?.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    // Diagnostics
    const diagnostics = {
      hasExtractedData: !!startup?.extracted_data,
      extractedFieldCount: startup?.extracted_data 
        ? Object.keys(startup.extracted_data).length 
        : 0,
      matchStatusBreakdown: statusCounts,
      leaseExpired: run.lock_expires_at 
        ? new Date(run.lock_expires_at) < new Date()
        : null,
      isStuck: run.status === 'processing' 
        && run.lock_expires_at 
        && new Date(run.lock_expires_at) < new Date(),
      timeSinceUpdate: Date.now() - new Date(run.updated_at).getTime(),
    };
    
    res.json({
      run,
      startup,
      logs: logs || [],
      diagnostics,
      debugContext: run.debug_context || {}
    });
    
  } catch (error) {
    console.error('[match/run] Debug error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
