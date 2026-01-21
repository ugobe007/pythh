/**
 * Startup API Routes
 * 
 * Provides REST API endpoints for startup-related data including signal history
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { historyCache } = require('../utils/cache');
const { withTimeout, TIMEOUTS } = require('../utils/withTimeout');
const { safeLog } = require('../utils/safeLog');

const router = express.Router();

/**
 * Create Supabase client with user's JWT for RLS-safe queries
 * This ensures users only see their own data
 */
function getUserSupabase(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key are required');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  });
}

/**
 * GET /api/startups/:id/signal-history?days=14
 * 
 * Fetch signal history for a startup (Power Score, Signal Strength, Readiness, Window)
 * Uses JWT auth + RLS for security (founder only sees their own startup history)
 * 
 * Query params:
 * - days: Number of days to fetch (1-90, default 14)
 * 
 * Returns:
 * - history: Array of daily signal points
 */
router.get('/:id/signal-history', async (req, res) => {
  const requestId = req.requestId || 'unknown';
  const startTime = Date.now();
  
  try {
    const supabase = getUserSupabase(req);
    const { id } = req.params;

    // Validate and clamp days parameter
    const days = Math.max(1, Math.min(90, parseInt(req.query.days || '14', 10)));
    
    // Check cache first
    const cacheKey = `history:v1:${id}:${days}`;
    const cached = historyCache.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      res.set('X-Request-ID', requestId);
      return res.json({ ...cached, cached: true });
    }
    
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Fetch history with timeout (RLS ensures user only sees their own startup's history)
    const { data, error } = await withTimeout(
      supabase
        .from('startup_signal_history')
        .select('recorded_at, signal_strength, readiness, power_score, fundraising_window')
        .eq('startup_id', id)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true }),
      TIMEOUTS.SUPABASE_READ,
      'signal history query'
    );

    if (error) {
      safeLog('error', 'history.query_error', {
        requestId,
        startupId: id,
        error: error.message,
      });
      return res.status(500).json({ error: 'Failed to fetch history', request_id: requestId });
    }
    
    const response = {
      success: true,
      history: data || [],
      showing: (data || []).length,
      days_requested: days
    };
    
    // Cache the result
    historyCache.set(cacheKey, response);
    
    res.set('X-Cache', 'MISS');
    res.set('X-Request-ID', requestId);
    
    safeLog('info', 'history.success', {
      requestId,
      startupId: id,
      showing: (data || []).length,
      duration_ms: Date.now() - startTime,
    });
    
    return res.json(response);
  } catch (err) {
    safeLog('error', 'history.error', {
      requestId,
      error: err.message,
      duration_ms: Date.now() - startTime,
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      request_id: requestId
    });
  }
});

module.exports = router;
