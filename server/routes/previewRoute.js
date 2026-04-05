/**
 * /api/preview/:startupId
 * ═══════════════════════════════════════════════════════════════
 * Public, no-auth endpoint for the shareable match preview page.
 * Returns startup info + top investor matches (unique firm; up to 10 for preview UI).
 * Serves startups that are visible to the product (approved, pending, etc.).
 * Rejected rows are excluded so share links cannot revive spam.
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const { dedupeInvestorMatchesByFirm } = require('../../lib/dedupeInvestorMatchesByFirm');

/** Narrative for UI when top-level columns are empty but inference JSON has text */
function effectiveStartupDescription(row) {
  const ex = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};
  return (
    row.description ||
    row.pitch ||
    ex.description ||
    ex.product_description ||
    ex.value_proposition ||
    (typeof ex.pitch === 'string' ? ex.pitch : null) ||
    null
  );
}

// GET /api/preview/:startupId/investor/:investorId — oracle match copy for deep links (must be before /:startupId)
router.get('/:startupId/investor/:investorId', async (req, res) => {
  const { startupId, investorId } = req.params;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(startupId) || !uuidRe.test(investorId)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    const { data: startup, error: sErr } = await supabase
      .from('startup_uploads')
      .select('id, status')
      .eq('id', startupId)
      .maybeSingle();

    if (sErr || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    if (String(startup.status || '').toLowerCase() === 'rejected') {
      return res.status(404).json({ error: 'Startup not found' });
    }

    const { data: row, error: mErr } = await supabase
      .from('startup_investor_matches')
      .select('match_score, why_you_match, reasoning, fit_analysis')
      .eq('startup_id', startupId)
      .eq('investor_id', investorId)
      .maybeSingle();

    if (mErr || !row) {
      return res.status(404).json({ error: 'Match not found' });
    }

    return res.json({
      match_score: row.match_score,
      why_you_match: row.why_you_match,
      reasoning: row.reasoning,
      fit_analysis: row.fit_analysis ?? null,
    });
  } catch (err) {
    console.error('[preview] investor match error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/preview/:startupId
router.get('/:startupId', async (req, res) => {
  const { startupId } = req.params;

  // Validate UUID format
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(startupId)) {
    return res.status(400).json({ error: 'Invalid startup ID' });
  }

  try {
    // 1. Fetch startup by id — filter rejected in JS so NULL / pending / approved all work
    //    (PostgREST .neq() excludes NULL rows, which made /api/preview 404 for many inserts.)
    const { data: startup, error: sErr } = await supabase
      .from('startup_uploads')
      .select('id, name, tagline, description, pitch, website, sectors, stage, status, extracted_data, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
      .eq('id', startupId)
      .maybeSingle();

    if (sErr || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    if (String(startup.status || '').toLowerCase() === 'rejected') {
      return res.status(404).json({ error: 'Startup not found' });
    }

    // 1b. Fetch signal scores
    const { data: signalData } = await supabase
      .from('startup_signal_scores')
      .select('signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity')
      .eq('startup_id', startupId)
      .maybeSingle();

    // 2. Fetch total match count
    const { count: totalMatches } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId);

    // 3. Fetch a wide slice, then dedupe by VC firm (one partner per firm), keep top 10 for preview UI
    const { data: matchRows, error: mErr } = await supabase
      .from('startup_investor_matches')
      .select(`
        investor_id,
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
      .limit(120);

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

    const mapped = (matchRows || [])
      .map((row) => {
        const raw = row.investors;
        const investor = Array.isArray(raw) ? raw[0] : raw;
        return {
          investor_id: row.investor_id,
          match_score: row.match_score,
          why_you_match: row.why_you_match,
          investor,
        };
      })
      .filter((m) => m.investor && (m.investor.id || m.investor_id));

    const matches = dedupeInvestorMatchesByFirm(mapped, 10);

    const descriptionForUi = effectiveStartupDescription(startup);

    res.json({
      startup: {
        id: startup.id,
        name: startup.name,
        tagline: startup.tagline,
        description: descriptionForUi,
        extracted_data: startup.extracted_data || null,
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
        signal_score: signalData?.signals_total || 0,
        signal_components: signalData ? {
          founder_language_shift: signalData.founder_language_shift || 0,
          investor_receptivity: signalData.investor_receptivity || 0,
          news_momentum: signalData.news_momentum || 0,
          capital_convergence: signalData.capital_convergence || 0,
          execution_velocity: signalData.execution_velocity || 0,
        } : null,
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
