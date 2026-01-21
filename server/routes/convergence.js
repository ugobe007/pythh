/**
 * CONVERGENCE ENDPOINT - /api/discovery/convergence
 * ==================================================
 * Thin orchestration: resolve → fetch → score → package → return
 * V2: Uses behavioral physics engine with real observer tracking
 */

const { ConvergenceServiceV2 } = require('../services/convergenceServiceV2.js');

async function convergenceEndpoint(req, res) {
  const startTime = Date.now();
  const { url } = req.query;
  
  console.log('[Convergence API] Request:', { url });
  
  if (!url) {
    return res.status(400).json({
      error: 'Missing required parameter: url'
    });
  }
  
  try {
    const service = new ConvergenceServiceV2();
    
    // Step 1: Resolve startup by URL
    const startup = await service.resolveStartup(url);
    
    if (!startup) {
      console.log('[Convergence API] Startup not found, returning empty payload');
      return res.json(getEmptyPayload(url));
    }
    
    // Steps 2-5: Build full convergence response
    const convergence = await service.buildConvergenceResponse(startup);
    
    console.log('[Convergence API] Success:', {
      startupId: startup.id,
      visibleCount: convergence.visible_investors.length,
      hiddenCount: convergence.hidden_investors_total,
      queryTime: Date.now() - startTime
    });
    
    return res.json(convergence);
    
  } catch (error) {
    console.error('[Convergence API] Error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Empty-but-valid payload (never return null)
 */
function getEmptyPayload(url) {
  return {
    startup: {
      id: 'unknown',
      url: url,
      created_at: new Date().toISOString()
    },
    status: {
      velocity_class: 'early',
      signal_strength_0_10: 5.0,
      fomo_state: 'watch',
      observers_7d: 0,
      comparable_tier: 'unranked',
      phase_change_score_0_1: 0.5,
      confidence: 'low',
      updated_at: new Date().toISOString()
    },
    visible_investors: [],
    hidden_investors_preview: [],
    hidden_investors_total: 0,
    comparable_startups: [],
    alignment: {
      team_0_1: 0.5,
      market_0_1: 0.5,
      execution_0_1: 0.5,
      portfolio_0_1: 0.5,
      phase_change_0_1: 0.5,
      message: 'Startup not found in database. Submit your startup to begin convergence tracking.'
    },
    improve_actions: [
      {
        title: 'Get Started with Hot Honey',
        impact_pct: 100,
        steps: [
          'Submit your startup URL',
          'Complete your startup profile',
          'Enable signal tracking'
        ],
        category: 'phase_change'
      }
    ],
    debug: {
      query_time_ms: 0,
      data_sources: ['empty_fallback'],
      match_version: 'v1.3.1-real'
    }
  };
}

module.exports = { convergenceEndpoint };
