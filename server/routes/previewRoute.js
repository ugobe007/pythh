/**
 * /api/preview/:startupId
 * ═══════════════════════════════════════════════════════════════
 * Public, no-auth endpoint for the shareable match preview page.
 * Returns startup info + top 10 investor matches (names/firms/scores).
 * Only serves `status = 'approved'` startups.
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

// GET /api/preview/:startupId
router.get('/:startupId', async (req, res) => {
  const { startupId } = req.params;

  // Validate UUID format
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(startupId)) {
    return res.status(400).json({ error: 'Invalid startup ID' });
  }

  try {
    // 1. Fetch startup (approved only)
    const { data: startup, error: sErr } = await supabase
      .from('startup_uploads')
      .select('id, name, tagline, description, website, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
      .eq('id', startupId)
      .eq('status', 'approved')
      .single();

    if (sErr || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    // 2. Fetch total match count
    const { count: totalMatches } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId);

    // 3. Fetch top 10 matches with investor details
    const { data: matchRows, error: mErr } = await supabase
      .from('startup_investor_matches')
      .select(`
        match_score,
        why_you_match,
        investors (
          id,
          name,
          firm,
          title,
          sectors,
          stage,
          check_size_min,
          check_size_max,
          investor_tier,
          twitter_url,
          linkedin_url,
          photo_url
        )
      `)
      .eq('startup_id', startupId)
      .order('match_score', { ascending: false })
      .limit(10);

    if (mErr) {
      console.error('[preview] match fetch error:', mErr);
      return res.status(500).json({ error: 'Failed to load matches' });
    }

    // 4. Compute percentile rank among all approved startups
    const { count: higherCount } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gt('total_god_score', startup.total_god_score || 0);

    const { count: approvedTotal } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const percentile = approvedTotal
      ? Math.round(100 - ((higherCount / approvedTotal) * 100))
      : 50;

    const matches = (matchRows || []).map(row => ({
      match_score: row.match_score,
      why_you_match: row.why_you_match,
      investor: row.investors
    })).filter(m => m.investor);

    res.json({
      startup: {
        id: startup.id,
        name: startup.name,
        tagline: startup.tagline,
        description: startup.description,
        website: startup.website,
        sectors: startup.sectors,
        stage: startup.stage,
        god_score: startup.total_god_score,
        score_components: {
          team: startup.team_score,
          traction: startup.traction_score,
          market: startup.market_score,
          product: startup.product_score,
          vision: startup.vision_score,
        },
        percentile,
      },
      total_matches: totalMatches || 0,
      matches,
    });

  } catch (err) {
    console.error('[preview] unexpected error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
