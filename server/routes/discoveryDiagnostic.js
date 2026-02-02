/**
 * PIPELINE DIAGNOSTIC ENDPOINT
 * ============================
 * GET /api/discovery/diagnose?startup_id=<uuid>
 * 
 * Returns internal pipeline state for debugging.
 * Useful for admin dashboards and dev mode UI panels.
 */

const { Router } = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const router = Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

router.get('/diagnose', async (req, res) => {
  try {
    const { startup_id } = req.query;
    
    if (!startup_id) {
      return res.status(400).json({ 
        error: 'Missing startup_id parameter' 
      });
    }
    
    // Call the diagnose_pipeline RPC
    const { data, error } = await supabase.rpc('diagnose_pipeline', {
      p_startup_id: startup_id
    });
    
    if (error) {
      console.error('Diagnostic RPC error:', error);
      return res.status(500).json({ 
        error: 'Diagnostic query failed',
        details: error.message 
      });
    }
    
    // RPC returns array with single row
    const diagnostic = data?.[0] || null;
    
    if (!diagnostic) {
      return res.status(404).json({ 
        error: 'Startup not found or no diagnostic data' 
      });
    }
    
    // Return diagnostic data
    res.json(diagnostic);
    
  } catch (err) {
    console.error('Diagnostic endpoint error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

module.exports = router;
