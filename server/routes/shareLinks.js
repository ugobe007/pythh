/**
 * PYTHH Share Links API Router
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * Handles creation and resolution of public share links.
 * 
 * Endpoints:
 * - POST /api/share-links - Create a new share link
 * - GET /api/share-links/:id - Resolve a share link (public, no auth)
 * - PUT /api/share-links/:id/revoke - Revoke a share link
 * - GET /api/share-links/my - Get user's share links
 * 
 * Security: Public resolution uses service role. No RLS bypass needed.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const crypto = require('crypto');
const { getSupabaseClient } = require('../lib/supabaseClient');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// HELPER: Get authenticated user
// ═══════════════════════════════════════════════════════════════

async function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.slice(7);
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// ═══════════════════════════════════════════════════════════════
// POST /api/share-links - Create a new share link
// ═══════════════════════════════════════════════════════════════

router.post('/', async (req, res) => {
  try {
    // Auth is optional but recommended
    const user = await getAuthUser(req);
    
    const { share_type, payload, expires_in_days } = req.body;
    
    // Validate share_type
    const validTypes = ['score_snapshot', 'investor_brief', 'market_slice', 'founder_dashboard', 'investor_pipeline'];
    if (!validTypes.includes(share_type)) {
      return res.status(400).json({ 
        error: 'invalid_share_type', 
        message: `share_type must be one of: ${validTypes.join(', ')}` 
      });
    }
    
    // Validate payload exists
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ 
        error: 'invalid_payload', 
        message: 'payload is required and must be an object' 
      });
    }
    
    // Generate secure token
    const shareToken = crypto.randomBytes(16).toString('base64url');
    
    // Calculate expiry (null = never expires)
    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }
    
    // Strip any private notes from payload for public links
    const sanitizedPayload = { ...payload };
    delete sanitizedPayload.private_notes;
    delete sanitizedPayload.user_notes;
    
    const supabase = getSupabaseClient();
    
    // Insert share link using service role (no RLS issues)
    const { data: shareLink, error: insertError } = await supabase
      .from('share_links')
      .insert({
        token: shareToken,
        user_id: user?.id || null, // Allow anonymous creation
        share_type,
        payload: sanitizedPayload,
        visibility: 'public',
        include_notes: false,
        expires_at: expiresAt?.toISOString() || null,
        view_count: 0,
      })
      .select('id, token, created_at, expires_at')
      .single();
    
    if (insertError) {
      console.error('[share-links] Insert error:', insertError);
      return res.status(500).json({ 
        error: 'create_failed', 
        message: 'Failed to create share link' 
      });
    }
    
    // Build share URL
    const baseUrl = process.env.APP_URL || req.headers.origin || 'https://pythh.ai';
    const shareUrl = `${baseUrl}/s/${shareToken}`;
    
    res.json({
      share_id: shareLink.id,
      token: shareToken,
      url: shareUrl,
      expires_at: shareLink.expires_at,
      created_at: shareLink.created_at,
    });
    
    console.log(`[share-links] Created ${share_type} link: ${shareToken}`);
    
  } catch (error) {
    console.error('[share-links] Create error:', error);
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/share-links/:token - Resolve a share link (PUBLIC)
// ═══════════════════════════════════════════════════════════════

router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token || token.length < 10) {
      return res.status(400).json({ error: 'invalid_token' });
    }
    
    const supabase = getSupabaseClient();
    
    // Fetch share link using service role
    const { data: shareLink, error: fetchError } = await supabase
      .from('share_links')
      .select('id, share_type, payload, expires_at, revoked_at, view_count, created_at')
      .eq('token', token)
      .single();
    
    if (fetchError || !shareLink) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Share link not found or invalid' 
      });
    }
    
    // Check if revoked
    if (shareLink.revoked_at) {
      return res.status(410).json({ 
        error: 'revoked', 
        message: 'This share link has been revoked' 
      });
    }
    
    // Check if expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({ 
        error: 'expired', 
        message: 'This share link has expired' 
      });
    }
    
    // Increment view count (fire and forget)
    supabase
      .from('share_links')
      .update({ view_count: (shareLink.view_count || 0) + 1 })
      .eq('id', shareLink.id)
      .then(() => {})
      .catch(() => {});
    
    // Return share data
    res.json({
      share_type: shareLink.share_type,
      payload: shareLink.payload,
      created_at: shareLink.created_at,
      expires_at: shareLink.expires_at,
    });
    
  } catch (error) {
    console.error('[share-links] Resolve error:', error);
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// POST /api/share-links/:token/revoke - Revoke a share link
// ═══════════════════════════════════════════════════════════════

router.post('/:token/revoke', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    
    const { token } = req.params;
    const supabase = getSupabaseClient();
    
    // Find and verify ownership
    const { data: shareLink, error: fetchError } = await supabase
      .from('share_links')
      .select('id, user_id')
      .eq('token', token)
      .single();
    
    if (fetchError || !shareLink) {
      return res.status(404).json({ error: 'not_found' });
    }
    
    // Check ownership (allow if user_id matches or is null)
    if (shareLink.user_id && shareLink.user_id !== user.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
    
    // Revoke by setting revoked_at
    const { error: updateError } = await supabase
      .from('share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', shareLink.id);
    
    if (updateError) {
      console.error('[share-links] Revoke error:', updateError);
      return res.status(500).json({ error: 'revoke_failed' });
    }
    
    res.json({ success: true, revoked_at: new Date().toISOString() });
    
    console.log(`[share-links] Revoked link: ${token}`);
    
  } catch (error) {
    console.error('[share-links] Revoke error:', error);
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

// Also support PUT for backwards compatibility
router.put('/:token/revoke', async (req, res) => {
  // Delegate to POST handler
  req.method = 'POST';
  return router.handle(req, res);
});

// ═══════════════════════════════════════════════════════════════
// GET /api/share-links/:token/rankings - Get live rankings for market_slice
// (Option A: server builds table from current data)
// ═══════════════════════════════════════════════════════════════

router.get('/:token/rankings', async (req, res) => {
  try {
    const { token } = req.params;
    const { lens_id, mode, sector } = req.query;
    
    const supabase = getSupabaseClient();
    
    // Fetch share link
    const { data: shareLink, error: fetchError } = await supabase
      .from('share_links')
      .select('id, share_type, payload, revoked_at, expires_at')
      .eq('token', token)
      .single();
    
    if (fetchError || !shareLink) {
      return res.status(404).json({ error: 'not_found' });
    }
    
    // Check validity
    if (shareLink.revoked_at) {
      return res.status(410).json({ error: 'revoked' });
    }
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({ error: 'expired' });
    }
    
    // Only market_slice supports live rankings
    if (shareLink.share_type !== 'market_slice') {
      return res.status(400).json({ error: 'invalid_share_type', message: 'Only market_slice supports live rankings' });
    }
    
    const payload = shareLink.payload;
    const topN = payload.top_n || 50;
    
    // Allow lens switching within shared scope
    const activeLens = lens_id || payload.lens_id || 'god';
    const activeMode = mode || payload.filters?.mode || 'all';
    const activeSector = sector || payload.filters?.sector;
    
    // Build query for live rankings
    let query = supabase
      .from('startup_uploads')
      .select('id, name, sector, total_god_score, created_at')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null);
    
    // Apply sector filter if mode is 'sector'
    if (activeMode === 'sector' && activeSector) {
      query = query.ilike('sector', `%${activeSector}%`);
    }
    
    // Order by score (lens-specific scoring could be added later)
    query = query
      .order('total_god_score', { ascending: false })
      .limit(topN);
    
    const { data: startups, error: queryError } = await query;
    
    if (queryError) {
      console.error('[share-links] Rankings query error:', queryError);
      return res.status(500).json({ error: 'query_failed' });
    }
    
    // Format rankings
    const rankings = (startups || []).map((s, i) => ({
      rank: i + 1,
      id: s.id,
      name: s.name,
      sector: s.sector,
      score: Math.round((s.total_god_score || 0) * 10) / 10,
      delta: 0, // Could compute from historical data
    }));
    
    res.json({
      lens_id: activeLens,
      window: payload.window || '24h',
      mode: activeMode,
      sector: activeSector,
      top_n: topN,
      rankings,
    });
    
  } catch (error) {
    console.error('[share-links] Rankings error:', error);
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/share-links/:token/snapshot - Get lens-switched snapshot for score_snapshot
// (Server generates a public-safe snapshot for the requested lens)
// ═══════════════════════════════════════════════════════════════

router.get('/:token/snapshot', async (req, res) => {
  try {
    const { token } = req.params;
    const { lens_id } = req.query;
    
    const supabase = getSupabaseClient();
    
    // Fetch share link
    const { data: shareLink, error: fetchError } = await supabase
      .from('share_links')
      .select('id, share_type, payload, revoked_at, expires_at')
      .eq('token', token)
      .single();
    
    if (fetchError || !shareLink) {
      return res.status(404).json({ error: 'not_found' });
    }
    
    // Check validity
    if (shareLink.revoked_at) {
      return res.status(410).json({ error: 'revoked' });
    }
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({ error: 'expired' });
    }
    
    // Only score_snapshot supports lens switching
    if (shareLink.share_type !== 'score_snapshot') {
      return res.status(400).json({ error: 'invalid_share_type', message: 'Only score_snapshot supports lens switching' });
    }
    
    const payload = shareLink.payload;
    const startupId = payload.startup_id;
    const activeLens = lens_id || payload.lens_id || 'god';
    
    // Fetch startup data
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name, sector, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
      .eq('id', startupId)
      .eq('status', 'approved')
      .single();
    
    if (startupError || !startup) {
      return res.status(404).json({ error: 'startup_not_found' });
    }
    
    // Get approximate rank
    const { count: betterCount } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gt('total_god_score', startup.total_god_score || 0);
    
    const rank = (betterCount || 0) + 1;
    
    // Build lens-adjusted snapshot (simplified - in production would use actual lens weights)
    const lensMultipliers = {
      god: { team: 1.0, traction: 1.0, market: 1.0, product: 1.0, vision: 1.0 },
      yc: { team: 1.2, traction: 1.3, market: 0.9, product: 1.1, vision: 0.8 },
      sequoia: { team: 1.1, traction: 1.0, market: 1.3, product: 0.9, vision: 1.0 },
      foundersfund: { team: 1.3, traction: 0.8, market: 1.0, product: 1.0, vision: 1.2 },
      a16z: { team: 1.0, traction: 1.1, market: 1.1, product: 1.2, vision: 0.9 },
      greylock: { team: 1.2, traction: 1.0, market: 1.0, product: 1.0, vision: 1.1 },
    };
    
    const mult = lensMultipliers[activeLens] || lensMultipliers.god;
    
    // Calculate lens-adjusted score
    const team = (startup.team_score || 0) * mult.team;
    const traction = (startup.traction_score || 0) * mult.traction;
    const market = (startup.market_score || 0) * mult.market;
    const product = (startup.product_score || 0) * mult.product;
    const vision = (startup.vision_score || 0) * mult.vision;
    
    const lensScore = Math.round(((team + traction + market + product + vision) / 5) * 10) / 10;
    
    // Build breakdown
    const breakdown = [
      { factor: 'team', label: 'Team', contribution: Math.round(team * 10) / 10 },
      { factor: 'traction', label: 'Traction', contribution: Math.round(traction * 10) / 10 },
      { factor: 'market', label: 'Market', contribution: Math.round(market * 10) / 10 },
      { factor: 'product', label: 'Product', contribution: Math.round(product * 10) / 10 },
      { factor: 'vision', label: 'Vision', contribution: Math.round(vision * 10) / 10 },
    ].sort((a, b) => b.contribution - a.contribution);
    
    // Build top drivers (top 3)
    const topDrivers = breakdown.slice(0, 3).map(b => ({
      label: b.label,
      pct: Math.round((b.contribution / (lensScore || 1)) * 100),
    }));
    
    // Build public-safe snapshot
    const snapshot = {
      startup_name: startup.name,
      score: lensScore,
      rank,
      rank_delta: 0, // Would need historical data
      velocity: 'neutral',
      top_drivers: topDrivers,
      breakdown,
    };
    
    res.json({
      lens_id: activeLens,
      snapshot,
    });
    
  } catch (error) {
    console.error('[share-links] Snapshot error:', error);
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/share-links/my - Get user's share links
// ═══════════════════════════════════════════════════════════════

router.get('/my/list', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    
    const supabase = getSupabaseClient();
    
    const { data: links, error } = await supabase
      .from('share_links')
      .select('id, token, share_type, created_at, expires_at, revoked_at, view_count')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('[share-links] List error:', error);
      return res.status(500).json({ error: 'fetch_failed' });
    }
    
    // Build URLs
    const baseUrl = process.env.APP_URL || req.headers.origin || 'https://pythh.ai';
    const linksWithUrls = (links || []).map(link => ({
      ...link,
      url: `${baseUrl}/s/${link.token}`,
      is_active: !link.revoked_at && (!link.expires_at || new Date(link.expires_at) > new Date()),
    }));
    
    res.json({ links: linksWithUrls });
    
  } catch (error) {
    console.error('[share-links] List error:', error);
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

module.exports = router;
