/**
 * Startup API Routes
 * 
 * Provides REST API endpoints for startup-related data including signal history
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

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
  try {
    const supabase = getUserSupabase(req);
    const { id } = req.params;

    // Validate and clamp days parameter
    const days = Math.max(1, Math.min(90, parseInt(req.query.days || '14', 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Fetch history (RLS ensures user only sees their own startup's history)
    const { data, error } = await supabase
      .from('startup_signal_history')
      .select('recorded_at, signal_strength, readiness, power_score, fundraising_window')
      .eq('startup_id', id)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (error) {
      console.error('[signal-history] Query error:', error);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    return res.json({ 
      success: true,
      history: data || [],
      showing: (data || []).length,
      days_requested: days
    });
  } catch (err) {
    console.error('[signal-history] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
