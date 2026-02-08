/**
 * Pythh Agent API v1 Routes
 * 
 * Endpoints:
 *   GET /api/v1/meta             - API key info and capabilities (KEY REQUIRED)
 *   GET /api/v1/market-slice     - Top N rankings (KEY REQUIRED)
 *   GET /api/v1/movements        - Lifeform core feed (KEY REQUIRED)
 *   GET /api/v1/signals          - Founder daily weather report (KEY REQUIRED, scope: signals)
 *   GET /api/v1/startups/search  - Startup lookup by name (KEY REQUIRED, scope: lookup)
 *   GET /api/v1/startups/:id/score-snapshot - Full startup snapshot (KEY REQUIRED)
 *   GET /api/v1/investors/:id/brief - Investor behavioral intelligence (KEY REQUIRED)
 */

const express = require('express');
const { getSupabaseClient } = require('../lib/supabaseClient');
const { apiKeyAuth, requireApiKey, logApiRequest, DEFAULT_KEY_RATE_LIMIT } = require('../middleware/apiKeyAuth');
const { encodeCursor, decodeCursor } = require('../lib/cursor');

const router = express.Router();

// Apply API key auth to all v1 routes
router.use(apiKeyAuth);

// ============================================================================
// 0) GET /api/v1/meta (KEY REQUIRED) - Agent handshake endpoint
// ============================================================================

router.get('/meta', requireApiKey(), async (req, res) => {
  const keyInfo = req.apiKey;
  
  // Available scopes in the system
  const ALL_SCOPES = ['market_slice', 'movements', 'score_snapshot', 'investor_brief', 'signals', 'lookup'];
  
  // All available endpoints
  const ALL_ENDPOINTS = [
    { path: '/api/v1/market-slice', scope: 'market_slice', method: 'GET' },
    { path: '/api/v1/movements', scope: 'movements', method: 'GET' },
    { path: '/api/v1/signals', scope: 'signals', method: 'GET' },
    { path: '/api/v1/whisper', scope: ['movements', 'signals'], method: 'GET', note: 'requires movements OR signals scope' },
    { path: '/api/v1/strategies', scope: 'signals', method: 'GET', note: 'founder strategy instances' },
    { path: '/api/v1/strategies/:instance_id', scope: 'signals', method: 'GET', note: 'single instance for Readiness Brief' },
    { path: '/api/v1/strategies/evaluate', scope: 'signals', method: 'POST', note: 'evaluate and activate strategies' },
    { path: '/api/v1/strategies/library', scope: 'signals', method: 'GET', note: 'all strategies in library (admin)' },
    { path: '/api/v1/gaps/:startupId', scope: 'signals', method: 'GET', note: 'signal gaps for startup (the missing primitive)' },
    { path: '/api/v1/gaps/:startupId/:lens', scope: 'signals', method: 'GET', note: 'gaps for specific lens' },
    { path: '/api/v1/gaps/:gapId/acknowledge', scope: 'signals', method: 'POST', note: 'acknowledge a gap (minimal action)' },
    { path: '/api/v1/gaps/refresh', scope: 'signals', method: 'POST', note: 'recompute gaps from scores' },
    { path: '/api/v1/levers/:factor', scope: 'signals', method: 'GET', note: 'evidence levers for blocking factor' },
    // Canonical Delta System v1 (legacy)
    { path: '/api/v1/scorecard/:startupId', scope: 'signals', method: 'GET', note: 'legacy scorecard' },
    { path: '/api/v1/scorecard/:startupId/refresh', scope: 'signals', method: 'POST', note: 'force recompute scorecard' },
    { path: '/api/v1/actions', scope: 'signals', method: 'POST', note: 'legacy submit action' },
    { path: '/api/v1/actions/:startupId', scope: 'signals', method: 'GET', note: 'legacy list actions' },
    { path: '/api/v1/actions/:actionId/verify', scope: 'signals', method: 'POST', note: 'legacy upgrade verification' },
    { path: '/api/v1/evidence', scope: 'signals', method: 'POST', note: 'legacy submit evidence' },
    { path: '/api/v1/blockers/:startupId', scope: 'signals', method: 'GET', note: 'legacy blocking factors' },
    { path: '/api/v1/sources/:startupId', scope: 'signals', method: 'GET', note: 'legacy sources status' },
    { path: '/api/v1/god-adjustment/:startupId', scope: 'signals', method: 'GET', note: 'GOD score adjustment from verified deltas' },
    // Canonical Verification System v2 (new pipeline)
    { path: '/api/v1/v2/actions', scope: 'signals', method: 'POST', note: 'submit founder action (fast lane)' },
    { path: '/api/v1/v2/actions/:startupId', scope: 'signals', method: 'GET', note: 'list actions with verification state' },
    { path: '/api/v1/v2/evidence', scope: 'signals', method: 'POST', note: 'submit evidence artifact' },
    { path: '/api/v1/v2/actions/:actionId/resolve', scope: 'signals', method: 'POST', note: 'resolve inconsistency' },
    { path: '/api/v1/v2/scorecard/:startupId', scope: 'signals', method: 'GET', note: 'full scorecard with verification pipeline' },
    { path: '/api/v1/v2/evidence-center/:startupId', scope: 'signals', method: 'GET', note: 'evidence center with sources and conflicts' },
    { path: '/api/v1/webhooks/:provider', scope: 'signals', method: 'POST', note: 'webhook ingestion (stripe, github, etc.)' },
    // Investor signal distribution
    { path: '/api/v1/signals/rollup', scope: 'signals', method: 'POST', note: 'refresh investor signal distribution from vc_faith_signals' },
    { path: '/api/v1/signals/investor/:investorId', scope: 'signals', method: 'GET', note: 'investor signal profile (source + theme distributions)' },
    // Core endpoints
    { path: '/api/v1/startups/search', scope: 'lookup', method: 'GET' },
    { path: '/api/v1/startups/:id/score-snapshot', scope: 'score_snapshot', method: 'GET' },
    { path: '/api/v1/investors/:id/brief', scope: 'investor_brief', method: 'GET' }
  ];
  
  // God mode policy (clean rule):
  // - null or undefined = god mode (all scopes)
  // - [] empty array = no scopes (valid but useless)
  // - ['scope1', ...] = specific scopes
  const keyScopes = keyInfo.allowed_scopes;
  const isGodMode = keyScopes === null || keyScopes === undefined;
  const effectiveScopes = isGodMode ? ALL_SCOPES : (keyScopes || []);
  
  // Filter endpoints to only those this key can access
  // For whisper, check if key has either movements OR signals scope
  const effectiveEndpoints = ALL_ENDPOINTS.filter(ep => {
    if (Array.isArray(ep.scope)) {
      // OR logic - key needs at least one of the scopes
      return ep.scope.some(s => effectiveScopes.includes(s));
    }
    return effectiveScopes.includes(ep.scope);
  });
  
  return res.json({
    ok: true,
    schema_version: '1.0',
    request_id: req.requestId || `req_${Date.now()}`,
    generated_at: new Date().toISOString(),
    data: {
      key_prefix: keyInfo.key_prefix,
      owner: keyInfo.owner_name || keyInfo.owner_email?.split('@')[0] || 'unknown',
      org: keyInfo.org_name || null,
      is_god_mode: isGodMode,
      scopes: effectiveScopes,
      rate_limit: {
        rpm: keyInfo.rate_limit_per_min || DEFAULT_KEY_RATE_LIMIT,
        current_window_remaining: parseInt(res.get('X-RateLimit-Remaining')) || null
      },
      expires_at: keyInfo.expires_at || null,
      created_at: keyInfo.created_at,
      endpoints: effectiveEndpoints,
      all_endpoints: isGodMode ? undefined : ALL_ENDPOINTS  // Show all endpoints only for scoped keys (reference)
    }
  });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert timestamp to relative recency string
 */
function toRecency(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 60) return '1mo ago';
  return `${Math.floor(diffDays / 30)}mo ago`;
}

/**
 * Standard API response wrapper
 */
function apiResponse(res, data, summary, cacheSeconds = 60) {
  res.set('Cache-Control', `public, max-age=${cacheSeconds}`);
  return res.json({
    ok: true,
    generated_at: new Date().toISOString(),
    summary,
    data
  });
}

/**
 * Standard API error response
 */
function apiError(res, code, message, status = 400) {
  return res.status(status).json({
    ok: false,
    error: { code, message }
  });
}

// ============================================================================
// 1) GET /api/v1/market-slice (KEY REQUIRED)
// ============================================================================

router.get('/market-slice', requireApiKey('market_slice'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      lens = 'god', 
      window = '24h', 
      mode = 'all', 
      sector,
      top = '25'
    } = req.query;
    
    // Validate and cap top
    let topN = parseInt(top, 10);
    if (isNaN(topN) || topN < 1) topN = 25;
    if (topN > 50) topN = 50;
    
    // Public access caps at 25
    if (req.isPublicAccess && topN > 25) topN = 25;
    
    const supabase = getSupabaseClient();
    
    // Build query - use existing columns only
    let query = supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, sectors, updated_at')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .order('total_god_score', { ascending: false })
      .limit(topN);
    
    // Apply sector filter if specified
    if (mode === 'sector' && sector) {
      query = query.contains('sectors', [sector]);
    }
    
    const { data: startups, error } = await query;
    
    if (error) {
      console.error('[apiV1] market-slice error:', error);
      return apiError(res, 'server_error', 'Failed to fetch market slice', 500);
    }
    
    // Calculate timing state based on recent activity
    const now = Date.now();
    function inferTimingState(updatedAt) {
      if (!updatedAt) return 'stable';
      const ageMs = now - new Date(updatedAt).getTime();
      const ageDays = ageMs / 86400000;
      if (ageDays < 7) return 'warming';
      if (ageDays < 30) return 'monitoring';
      if (ageDays < 90) return 'cooling';
      return 'dormant';
    }
    
    // Format rows
    const rows = startups.map((s, idx) => ({
      rank: idx + 1,
      startup_name: s.name,
      score: Math.round(s.total_god_score * 10) / 10,
      rank_delta: 0,  // Would need historical data
      timing_state: inferTimingState(s.updated_at),
      velocity: 'stable'
    }));
    
    const summary = sector 
      ? `Top ${topN} in ${sector} under ${lens} (${window}).`
      : `Top ${topN} startups under ${lens} (${window}).`;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return apiResponse(res, {
      lens_id: lens,
      window,
      filters: { mode, sector: sector || null },
      top_n: topN,
      rows
    }, summary, 60);
    
  } catch (err) {
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 2) GET /api/v1/movements (KEY REQUIRED)
// Lifeform core feed - reads from agent_feed_items SSOT
// ============================================================================

// Valid movement windows
const VALID_MOVEMENT_WINDOWS = ['24h', '48h', '7d'];

router.get('/movements', requireApiKey('movements'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { window = '24h', limit = '25', cursor } = req.query;
    
    // Validate window
    if (!VALID_MOVEMENT_WINDOWS.includes(window)) {
      return apiError(res, 'invalid_request', `Invalid window. Must be one of: ${VALID_MOVEMENT_WINDOWS.join(', ')}`, 400);
    }
    
    // Parse and cap limit
    let limitN = parseInt(limit, 10);
    if (isNaN(limitN) || limitN < 1) limitN = 25;
    if (limitN > 50) limitN = 50;
    
    // Decode cursor if provided
    const cursorObj = cursor ? decodeCursor(cursor) : null;
    if (cursor && !cursorObj) {
      return apiError(res, 'invalid_request', 'Invalid cursor format', 400);
    }
    
    // Calculate window cutoff
    const windowHours = window === '7d' ? 168 : window === '48h' ? 48 : 24;
    const cutoff = new Date(Date.now() - windowHours * 3600000);
    
    const supabase = getSupabaseClient();
    
    // Query agent_feed_items SSOT
    let query = supabase
      .from('agent_feed_items')
      .select('id, kind, lens_id, sector, label, strength, velocity, timing_state, evidence, entity_refs, poke, created_at')
      .eq('kind', 'movement')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limitN + 1);  // +1 to detect if there's more
    
    // Apply strict tuple cursor pagination: (created_at, id)
    // Fetch rows where: created_at < cursor OR (created_at = cursor AND id < cursor_id)
    if (cursorObj) {
      query = query.or(`created_at.lt.${cursorObj.created_at},and(created_at.eq.${cursorObj.created_at},id.lt.${cursorObj.id})`);
    }
    
    const { data: feedItems, error } = await query;
    
    if (error) {
      console.error('[apiV1] movements query error:', error);
      return apiError(res, 'server_error', 'Failed to fetch movements', 500);
    }
    
    // Check if there's more (we fetched limit + 1)
    const hasMore = feedItems && feedItems.length > limitN;
    const items = (feedItems || []).slice(0, limitN);
    
    // Map to response format
    const rows = items.map(item => ({
      movement_id: item.id,
      label: item.label,
      sector: item.sector,
      lens_id: item.lens_id,
      strength: item.strength,
      velocity: item.velocity,
      timing_state: item.timing_state,
      timestamp: item.created_at,
      recency: toRecency(item.created_at),
      evidence: item.evidence || [],
      entities: item.entity_refs || {},
      poke: item.poke || null
    }));
    
    // Generate next_cursor if there's more
    const lastItem = items[items.length - 1];
    const next_cursor = hasMore && lastItem ? encodeCursor(lastItem.created_at, lastItem.id) : null;
    
    // Generate summary
    const topMovement = rows[0];
    const summary = topMovement
      ? `${rows.length} movement${rows.length !== 1 ? 's' : ''} in the last ${window}. Latest: ${topMovement.label.split(' (')[0]}.`
      : `No movements detected in the last ${window}.`;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    // Set cache header (short for Lifeform)
    res.set('Cache-Control', 'public, max-age=30');
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: {
        window,
        limit: limitN,
        count: rows.length,
        next_cursor,
        rows
      }
    });
    
  } catch (err) {
    console.error('[apiV1] movements error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 3) GET /api/v1/signals (KEY REQUIRED, scope: signals)
// Founder daily weather report - reads from agent_feed_items SSOT
// ============================================================================

// Valid lens options for filtering
const VALID_LENSES = ['god', 'yc', 'sequoia', 'foundersfund', 'a16z', 'greylock'];
const VALID_SIGNAL_WINDOWS = ['24h', '7d', '30d'];
const VALID_SORTS = ['strength', 'velocity', 'recent'];

router.get('/signals', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      window = '24h', 
      sector,
      lens,
      limit = '25',
      cursor,
      sort = 'recent'
    } = req.query;
    
    // Validate window
    if (!VALID_SIGNAL_WINDOWS.includes(window)) {
      return apiError(res, 'invalid_request', `Invalid window. Must be one of: ${VALID_SIGNAL_WINDOWS.join(', ')}`, 400);
    }
    
    // Validate lens if provided
    if (lens && !VALID_LENSES.includes(lens)) {
      return apiError(res, 'invalid_request', `Invalid lens. Must be one of: ${VALID_LENSES.join(', ')}`, 400);
    }
    
    // Validate sort
    if (!VALID_SORTS.includes(sort)) {
      return apiError(res, 'invalid_request', `Invalid sort. Must be one of: ${VALID_SORTS.join(', ')}`, 400);
    }
    
    // Parse and validate limit
    let limitN = parseInt(limit, 10);
    if (isNaN(limitN) || limitN < 1) {
      return apiError(res, 'invalid_request', 'limit must be a positive integer', 400);
    }
    if (limitN > 50) {
      return apiError(res, 'invalid_request', 'limit cannot exceed 50', 400);
    }
    
    // Decode cursor if provided
    const cursorObj = cursor ? decodeCursor(cursor) : null;
    if (cursor && !cursorObj) {
      return apiError(res, 'invalid_request', 'Invalid cursor format', 400);
    }
    
    // Calculate window cutoff
    const windowHours = window === '30d' ? 720 : window === '7d' ? 168 : 24;
    const cutoff = new Date(Date.now() - windowHours * 3600000);
    
    const supabase = getSupabaseClient();
    
    // -------------------------------------------------------------------------
    // Query agent_feed_items SSOT - no more ai_logs!
    // -------------------------------------------------------------------------
    
    let query = supabase
      .from('agent_feed_items')
      .select('id, kind, lens_id, sector, label, strength, velocity, timing_state, evidence, entity_refs, poke, created_at')
      .eq('kind', 'signal')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limitN + 1);  // +1 to detect if there's more
    
    // Apply optional filters
    if (lens) {
      query = query.eq('lens_id', lens);
    }
    if (sector) {
      query = query.ilike('sector', sector);  // Case-insensitive
    }
    
    // Apply strict tuple cursor pagination: (created_at, id)
    // Fetch rows where: created_at < cursor OR (created_at = cursor AND id < cursor_id)
    if (cursorObj) {
      query = query.or(`created_at.lt.${cursorObj.created_at},and(created_at.eq.${cursorObj.created_at},id.lt.${cursorObj.id})`);
    }
    
    const { data: feedItems, error } = await query;
    
    if (error) {
      console.error('[apiV1] signals query error:', error);
      return apiError(res, 'server_error', 'Failed to fetch signal data', 500);
    }
    
    // Check if there's more (we fetched limit + 1)
    const hasMore = feedItems && feedItems.length > limitN;
    let signals = (feedItems || []).slice(0, limitN);
    
    // Map to response format with signal_id
    const rows = signals.map(item => ({
      signal_id: item.id,
      label: item.label,
      sector: item.sector,
      lens_id: item.lens_id || 'god',
      strength: item.strength,
      velocity: item.velocity || 'flat',
      timing_state: item.timing_state || 'stable',
      timestamp: item.created_at,
      recency: toRecency(item.created_at),
      evidence: item.evidence || [],
      poke: item.poke || {
        ui_paths: {
          signals_page: `/signals${item.sector ? `?sector=${encodeURIComponent(item.sector)}` : ''}`,
          trends_lens: `/trends?lens=${item.lens_id || 'god'}&window=${window}`,
          matches: item.sector ? `/matches?sector=${encodeURIComponent(item.sector)}` : '/matches'
        }
      }
    }));
    
    // Apply in-memory sort if needed (DB already sorted by created_at desc)
    if (sort === 'strength') {
      rows.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    } else if (sort === 'velocity') {
      const velocityOrder = { up: 0, flat: 1, down: 2 };
      rows.sort((a, b) => (velocityOrder[a.velocity] || 1) - (velocityOrder[b.velocity] || 1) || (b.strength || 0) - (a.strength || 0));
    }
    // 'recent' is default and already sorted by DB
    
    // Generate next_cursor if there's more
    const lastItem = signals[signals.length - 1];
    const next_cursor = hasMore && lastItem ? encodeCursor(lastItem.created_at, lastItem.id) : null;
    
    // Generate summary
    const hotSignals = rows.filter(s => s.timing_state === 'hot' || s.timing_state === 'warming');
    const coolingSignals = rows.filter(s => s.timing_state === 'cooling');
    const strongestSignal = [...rows].sort((a, b) => (b.strength || 0) - (a.strength || 0))[0];
    const coolestSignal = coolingSignals[0];
    
    let summary = `${rows.length} signal${rows.length !== 1 ? 's' : ''} in the last ${window}.`;
    if (strongestSignal) {
      summary += ` Strongest: ${strongestSignal.label.split(' (')[0]}`;
    }
    if (coolestSignal) {
      summary += `; cooling: ${coolestSignal.label.split(' (')[0]}`;
    }
    summary += '.';
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    // Set cache header
    res.set('Cache-Control', 'public, max-age=60');
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: {
        window,
        filters: { 
          sector: sector || null, 
          lens_id: lens || null 
        },
        limit: limitN,
        next_cursor,
        rows
      }
    });
    
  } catch (err) {
    console.error('[apiV1] signals error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 4) GET /api/v1/startups/search (KEY REQUIRED, scope: lookup)
// Agent candy - lookup startup IDs by name
// ============================================================================

router.get('/startups/search', requireApiKey('lookup'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { q, limit = '10' } = req.query;
    
    if (!q || q.trim().length < 2) {
      return apiError(res, 'invalid_request', 'Query "q" must be at least 2 characters', 400);
    }
    
    let limitN = parseInt(limit, 10);
    if (isNaN(limitN) || limitN < 1) limitN = 10;
    if (limitN > 25) limitN = 25;
    
    const supabase = getSupabaseClient();
    
    // Search by name (case-insensitive)
    const { data: results, error } = await supabase
      .from('startup_uploads')
      .select('id, name, sectors')
      .eq('status', 'approved')
      .ilike('name', `%${q.trim()}%`)
      .order('total_god_score', { ascending: false })
      .limit(limitN);
    
    if (error) {
      console.error('[apiV1] startup search error:', error);
      return apiError(res, 'server_error', 'Search failed', 500);
    }
    
    const rows = (results || []).map(s => ({
      startup_id: s.id,
      startup_name: s.name,
      sector: Array.isArray(s.sectors) ? s.sectors[0] : (s.sectors || 'General')
    }));
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return apiResponse(res, {
      query: q.trim(),
      count: rows.length,
      rows
    }, `Found ${rows.length} startup${rows.length !== 1 ? 's' : ''} matching "${q.trim()}"`, 60);
    
  } catch (err) {
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 5) GET /api/v1/startups/:startupId/score-snapshot (KEY REQUIRED)
// ============================================================================

router.get('/startups/:startupId/score-snapshot', requireApiKey('score_snapshot'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { startupId } = req.params;
    const { lens = 'god', window = '24h' } = req.query;
    
    const supabase = getSupabaseClient();
    
    // Fetch startup with all score components (using existing columns only)
    const { data: startup, error } = await supabase
      .from('startup_uploads')
      .select(`
        id, name, status,
        total_god_score, team_score, traction_score, market_score, product_score, vision_score,
        sectors, description, tagline,
        updated_at
      `)
      .eq('id', startupId)
      .single();
    
    if (error || !startup) {
      console.error('[apiV1] score-snapshot error:', error);
      return apiError(res, 'not_found', 'Startup not found', 404);
    }
    
    // Calculate rank
    const { count: betterCount } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gt('total_god_score', startup.total_god_score || 0);
    
    const rank = (betterCount || 0) + 1;
    
    // Infer timing state from update recency
    const now = Date.now();
    const ageMs = startup.updated_at ? now - new Date(startup.updated_at).getTime() : now;
    const ageDays = ageMs / 86400000;
    const timingState = ageDays < 7 ? 'warming' : ageDays < 30 ? 'monitoring' : ageDays < 90 ? 'cooling' : 'dormant';
    
    // Calculate top drivers from component scores
    const components = [
      { key: 'market', label: 'Market', score: startup.market_score || 0 },
      { key: 'team', label: 'Team', score: startup.team_score || 0 },
      { key: 'product', label: 'Product', score: startup.product_score || 0 },
      { key: 'traction', label: 'Traction', score: startup.traction_score || 0 },
      { key: 'vision', label: 'Vision', score: startup.vision_score || 0 }
    ];
    
    const totalScore = components.reduce((sum, c) => sum + c.score, 0) || 1;
    const topDrivers = components
      .map(c => ({ ...c, pct: Math.round((c.score / totalScore) * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
    
    // Build breakdown
    const breakdown = components
      .filter(c => c.score > 0)
      .map(c => ({
        factor: c.key.toLowerCase(),
        label: `${c.label} signal strength`,
        contribution: Math.round(c.score * 10) / 10
      }))
      .sort((a, b) => b.contribution - a.contribution);
    
    // Build evidence (simplified - would come from actual evidence store)
    const evidence = topDrivers.map(driver => ({
      factor: driver.key,
      items: [
        {
          claim: `Strong ${driver.label.toLowerCase()} indicators detected`,
          source: 'analysis',
          confidence: driver.pct > 30 ? 'high' : driver.pct > 20 ? 'medium' : 'low',
          timestamp: startup.updated_at,
          recency: toRecency(startup.updated_at),
          visibility: 'public'
        }
      ]
    }));
    
    const summary = `${startup.name} scores ${Math.round(startup.total_god_score * 10) / 10} under ${lens} (${window}), rank #${rank}, timing ${timingState}. Drivers: ${topDrivers.map(d => `${d.label} ${d.pct}%`).join(', ')}.`;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return apiResponse(res, {
      startup_id: startup.id,
      startup_name: startup.name,
      lens_id: lens,
      window,
      snapshot: {
        score: Math.round(startup.total_god_score * 10) / 10,
        rank,
        rank_delta: 0,  // Would need historical data
        timing_state: timingState,
        top_drivers: topDrivers.map(d => ({ key: d.key, label: d.label, pct: d.pct })),
        breakdown
      },
      evidence
    }, summary, 120);
    
  } catch (err) {
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 4) GET /api/v1/investors/:investorId/brief (KEY REQUIRED)
// ============================================================================

router.get('/investors/:investorId/brief', requireApiKey('investor_brief'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { investorId } = req.params;
    
    const supabase = getSupabaseClient();
    
    // Fetch investor (using existing columns only)
    const { data: investor, error } = await supabase
      .from('investors')
      .select(`
        id, name, firm, stage, sectors, investment_thesis, bio,
        notable_investments, portfolio_companies, last_investment_date,
        focus_areas, updated_at, created_at
      `)
      .eq('id', investorId)
      .single();
    
    if (error || !investor) {
      console.error('[apiV1] investor-brief error:', error);
      return apiError(res, 'not_found', 'Investor not found', 404);
    }
    
    // Infer timing state from last investment date
    const now = Date.now();
    const lastInvestDate = investor.last_investment_date ? new Date(investor.last_investment_date) : null;
    let timingState = 'stable';
    if (lastInvestDate) {
      const daysSinceInvest = (now - lastInvestDate.getTime()) / 86400000;
      if (daysSinceInvest < 30) timingState = 'warming';
      else if (daysSinceInvest < 90) timingState = 'monitoring';
      else if (daysSinceInvest < 180) timingState = 'cooling';
      else timingState = 'dormant';
    }
    
    const focus = investor.sectors || [];
    const stage = investor.stage || 'seed_to_a';
    
    // Build behavioral pattern from available data
    const behavioralPattern = [];
    if (investor.investment_thesis) {
      behavioralPattern.push(investor.investment_thesis.slice(0, 100));
    }
    if (investor.focus_areas && Array.isArray(investor.focus_areas)) {
      behavioralPattern.push(`Focus: ${investor.focus_areas.slice(0, 3).join(', ')}`);
    }
    if (behavioralPattern.length === 0) {
      behavioralPattern.push('Behavioral patterns under analysis');
    }
    
    // Recent behavior from notable investments
    const recentBehavior = [];
    if (investor.notable_investments && Array.isArray(investor.notable_investments)) {
      for (const inv of investor.notable_investments.slice(0, 3)) {
        recentBehavior.push({
          text: typeof inv === 'string' ? inv : `Investment in ${inv.company || inv}`,
          timestamp: investor.last_investment_date || investor.updated_at,
          recency: toRecency(investor.last_investment_date || investor.updated_at)
        });
      }
    }
    if (recentBehavior.length === 0) {
      recentBehavior.push({
        text: `Active in ${focus.slice(0, 2).join(', ') || 'multiple sectors'}`,
        timestamp: investor.updated_at || new Date().toISOString(),
        recency: toRecency(investor.updated_at)
      });
    }
    
    // Standard signals (would come from analysis)
    const signalsRespondTo = [
      'Hiring acceleration',
      'Product velocity indicators',
      'Market category signals',
      'Revenue milestones',
      'Category leadership indicators'
    ].slice(0, 5);
    
    // Observed since
    const observedSince = new Date(investor.created_at || Date.now()).toISOString().slice(0, 7);
    
    const summary = `${investor.name}${investor.firm ? ` (${investor.firm})` : ''} is ${timingState} in ${focus.slice(0, 2).join(', ') || 'their focus areas'}. ${behavioralPattern[0] || ''}`;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return apiResponse(res, {
      investor_id: investor.id,
      investor_name: investor.name,
      focus: focus.slice(0, 5),
      stage,
      observed_since: observedSince,
      timing_state: timingState,
      behavioral_pattern: behavioralPattern.slice(0, 3),
      recent_behavior: recentBehavior.slice(0, 3),
      signals_respond_to: signalsRespondTo,
      competitive_context: [],  // Would need competitive analysis data
      redaction_level: 'public'
    }, summary, 300);  // Longer cache - investor behavior changes slower
    
  } catch (err) {
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 7) GET /api/v1/whisper (KEY REQUIRED, scope: movements OR signals)
// Live Whisper - Returns exactly 1 recent feed item as human-readable text
// ============================================================================

// In-memory cache for whisper (rotates every 60s)
let whisperCache = { item: null, text: '', expires: 0 };

/**
 * Generate human-readable whisper text from a feed item
 */
function generateWhisperText(item) {
  if (!item) return null;
  
  const recency = toRecency(item.created_at);
  const lens = item.lens_id && item.lens_id !== 'god' ? item.lens_id : null;
  const sector = item.sector || null;
  
  // Extract startup name from entity_refs or label
  let startupName = null;
  if (item.entity_refs?.startups?.[0]?.name) {
    startupName = item.entity_refs.startups[0].name;
  }
  
  // Movement: "CarbonGrid moved +3 under Sequoia (2h ago)."
  if (item.kind === 'movement') {
    const velocity = item.velocity === 'up' ? '+' : item.velocity === 'down' ? '-' : '';
    const delta = item.strength ? `${velocity}${Math.abs(item.strength - 50)}` : '';
    
    if (startupName && lens) {
      return `${startupName} moved ${delta} under ${lens.charAt(0).toUpperCase() + lens.slice(1)} (${recency}).`;
    }
    if (startupName && sector) {
      return `${startupName} is ${item.timing_state || 'active'} in ${sector} (${recency}).`;
    }
    if (startupName) {
      return `${startupName} score updated to ${item.strength || '?'} (${recency}).`;
    }
    // Fallback to label
    return `${item.label.split(' (')[0]} (${recency}).`;
  }
  
  // Signal: "A16Z attention is warming in FinTech APIs (today)."
  if (item.kind === 'signal') {
    const timing = item.timing_state || 'stable';
    
    if (lens && sector) {
      return `${lens.charAt(0).toUpperCase() + lens.slice(1)} attention is ${timing} in ${sector} (${recency}).`;
    }
    if (sector && timing !== 'stable') {
      return `${sector} sector is ${timing} (${recency}).`;
    }
    if (item.label) {
      // Clean up label for whisper
      const cleanLabel = item.label.replace(/\s*\([^)]*\)\s*$/, '');
      return `${cleanLabel} (${recency}).`;
    }
  }
  
  // Generic fallback
  return item.label ? `${item.label.split(' (')[0]} (${recency}).` : null;
}

router.get('/whisper', requireApiKey(['movements', 'signals']), async (req, res) => {
  const startTime = Date.now();
  try {
    const { kind } = req.query;  // Optional: 'movement' or 'signal'
    
    // Validate kind if provided
    if (kind && !['movement', 'signal'].includes(kind)) {
      return apiError(res, 'invalid_request', 'kind must be "movement" or "signal"', 400);
    }
    
    const now = Date.now();
    const cacheKey = kind || 'any';
    
    // Check cache (valid for 60s)
    if (whisperCache.item && whisperCache.expires > now && whisperCache.cacheKey === cacheKey) {
      logApiRequest(req, 200, Date.now() - startTime);
      res.set('Cache-Control', 'public, max-age=30');
      return res.json({
        ok: true,
        schema_version: '1.0',
        request_id: req.requestId || `req_${Date.now()}`,
        generated_at: new Date().toISOString(),
        summary: '',
        data: {
          id: whisperCache.item.id,
          text: whisperCache.text,
          created_at: whisperCache.item.created_at
        }
      });
    }
    
    const supabase = getSupabaseClient();
    
    // Fetch the most recent feed item (within last 7 days)
    const cutoff = new Date(Date.now() - 7 * 24 * 3600000);
    
    let query = supabase
      .from('agent_feed_items')
      .select('id, kind, lens_id, sector, label, strength, velocity, timing_state, entity_refs, created_at')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    // Apply kind filter if specified
    if (kind) {
      query = query.eq('kind', kind);
    }
    
    const { data: items, error } = await query;
    
    if (error) {
      console.error('[apiV1] whisper query error:', error);
      return apiError(res, 'server_error', 'Failed to fetch whisper', 500);
    }
    
    const item = items?.[0] || null;
    const text = item ? generateWhisperText(item) : null;
    
    // Update cache
    if (item && text) {
      whisperCache = {
        item,
        text,
        cacheKey,
        expires: now + 60000  // 60 second cache
      };
    }
    
    logApiRequest(req, 200, Date.now() - startTime);
    res.set('Cache-Control', 'public, max-age=30');
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: '',
      data: item && text ? {
        id: item.id,
        text,
        created_at: item.created_at
      } : null
    });
    
  } catch (err) {
    console.error('[apiV1] whisper error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 8) GET /api/v1/strategies (KEY REQUIRED, scope: signals)
// ============================================================================
// Returns all strategies for the authenticated founder (from founder_strategy_instances)

router.get('/strategies', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    // User ID from API key or request
    const userId = req.apiKeyUserId || req.query.user_id;
    const startupId = req.query.startup_id || null;
    const status = req.query.status; // 'active', 'resolved_positive', etc.
    
    if (!userId) {
      return apiError(res, 'invalid_request', 'user_id required', 400);
    }
    
    const strategyService = require('../lib/strategyService');
    const strategies = await strategyService.getFounderStrategies(userId, startupId);
    
    // Filter by status if specified
    const filtered = status
      ? strategies.filter(s => s.status === status)
      : strategies;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: filtered.length
        ? `${filtered.length} ${status || ''} strateg${filtered.length === 1 ? 'y' : 'ies'}`
        : 'No strategies',
      data: {
        user_id: userId,
        count: filtered.length,
        strategies: filtered
      }
    });
    
  } catch (err) {
    console.error('[apiV1] strategies error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 8b) GET /api/v1/strategies/:instance_id (KEY REQUIRED, scope: signals)
// ============================================================================
// Returns a single strategy instance by ID (for Readiness Brief)

router.get('/strategies/:instance_id', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { instance_id } = req.params;
    
    if (!instance_id) {
      return apiError(res, 'invalid_request', 'instance_id required', 400);
    }
    
    const strategyService = require('../lib/strategyService');
    const instance = await strategyService.getStrategyInstance(instance_id);
    
    if (!instance) {
      return apiError(res, 'not_found', 'Strategy instance not found', 404);
    }
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `Strategy: ${instance.title}`,
      data: instance
    });
    
  } catch (err) {
    console.error('[apiV1] strategies/:id error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 9) POST /api/v1/strategies/evaluate (KEY REQUIRED, scope: signals)
// ============================================================================
// Evaluate and potentially activate strategies for a founder based on signals

router.post('/strategies/evaluate', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { user_id, startup_id, lens_id, timing_state, sector, strength, volatility, persistence_days } = req.body;
    
    if (!user_id || !lens_id) {
      return apiError(res, 'invalid_request', 'user_id and lens_id required', 400);
    }
    
    const strategyService = require('../lib/strategyService');
    
    const signals = {
      lens_id,
      timing_state: timing_state || 'warming',
      sector: sector || null,
      strength: strength || 0,
      volatility: volatility || 0,
      persistence_days: persistence_days || 0,
    };
    
    const results = await strategyService.evaluateStrategiesForFounder(user_id, startup_id, signals);
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `Activated ${results.activated.length}, resolved ${results.resolved.length}, unchanged ${results.unchanged.length}`,
      data: {
        user_id,
        activated: results.activated,
        resolved: results.resolved,
        unchanged: results.unchanged
      }
    });
    
  } catch (err) {
    console.error('[apiV1] strategies/evaluate error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 10) GET /api/v1/strategies/library (KEY REQUIRED, scope: signals)
// ============================================================================
// Returns all strategies in the library (admin view)

router.get('/strategies/library', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const strategyService = require('../lib/strategyService');
    const library = await strategyService.getStrategyLibrary();
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `${library.length} strategies in library`,
      data: library
    });
    
  } catch (err) {
    console.error('[apiV1] strategies/library error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// 11) SIGNAL GAPS: The Missing Primitive
// 
// These endpoints expose the diff between VC expectation and observed evidence.
// This is NOT advice. This is pure math.
// ============================================================================

// GET /api/v1/gaps/:startupId - Get active signal gaps for a startup
router.get('/gaps/:startupId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    const { lens } = req.query;
    
    const signalGapService = require('../lib/signalGapService');
    
    // Get formatted gap summary
    const summary = await signalGapService.getGapSummary(startupId, lens || null);
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    // Build human-readable summary
    let textSummary;
    if (summary.status === 'clear') {
      textSummary = lens 
        ? `No blocking signals under ${lens} lens.`
        : 'No blocking signals detected.';
    } else {
      textSummary = lens
        ? `${lens.charAt(0).toUpperCase() + lens.slice(1)} lens — Blocked. Primary: ${summary.primary_blocker.label} (${summary.primary_blocker.confidence} confidence).`
        : `Primary blocker: ${summary.primary_blocker.label} (${summary.gaps.length} total gaps).`;
    }
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: textSummary,
      data: {
        startup_id: startupId,
        lens: lens || 'all',
        ...summary
      }
    });
    
  } catch (err) {
    console.error('[apiV1] gaps error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/gaps/:startupId/:lens - Get gaps for specific lens (shorthand)
router.get('/gaps/:startupId/:lens', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId, lens } = req.params;
    
    // Validate lens
    const validLenses = ['sequoia', 'yc', 'a16z', 'foundersfund', 'greylock', 'god'];
    if (!validLenses.includes(lens)) {
      return apiError(res, 'invalid_request', `Invalid lens. Must be one of: ${validLenses.join(', ')}`, 400);
    }
    
    const signalGapService = require('../lib/signalGapService');
    const summary = await signalGapService.getGapSummary(startupId, lens);
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    // Structured response for scorecard display
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: summary.status === 'clear'
        ? `${lens.charAt(0).toUpperCase() + lens.slice(1)} lens: Clear`
        : `${lens.charAt(0).toUpperCase() + lens.slice(1)} lens: Blocked (${summary.primary_blocker.label})`,
      data: {
        startup_id: startupId,
        lens,
        blocked: summary.status !== 'clear',
        severity: summary.status,
        primary_blocker: summary.primary_blocker || null,
        interpretation: summary.interpretation || null,
        levers: summary.levers || [],
        all_gaps: summary.gaps || []
      }
    });
    
  } catch (err) {
    console.error('[apiV1] gaps/:lens error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/gaps/:gapId/acknowledge - Acknowledge a gap (minimal founder action)
router.post('/gaps/:gapId/acknowledge', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { gapId } = req.params;
    const { startup_id, lever_id } = req.body;
    
    if (!startup_id) {
      return apiError(res, 'invalid_request', 'startup_id is required', 400);
    }
    
    const signalGapService = require('../lib/signalGapService');
    const acknowledgment = await signalGapService.acknowledgeGap(startup_id, gapId, lever_id || null);
    
    if (!acknowledgment) {
      return apiError(res, 'not_found', 'Gap not found or already acknowledged', 404);
    }
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `Gap acknowledged. Expected resolution: ${acknowledgment.expected_resolution_window} days.`,
      data: {
        acknowledgment_id: acknowledgment.id,
        signal_gap_id: gapId,
        startup_id,
        lever_id: lever_id || null,
        acknowledged_at: acknowledgment.acknowledged_at,
        expected_resolution_window: acknowledgment.expected_resolution_window
      }
    });
    
  } catch (err) {
    console.error('[apiV1] gaps/acknowledge error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/gaps/refresh - Refresh gaps for a startup (recompute from scores)
router.post('/gaps/refresh', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startup_id } = req.body;
    
    if (!startup_id) {
      return apiError(res, 'invalid_request', 'startup_id is required', 400);
    }
    
    const signalGapService = require('../lib/signalGapService');
    const result = await signalGapService.refreshGaps(startup_id);
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `Gaps refreshed: ${result.upserted} updated, ${result.resolved} resolved.`,
      data: result
    });
    
  } catch (err) {
    console.error('[apiV1] gaps/refresh error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/levers/:factor - Get evidence levers for a blocking factor
router.get('/levers/:factor', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { factor } = req.params;
    
    const signalGapService = require('../lib/signalGapService');
    const levers = await signalGapService.getLeversForFactor(factor);
    
    if (levers.length === 0) {
      return apiError(res, 'not_found', `No levers found for factor: ${factor}`, 404);
    }
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `${levers.length} known mechanisms for ${factor}.`,
      data: {
        blocking_factor: factor,
        levers: levers.map(l => ({
          id: l.id,
          type: l.lever_type,
          description: l.description,
          expected_signal: l.expected_signal,
          typical_lag_days: l.typical_lag_days
        }))
      }
    });
    
  } catch (err) {
    console.error('[apiV1] levers error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// CANONICAL DELTA SYSTEM - Scorecard & Action Events
// ============================================================================

// GET /api/v1/scorecard/:startupId - Full scorecard with delta, blockers, evidence
router.get('/scorecard/:startupId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    
    const canonicalDelta = require('../lib/canonicalDeltaService');
    const scorecard = await canonicalDelta.getScorecard(startupId);
    
    const deltaDir = scorecard.delta.direction === 'up' ? '+' : '';
    const summary = `Signal Score ${scorecard.signalScore.toFixed(1)} (${deltaDir}${scorecard.delta.value.toFixed(1)}). ` +
      `Conf ${(scorecard.confidence * 100).toFixed(0)}%, Ver ${(scorecard.verification * 100).toFixed(0)}%. ` +
      `${scorecard.blockingFactors.count} blocker${scorecard.blockingFactors.count !== 1 ? 's' : ''}.`;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: scorecard
    });
    
  } catch (err) {
    console.error('[apiV1] scorecard error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/actions - Submit founder action event (provisional lane)
router.post('/actions', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId, category, title, description, actionDate, impactGuess, evidenceArtifactIds } = req.body;
    
    if (!startupId) {
      return apiError(res, 'invalid_request', 'startupId is required', 400);
    }
    if (!category) {
      return apiError(res, 'invalid_request', 'category is required', 400);
    }
    if (!title) {
      return apiError(res, 'invalid_request', 'title is required', 400);
    }
    
    const validCategories = ['revenue', 'product', 'hiring', 'funding', 'partnership', 'press', 'milestone', 'other'];
    if (!validCategories.includes(category)) {
      return apiError(res, 'invalid_request', `category must be one of: ${validCategories.join(', ')}`, 400);
    }
    
    const validImpacts = ['low', 'medium', 'high'];
    if (impactGuess && !validImpacts.includes(impactGuess)) {
      return apiError(res, 'invalid_request', `impactGuess must be one of: ${validImpacts.join(', ')}`, 400);
    }
    
    const canonicalDelta = require('../lib/canonicalDeltaService');
    const result = await canonicalDelta.submitActionEvent(startupId, {
      category,
      title,
      description,
      actionDate,
      impactGuess: impactGuess || 'medium',
      evidenceArtifactIds
    });
    
    const deltaDir = result.delta.deltaTotal >= 0 ? '+' : '';
    const summary = `Action "${title}" recorded. Provisional ${deltaDir}${result.delta.deltaTotal.toFixed(1)} applied. Verify for full impact.`;
    
    logApiRequest(req, 201, Date.now() - startTime);
    
    return res.status(201).json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: {
        actionEvent: {
          id: result.actionEvent.id,
          category: result.actionEvent.category,
          title: result.actionEvent.title,
          provisionalDelta: result.actionEvent.provisional_delta,
          verificationStatus: result.actionEvent.verification_status,
          verificationDeadline: result.actionEvent.verification_deadline,
          affectedFeatures: result.actionEvent.affected_features
        },
        snapshot: {
          signalScore: result.snapshot.signal_score,
          deltaTotal: result.delta.deltaTotal
        },
        nextSteps: {
          message: 'Verify this action to upgrade its impact. Unverified actions have capped influence.',
          verifyPath: '/app/scorecard/evidence',
          connectPath: '/app/settings/connectors'
        }
      }
    });
    
  } catch (err) {
    console.error('[apiV1] actions error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/actions/:startupId - List action events for a startup
router.get('/actions/:startupId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    const { status, limit = '25' } = req.query;
    
    let limitN = parseInt(limit, 10);
    if (isNaN(limitN) || limitN < 1) limitN = 25;
    if (limitN > 100) limitN = 100;
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('action_events')
      .select('*')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false })
      .limit(limitN);
    
    if (status) {
      query = query.eq('verification_status', status);
    }
    
    const { data: actions, error } = await query;
    
    if (error) {
      console.error('[apiV1] actions list error:', error);
      return apiError(res, 'server_error', 'Failed to fetch actions', 500);
    }
    
    const pending = (actions || []).filter(a => a.verification_status === 'pending').length;
    const verified = (actions || []).filter(a => a.verification_status === 'verified').length;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `${(actions || []).length} action${(actions || []).length !== 1 ? 's' : ''} (${pending} pending, ${verified} verified).`,
      data: {
        count: (actions || []).length,
        pending,
        verified,
        actions: (actions || []).map(a => ({
          id: a.id,
          category: a.category,
          title: a.title,
          description: a.description,
          actionDate: a.action_date,
          impactGuess: a.impact_guess,
          affectedFeatures: a.affected_features,
          provisionalDelta: a.provisional_delta,
          verifiedDelta: a.verified_delta,
          verificationStatus: a.verification_status,
          verificationDeadline: a.verification_deadline,
          createdAt: a.created_at,
          verifiedAt: a.verified_at
        }))
      }
    });
    
  } catch (err) {
    console.error('[apiV1] actions list error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/actions/:actionId/verify - Upgrade action verification
router.post('/actions/:actionId/verify', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { actionId } = req.params;
    const { tier, verifiedDelta } = req.body;
    
    const validTiers = ['soft_verified', 'verified', 'trusted'];
    if (!tier || !validTiers.includes(tier)) {
      return apiError(res, 'invalid_request', `tier must be one of: ${validTiers.join(', ')}`, 400);
    }
    
    const canonicalDelta = require('../lib/canonicalDeltaService');
    const result = await canonicalDelta.upgradeActionVerification(actionId, tier, verifiedDelta);
    
    const summary = `Action verified at "${tier}" tier. Score updated to ${result.snapshot.signal_score.toFixed(1)}.`;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: {
        tier,
        snapshot: {
          signalScore: result.snapshot.signal_score,
          deltaTotal: result.delta.deltaTotal
        }
      }
    });
    
  } catch (err) {
    console.error('[apiV1] verify action error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/evidence - Submit evidence artifact
router.post('/evidence', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId, artifactType, sourceName, sourceId, content, fileUrl, actionEventId } = req.body;
    
    if (!startupId) {
      return apiError(res, 'invalid_request', 'startupId is required', 400);
    }
    if (!artifactType) {
      return apiError(res, 'invalid_request', 'artifactType is required', 400);
    }
    if (!sourceName) {
      return apiError(res, 'invalid_request', 'sourceName is required', 400);
    }
    
    const validTypes = ['oauth_connector', 'webhook_event', 'document_upload', 'domain_verification', 'third_party_citation', 'human_review', 'api_integration'];
    if (!validTypes.includes(artifactType)) {
      return apiError(res, 'invalid_request', `artifactType must be one of: ${validTypes.join(', ')}`, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // Determine initial verification tier based on artifact type
    let verificationTier = 'soft_verified';
    let verificationConfidence = 0.45;
    
    if (['oauth_connector', 'webhook_event', 'api_integration'].includes(artifactType)) {
      verificationTier = 'verified';
      verificationConfidence = 0.85;
    }
    
    const { data: artifact, error } = await supabase
      .from('evidence_artifacts')
      .insert({
        startup_id: startupId,
        artifact_type: artifactType,
        source_name: sourceName,
        source_id: sourceId,
        content: content || {},
        file_url: fileUrl,
        verification_tier: verificationTier,
        verification_confidence: verificationConfidence,
        action_event_id: actionEventId,
        review_status: ['oauth_connector', 'webhook_event'].includes(artifactType) ? 'auto_approved' : 'pending'
      })
      .select()
      .single();
    
    if (error) {
      console.error('[apiV1] evidence error:', error);
      return apiError(res, 'server_error', 'Failed to submit evidence', 500);
    }
    
    // If linked to an action and auto-approved, upgrade the action
    if (actionEventId && artifact.review_status === 'auto_approved') {
      const canonicalDelta = require('../lib/canonicalDeltaService');
      await canonicalDelta.upgradeActionVerification(actionEventId, verificationTier);
    }
    
    logApiRequest(req, 201, Date.now() - startTime);
    
    return res.status(201).json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `Evidence artifact "${sourceName}" submitted (${verificationTier}).`,
      data: {
        artifact: {
          id: artifact.id,
          type: artifact.artifact_type,
          sourceName: artifact.source_name,
          verificationTier: artifact.verification_tier,
          reviewStatus: artifact.review_status
        }
      }
    });
    
  } catch (err) {
    console.error('[apiV1] evidence error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/blockers/:startupId - Get active blocking factors
router.get('/blockers/:startupId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    
    const supabase = getSupabaseClient();
    
    const { data: blockers, error } = await supabase
      .from('active_blocking_factors')
      .select('*')
      .eq('startup_id', startupId)
      .eq('is_active', true)
      .order('severity', { ascending: true }); // hard first
    
    if (error) {
      console.error('[apiV1] blockers error:', error);
      return apiError(res, 'server_error', 'Failed to fetch blockers', 500);
    }
    
    const hard = (blockers || []).filter(b => b.severity === 'hard');
    const soft = (blockers || []).filter(b => b.severity === 'soft');
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `${hard.length} hard, ${soft.length} soft blocker${(hard.length + soft.length) !== 1 ? 's' : ''}.`,
      data: {
        count: (blockers || []).length,
        hard: hard.map(b => ({
          id: b.blocker_id,
          message: b.message,
          fixPath: b.fix_path,
          affectedFeatures: b.affected_features
        })),
        soft: soft.map(b => ({
          id: b.blocker_id,
          message: b.message,
          fixPath: b.fix_path,
          affectedFeatures: b.affected_features
        }))
      }
    });
    
  } catch (err) {
    console.error('[apiV1] blockers error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/sources/:startupId - Get connected sources status
router.get('/sources/:startupId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    
    const supabase = getSupabaseClient();
    
    const { data: sources, error } = await supabase
      .from('connected_sources')
      .select('*')
      .eq('startup_id', startupId);
    
    if (error) {
      console.error('[apiV1] sources error:', error);
      return apiError(res, 'server_error', 'Failed to fetch sources', 500);
    }
    
    const active = (sources || []).filter(s => s.status === 'active').length;
    const expired = (sources || []).filter(s => s.status === 'expired').length;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `${active} active, ${expired} expired source${(sources || []).length !== 1 ? 's' : ''}.`,
      data: {
        count: (sources || []).length,
        active,
        expired,
        sources: (sources || []).map(s => ({
          id: s.id,
          type: s.source_type,
          name: s.source_name,
          status: s.status,
          lastSync: s.last_sync_at,
          lastError: s.last_error,
          scopes: s.scopes
        }))
      }
    });
    
  } catch (err) {
    console.error('[apiV1] sources error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/scorecard/:startupId/refresh - Force recompute scorecard
router.post('/scorecard/:startupId/refresh', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    
    const canonicalDelta = require('../lib/canonicalDeltaService');
    const result = await canonicalDelta.computeAndStoreSnapshot(startupId, 'manual_refresh');
    
    const deltaDir = result.delta.deltaTotal >= 0 ? '+' : '';
    const summary = `Scorecard refreshed. Score: ${result.snapshot.signal_score.toFixed(1)} (${deltaDir}${result.delta.deltaTotal.toFixed(1)}).`;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: {
        signalScore: result.snapshot.signal_score,
        deltaTotal: result.delta.deltaTotal,
        topMovers: result.delta.topMovers.map(m => ({
          featureId: m.id,
          delta: m.delta,
          reasons: m.reasons
        })),
        blockers: result.delta.blockers.length
      }
    });
    
  } catch (err) {
    console.error('[apiV1] scorecard refresh error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/god-adjustment/:startupId - Get GOD score adjustment from verified deltas
router.get('/god-adjustment/:startupId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    
    const canonicalDelta = require('../lib/canonicalDeltaService');
    const adjustment = await canonicalDelta.computeGodAdjustment(startupId);
    
    const dir = adjustment.adjustment >= 0 ? '+' : '';
    const summary = `GOD adjustment: ${dir}${adjustment.adjustment.toFixed(2)} from verified signal deltas.`;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: adjustment
    });
    
  } catch (err) {
    console.error('[apiV1] god-adjustment error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// ============================================================================
// CANONICAL VERIFICATION API v2 (new pipeline)
// ============================================================================

const verificationService = require('../lib/verificationService');

// POST /api/v1/v2/actions - Submit founder action (fast lane)
router.post('/v2/actions', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId, type, title, details, occurredAt, impactGuess, fields } = req.body;
    
    if (!startupId || !type || !title || !impactGuess) {
      return apiError(res, 'invalid_request', 'Missing required fields: startupId, type, title, impactGuess', 400);
    }
    
    if (!verificationService.ACTION_TYPES.includes(type)) {
      return apiError(res, 'invalid_request', `Invalid action type. Must be one of: ${verificationService.ACTION_TYPES.join(', ')}`, 400);
    }
    
    const result = await verificationService.submitAction({
      startupId,
      actorUserId: req.apiKey?.user_id || null,
      type,
      title,
      details,
      occurredAt: occurredAt || new Date().toISOString(),
      impactGuess,
      fields
    });
    
    logApiRequest(req, 201, Date.now() - startTime);
    
    return res.status(201).json({
      ok: true,
      schema_version: '2.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `Action "${title}" submitted. Provisional delta: +${result.snapshot.deltaTotal.toFixed(2)}.`,
      data: result
    });
    
  } catch (err) {
    console.error('[apiV1] v2/actions error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/v2/actions/:startupId - List actions for startup
router.get('/v2/actions/:startupId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    const { status, limit, offset } = req.query;
    
    const result = await verificationService.listActions(startupId, {
      status,
      limit: parseInt(limit) || 25,
      offset: parseInt(offset) || 0
    });
    
    const pending = result.actions.filter(a => ['pending', 'provisional_applied'].includes(a.status)).length;
    const verified = result.actions.filter(a => a.status === 'verified').length;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '2.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `${result.actions.length} actions (${pending} pending, ${verified} verified).`,
      data: {
        actions: result.actions.map(a => ({
          id: a.id,
          type: a.type,
          title: a.title,
          status: a.status,
          impactGuess: a.impact_guess,
          occurredAt: a.occurred_at,
          submittedAt: a.submitted_at,
          verification: a.verification_states_v2 ? {
            current: a.verification_states_v2.current_verification,
            tier: a.verification_states_v2.tier,
            satisfied: a.verification_states_v2.satisfied,
            missing: a.verification_states_v2.missing
          } : null,
          provisionalDeltaId: a.provisional_delta_id,
          verifiedDeltaId: a.verified_delta_id
        })),
        total: result.total,
        hasMore: result.hasMore
      }
    });
    
  } catch (err) {
    console.error('[apiV1] v2/actions list error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/v2/evidence - Submit evidence artifact
router.post('/v2/evidence', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId, actionId, type, ref, extracted } = req.body;
    
    if (!startupId || !type) {
      return apiError(res, 'invalid_request', 'Missing required fields: startupId, type', 400);
    }
    
    const validTypes = [
      'oauth_connector', 'webhook_event', 'document_upload',
      'screenshot', 'email_proof', 'public_link',
      'bank_transaction', 'manual_review_note'
    ];
    
    if (!validTypes.includes(type)) {
      return apiError(res, 'invalid_request', `Invalid evidence type. Must be one of: ${validTypes.join(', ')}`, 400);
    }
    
    const result = await verificationService.submitEvidence({
      startupId,
      actionId,
      type,
      ref: ref || {},
      extracted
    });
    
    logApiRequest(req, 201, Date.now() - startTime);
    
    return res.status(201).json({
      ok: true,
      schema_version: '2.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `Evidence submitted. Matched ${result.matchedActions.length} action(s).`,
      data: result
    });
    
  } catch (err) {
    console.error('[apiV1] v2/evidence error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/v2/actions/:actionId/resolve - Resolve inconsistency
router.post('/v2/actions/:actionId/resolve', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { actionId } = req.params;
    const { explanation, evidenceId, verifierNotes } = req.body;
    
    if (!explanation) {
      return apiError(res, 'invalid_request', 'Missing required field: explanation', 400);
    }
    
    const result = await verificationService.resolveInconsistency(actionId, {
      explanation,
      evidenceId,
      verifierNotes
    });
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '2.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: result.satisfied 
        ? `Inconsistency resolved. Action now verified at ${result.tier} tier.`
        : `Inconsistency noted. Verification at ${(result.currentVerification * 100).toFixed(0)}%.`,
      data: result
    });
    
  } catch (err) {
    console.error('[apiV1] v2/resolve error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/v2/scorecard/:startupId - Full scorecard with verification pipeline data
router.get('/v2/scorecard/:startupId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    
    const scorecard = await verificationService.getScorecard(startupId);
    
    const deltaDir = scorecard.delta.signal >= 0 ? '+' : '';
    const summary = `Signal ${(scorecard.signalScore * 100).toFixed(1)} (${deltaDir}${(scorecard.delta.signal * 100).toFixed(1)}), GOD ${scorecard.godScore.toFixed(1)}. ${scorecard.blockers.length} blocker(s).`;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '2.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: scorecard
    });
    
  } catch (err) {
    console.error('[apiV1] v2/scorecard error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/v2/evidence-center/:startupId - Evidence center data
router.get('/v2/evidence-center/:startupId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { startupId } = req.params;
    
    const data = await verificationService.getEvidenceCenter(startupId);
    
    const connected = data.connectedSources.filter(s => s.status === 'connected').length;
    const total = data.connectedSources.length;
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      schema_version: '2.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary: `${connected}/${total} sources connected. ${data.pendingEvidence.length} pending. ${data.conflicts.length} conflict(s).`,
      data
    });
    
  } catch (err) {
    console.error('[apiV1] v2/evidence-center error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/signals/rollup - Refresh investor signal distribution from vc_faith_signals
router.post('/signals/rollup', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.rpc('refresh_investor_signal_distribution');
    if (error) throw error;

    const result = data || {};
    const summary = `Investor signal rollup complete: ${result.source_rows || 0} source rows, ${result.theme_rows || 0} theme rows across ${result.investors_updated || 0} investors.`;

    logApiRequest(req, 200, Date.now() - startTime);
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: result
    });
  } catch (err) {
    console.error('[apiV1] signals/rollup error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// GET /api/v1/signals/investor/:investorId - Get investor signal profile
router.get('/signals/investor/:investorId', requireApiKey('signals'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { investorId } = req.params;
    const type = req.query.type || 'all'; // 'source', 'theme', 'all'

    let query = supabase
      .from('investor_signal_distribution')
      .select('*')
      .eq('investor_id', investorId)
      .order('occurrence_count', { ascending: false });

    if (type === 'source') query = query.like('signal_type', 'source:%');
    else if (type === 'theme') query = query.like('signal_type', 'theme:%');

    const { data, error } = await query;
    if (error) throw error;

    // Also fetch the summary from investors.signals
    const { data: investor } = await supabase
      .from('investors')
      .select('name, firm, signals')
      .eq('id', investorId)
      .single();

    const summary = `${investor?.name || investorId}: ${data?.length || 0} signal dimensions.`;

    logApiRequest(req, 200, Date.now() - startTime);
    return res.json({
      ok: true,
      schema_version: '1.0',
      request_id: req.requestId || `req_${Date.now()}`,
      generated_at: new Date().toISOString(),
      summary,
      data: {
        investor: { name: investor?.name, firm: investor?.firm },
        signal_summary: investor?.signals || null,
        distributions: data || []
      }
    });
  } catch (err) {
    console.error('[apiV1] signals/investor error:', err);
    logApiRequest(req, 500, Date.now() - startTime);
    return apiError(res, 'server_error', err.message, 500);
  }
});

// POST /api/v1/webhooks/:provider - Webhook ingestion (Stripe, GitHub, etc.)
router.post('/webhooks/:provider', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { provider } = req.params;
    const validProviders = ['stripe', 'github', 'plaid', 'hubspot'];
    
    if (!validProviders.includes(provider)) {
      return apiError(res, 'invalid_request', `Unknown provider: ${provider}`, 400);
    }
    
    // TODO: Implement webhook signature verification per provider
    // For now, just acknowledge receipt
    
    console.log(`[webhooks] Received ${provider} webhook:`, {
      headers: req.headers,
      bodyKeys: Object.keys(req.body || {})
    });
    
    // Extract event data
    const eventData = req.body;
    const eventId = eventData?.id || eventData?.event?.id || `${provider}_${Date.now()}`;
    const eventType = eventData?.type || eventData?.event?.type || 'unknown';
    
    // TODO: Map webhook to startupId (requires lookup by connected account)
    // For now, log and acknowledge
    
    logApiRequest(req, 200, Date.now() - startTime);
    
    return res.json({
      ok: true,
      received: true,
      eventId,
      eventType,
      provider
    });
    
  } catch (err) {
    console.error('[webhooks] error:', err);
    return apiError(res, 'server_error', err.message, 500);
  }
});

module.exports = router;
