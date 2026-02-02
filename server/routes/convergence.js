/**
 * CONVERGENCE ENDPOINT - /api/discovery/convergence
 * ==================================================
 * Thin orchestration: resolve → fetch → score → package → return
 * V2: Uses behavioral physics engine with real observer tracking
 */

const { ConvergenceServiceV2 } = require('../services/convergenceServiceV2.js');

async function convergenceEndpoint(req, res) {
  const startTime = Date.now();
  const { url, mode } = req.query;
  const fastMode = mode === 'fast';
  
  // ✅ Prevent caching of convergence responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  console.log('[Convergence API] Request:', { url, mode: fastMode ? 'fast' : 'full' });
  
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

    // FAST MODE: Minimal response for instant UI
    if (fastMode) {
      return await handleFastMode(startup, url, startTime, service, res);
    }
    
    // FULL MODE: Steps 2-5: Build full convergence response
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
 * Fast Mode Handler - Returns minimal data for instant UI
 * - No comparable_startups
 * - No improve_actions  
 * - No strategic selection
 * - Top 5 investors only
 * - Returns 202 if matches aren't ready
 */
async function handleFastMode(startup, url, startTime, service, res) {
  const supabase = service.supabase;
  
  // 1) Get status metrics (cheap: 1 row or computed)
  const status = await service.getStatusForStartup(startup.id);
  
  // 2) Fetch match rows (top N by score) - MUST use index
  // IMPORTANT: Do NOT join investors here
  const { data: matchRows, error: matchError } = await supabase
    .from('startup_investor_matches')
    .select('investor_id, match_score, confidence_level, created_at')
    .eq('startup_id', startup.id)
    .eq('status', 'suggested') // Simple equality for optimal index usage
    .gte('match_score', 50)
    .order('match_score', { ascending: false })
    .limit(25);
  
  if (matchError) {
    console.error('[Convergence Fast] Match query failed:', matchError);
  }
  
  const matchCount = matchRows?.length || 0;
  
  // 3) Return 202 if building (< 5 matches)
  if (matchCount < 5) {
    console.log('[Convergence Fast] Building state:', { startupId: startup.id, matchCount });
    
    return res.status(202).json({
      startup: {
        id: startup.id,
        url: url,
        name: startup.name,
        stage_hint: startup.stage_hint || startup.stage || 'preseed',
        sector_hint: startup.sectors || startup.sector_hint || [],
        created_at: startup.created_at
      },
      status: status || getDefaultStatus(),
      visible_investors: [],
      hidden_investors_preview: [],
      hidden_investors_total: 0,
      comparable_startups: [],
      improve_actions: [],
      alignment: {},
      debug: {
        mode: 'fast',
        state: 'building',
        match_count: matchCount,
        query_time_ms: Date.now() - startTime
      }
    });
  }
  
  // 4) Fetch investors by IDs (2nd query)
  const investorIds = [...new Set(matchRows.map(r => r.investor_id))].filter(Boolean);
  
  const { data: investors } = await supabase
    .from('investors')
    .select('id, name, firm, sectors, stage, check_size_min, check_size_max')
    .in('id', investorIds);
  
  const investorsById = new Map((investors || []).map(i => [i.id, i]));
  
  // 5) Shape visible_investors (top 5 only)
  const visible = matchRows
    .map(r => {
      const inv = investorsById.get(r.investor_id);
      if (!inv) return null;
      
      return {
        investor_id: inv.id,
        firm_name: inv.firm || inv.name,
        match_score_0_100: Math.round(r.match_score),
        signal_state: 'watch', // Simplified for fast mode
        confidence: r.confidence_level || 'med',
        signal_age_hours: Math.floor((Date.now() - new Date(r.created_at).getTime()) / 3600000),
        fit: {
          stage_fit: 'good',
          sector_fit_pct: 100,
          portfolio_adjacency: 'weak',
          velocity_alignment: 'low'
        },
        why: {
          bullets: [],
          evidence_tags: []
        }
      };
    })
    .filter(Boolean)
    .slice(0, 5);
  
  console.log('[Convergence Fast] Success:', {
    startupId: startup.id,
    matchCount,
    visibleCount: visible.length,
    queryTime: Date.now() - startTime
  });
  
  // 6) Return fast response
  return res.json({
    startup: {
      id: startup.id,
      url: url,
      name: startup.name,
      stage_hint: startup.stage_hint || startup.stage || 'preseed',
      sector_hint: startup.sectors || startup.sector_hint || [],
      created_at: startup.created_at
    },
    status: status || getDefaultStatus(),
    visible_investors: visible,
    hidden_investors_preview: [],
    hidden_investors_total: Math.max(0, matchCount - 5),
    comparable_startups: [],
    improve_actions: [],
    alignment: {},
    debug: {
      mode: 'fast',
      state: 'ready',
      match_count: matchCount,
      query_time_ms: Date.now() - startTime
    }
  });
}

function getDefaultStatus() {
  return {
    velocity_class: 'early',
    signal_strength_0_10: 5.0,
    fomo_state: 'watch',
    observers_7d: 0,
    comparable_tier: 'unranked',
    phase_change_score_0_1: 0.5,
    confidence: 'med',
    updated_at: new Date().toISOString()
  };
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
