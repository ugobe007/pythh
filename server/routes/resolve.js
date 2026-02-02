/**
 * ============================================================================
 * RESOLVE ENDPOINT (Bulletproof URL Resolution)
 * ============================================================================
 * POST /api/resolve
 * 
 * Resolves URL to startup_id. Creates discovery job if needed.
 * Implements the "bulletproof submit URL" checklist.
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabaseClient');

/**
 * POST /api/resolve
 * Body: { url: string }
 * 
 * Returns:
 *   - resolved: boolean (true if found in startup_uploads)
 *   - startup_id: UUID (or null if not found)
 *   - canonical_url: website field from startup_uploads
 *   - startup_name: Name of startup
 *   - reason: 'not_found' | 'empty_url' | null
 */
router.post('/resolve', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: {
          code: 'invalid_url',
          message: 'URL is required and must be a string',
        },
      });
    }
    
    // Call RPC to resolve URL against startup_uploads
    const { data, error } = await supabase.rpc('resolve_startup_by_url', {
      p_url: url,
    });
    
    if (error) {
      console.error('[resolve] RPC error:', error);
      return res.status(500).json({
        error: {
          code: 'rpc_error',
          message: error.message,
          details: error,
        },
      });
    }
    
    // RPC returns array with single row
    const result = data?.[0];
    
    if (!result) {
      return res.status(500).json({
        error: {
          code: 'no_result',
          message: 'RPC returned no data',
        },
      });
    }
    
    // Return result
    if (result.resolved) {
      return res.json({
        resolved: true,
        startup_id: result.startup_id,
        name: result.startup_name,
        canonical_url: result.canonical_url,
      });
    } else {
      // Not found - return reason
      return res.status(404).json({
        resolved: false,
        startup_id: null,
        canonical_url: result.canonical_url, // normalized URL
        reason: result.reason, // 'not_found' or 'empty_url'
      });
    }
  } catch (err) {
    console.error('[resolve] Unexpected error:', err);
    return res.status(500).json({
      error: {
        code: 'system_error',
        message: err.message,
      },
    });
  }
});

module.exports = router;
