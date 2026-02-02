/**
 * BULLETPROOF MATCHING ENGINE V1 - API ROUTES
 * 
 * Two endpoints, zero guesswork:
 * - POST /api/match/run   → Start/reuse match run
 * - GET  /api/match/run/:runId → Poll status + get matches
 * 
 * Thin wrappers over Supabase RPCs.
 * 
 * STAMPEDE PROTECTION:
 * - Per-runId rate limiting (10 req/min per IP)
 * - 3-second response cache for GET requests
 * - Worker limited to 1 run per 10 seconds
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// ====================================================================
// STAMPEDE PROTECTION - In-memory cache + rate limiting
// ====================================================================

// Cache: runId -> { response, timestamp }
const responseCache = new Map();
const CACHE_TTL = 3000; // 3 seconds

// Rate limiting: "runId:ip" -> [timestamps]
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per runId per IP

function checkRateLimit(runId, ip) {
  const key = `${runId}:${ip}`;
  const now = Date.now();
  
  // Get existing timestamps
  let timestamps = rateLimitStore.get(key) || [];
  
  // Remove old timestamps outside window
  timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  
  // Check if limit exceeded
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false; // Rate limit exceeded
  }
  
  // Add current timestamp
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  
  return true; // OK
}

function getCachedResponse(runId) {
  const cached = responseCache.get(runId);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    responseCache.delete(runId);
    return null;
  }
  
  return cached.response;
}

function cacheResponse(runId, response) {
  // Only cache terminal states (ready/error) and successful polls
  if (response.status === 'ready' || response.status === 'error' || response.status === 'queued' || response.status === 'processing') {
    responseCache.set(runId, {
      response,
      timestamp: Date.now()
    });
  }
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, validTimestamps);
    }
  }
  
  // Cleanup cache too
  for (const [runId, cached] of responseCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL) {
      responseCache.delete(runId);
    }
  }
}, 300000);

// ====================================================================
// POST /api/match/run
// ====================================================================
// Body: { url: string }
// Returns: { run_id, startup_id, status, step, match_count, ... }
// 
// Idempotent: Calling 20 times with same URL returns same run_id.
// ====================================================================

router.post('/run', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'URL required',
        code: 'INVALID_REQUEST'
      });
    }
    
    console.log('[match-run] POST /run', { url });
    
    // Call RPC (using fast version for now - bypasses slow resolve_startup_by_url)
    const { data, error } = await supabase.rpc('start_match_run_fast', {
      input_url: url
    });
    
    if (error) {
      console.error('[match-run] RPC error:', error);
      return res.status(500).json({
        error: 'Failed to start match run',
        code: 'RPC_ERROR',
        details: error.message
      });
    }
    
    const run = data?.[0];
    
    if (!run) {
      return res.status(500).json({
        error: 'No data returned from RPC',
        code: 'EMPTY_RESPONSE'
      });
    }
    
    console.log('[match-run] Created/reused run:', run.run_id, 'status:', run.status);
    
    return res.json(run);
    
  } catch (err) {
    console.error('[match-run] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ====================================================================
// GET /api/match/run/:runId
// ====================================================================
// Returns: { run_id, status, step, match_count, matches: [...], ... }
// 
// Frontend polls this every 2s until status='ready' or 'error'.
// ====================================================================

router.get('/run/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    
    if (!runId) {
      return res.status(400).json({
        error: 'run_id required',
        code: 'INVALID_REQUEST'
      });
    }
    
    // Rate limiting
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(runId, ip)) {
      console.warn('[match-run] Rate limit exceeded:', { runId, ip });
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        details: 'Max 10 requests per minute per run'
      });
    }
    
    // Check cache first
    const cached = getCachedResponse(runId);
    if (cached) {
      console.log('[match-run] Cache hit:', runId, 'status:', cached.status);
      return res.json(cached);
    }
    
    console.log('[match-run] GET /run/:runId', { runId });
    
    // Call RPC
    const { data, error } = await supabase.rpc('get_match_run', {
      input_run_id: runId
    });
    
    if (error) {
      console.error('[match-run] RPC error:', error);
      return res.status(500).json({
        error: 'Failed to get match run',
        code: 'RPC_ERROR',
        details: error.message
      });
    }
    
    const run = data?.[0];
    
    if (!run) {
      return res.status(404).json({
        error: 'Match run not found',
        code: 'RUN_NOT_FOUND'
      });
    }
    
    console.log('[match-run] Fetched run:', run.run_id, 'status:', run.status, 'match_count:', run.match_count);
    
    // Cache the response
    cacheResponse(runId, run);
    
    return res.json(run);
    
  } catch (err) {
    console.error('[match-run] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ====================================================================
// ADMIN: GET /api/match/runs (List recent runs)
// ====================================================================
// Optional: Admin endpoint to see recent match runs
// ====================================================================

router.get('/runs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    
    const { data, error } = await supabase
      .from('match_runs')
      .select(`
        run_id,
        startup_id,
        input_url,
        canonical_url,
        status,
        step,
        match_count,
        error_code,
        error_message,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[match-run] Query error:', error);
      return res.status(500).json({
        error: 'Failed to fetch runs',
        code: 'QUERY_ERROR',
        details: error.message
      });
    }
    
    return res.json({
      runs: data || [],
      count: data?.length || 0
    });
    
  } catch (err) {
    console.error('[match-run] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ====================================================================
// DEBUG: GET /api/match/run/:runId/debug
// ====================================================================
// Returns detailed debug info (age, lease status, stuck detection)
// ====================================================================

router.get('/run/:runId/debug', async (req, res) => {
  try {
    const { runId } = req.params;
    
    if (!runId) {
      return res.status(400).json({
        error: 'run_id required',
        code: 'INVALID_REQUEST'
      });
    }
    
    const { data, error } = await supabase.rpc('get_match_run_debug', {
      input_run_id: runId
    });
    
    if (error) {
      console.error('[match-run] Debug RPC error:', error);
      return res.status(500).json({
        error: 'Failed to get debug info',
        code: 'RPC_ERROR',
        details: error.message
      });
    }
    
    const debug = data?.[0];
    
    if (!debug) {
      return res.status(404).json({
        error: 'Match run not found',
        code: 'RUN_NOT_FOUND'
      });
    }
    
    return res.json(debug);
    
  } catch (err) {
    console.error('[match-run] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
