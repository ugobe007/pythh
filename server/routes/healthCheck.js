/**
 * Deep Health Check Route - /api/health/deep
 * ============================================================================
 * Tests every critical pipeline end-to-end and returns pass/fail per component.
 * Call this after deployments or when something seems broken.
 * 
 * GET /api/health/deep
 * GET /api/health/deep?verbose=true  (includes sample data)
 * ============================================================================
 */

'use strict';

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Individual checks ────────────────────────────────────────────────────────

async function checkGodScores() {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved')
    .gte('total_god_score', 40)
    .limit(1);
  
  const { count } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');

  if (error) return { ok: false, msg: error.message };
  if (!count || count === 0) return { ok: false, msg: 'No approved startups' };
  return { ok: true, msg: `${count} approved startups`, count };
}

async function checkInvestorSignals() {
  const { data, error } = await supabase
    .from('investors')
    .select('id, signals, focus_areas')
    .neq('signals', '[]')
    .not('focus_areas', 'is', null)
    .limit(1);

  const { count: total } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });

  const { count: withSignals } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true })
    .neq('signals', '[]');

  if (error) return { ok: false, msg: error.message };
  
  const pct = total ? Math.round((withSignals / total) * 100) : 0;
  const ok = pct >= 10; // At least 10% should have signals
  return { 
    ok, 
    msg: `${withSignals}/${total} investors have Oracle signals (${pct}%)`,
    pct
  };
}

async function checkMatches() {
  const { count, error } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .gte('match_score', 60);

  if (error) return { ok: false, msg: error.message };
  const ok = count > 5000;
  return { ok, msg: `${count} quality matches (score >= 60)`, count };
}

async function checkSqlFunctions() {
  const results = {};

  // get_platform_velocity
  const { data: v, error: ve } = await supabase.rpc('get_platform_velocity');
  results.platform_velocity = !ve && v?.length > 0 
    ? { ok: true, msg: `${v[0]?.total_matches_week} matches this week` }
    : { ok: false, msg: ve?.message || 'No data' };

  // get_hot_matches
  const { data: h, error: he } = await supabase.rpc('get_hot_matches', { limit_count: 1, hours_ago: 168 });
  results.hot_matches = !he && h !== null
    ? { ok: true, msg: `${h.length} hot match(es) returned` }
    : { ok: false, msg: he?.message || 'Function missing' };

  // get_sector_heat_map
  const { data: s, error: se } = await supabase.rpc('get_sector_heat_map', { days_ago: 7 });
  results.sector_heat_map = !se && s?.length > 0
    ? { ok: true, msg: `${s.length} sectors tracked` }
    : { ok: false, msg: se?.message || 'No data' };

  return results;
}

async function checkConvergenceView() {
  const { data, error } = await supabase
    .from('convergence_candidates')
    .select('investor_id, signals, focus_areas')
    .not('signals', 'is', null)
    .limit(1);

  if (error) return { ok: false, msg: `View error: ${error.message}` };
  
  const hasSignalColumn = data !== null;
  if (!hasSignalColumn) return { ok: false, msg: 'convergence_candidates view missing signals column' };
  
  const { count } = await supabase
    .from('convergence_candidates')
    .select('*', { count: 'exact', head: true });

  return { ok: true, msg: `View healthy, ${count} rows, signals column present` };
}

async function checkEnrichmentPipeline() {
  const { count: waiting } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .eq('enrichment_status', 'waiting');

  const { count: enriched } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .eq('enrichment_status', 'enriched');

  const total = (waiting || 0) + (enriched || 0);
  const pct = total ? Math.round((enriched / total) * 100) : 0;

  return { 
    ok: true, 
    msg: `${enriched} enriched, ${waiting} waiting (${pct}% done)`,
    enriched, waiting, pct
  };
}

async function checkOracleSessions() {
  const { count, error } = await supabase
    .from('oracle_sessions')
    .select('*', { count: 'exact', head: true });

  if (error && error.code !== '42P01') return { ok: false, msg: error.message };
  return { ok: true, msg: `${count || 0} Oracle sessions`, count: count || 0 };
}

// ── Main handler ─────────────────────────────────────────────────────────────

router.get('/deep', async (req, res) => {
  const verbose = req.query.verbose === 'true';
  const startTime = Date.now();

  try {
    // Run all checks in parallel
    const [
      godScores,
      investorSignals,
      matches,
      sqlFunctions,
      convergenceView,
      enrichmentPipeline,
      oracleSessions,
    ] = await Promise.all([
      checkGodScores(),
      checkInvestorSignals(),
      checkMatches(),
      checkSqlFunctions(),
      checkConvergenceView(),
      checkEnrichmentPipeline(),
      checkOracleSessions(),
    ]);

    const checks = {
      god_scores: godScores,
      investor_signals: investorSignals,
      matches: matches,
      sql_get_platform_velocity: sqlFunctions.platform_velocity,
      sql_get_hot_matches: sqlFunctions.hot_matches,
      sql_get_sector_heat_map: sqlFunctions.sector_heat_map,
      convergence_view: convergenceView,
      enrichment_pipeline: enrichmentPipeline,
      oracle_sessions: oracleSessions,
    };

    const failures = Object.entries(checks).filter(([, v]) => !v.ok);
    const passed = Object.keys(checks).length - failures.length;
    const allOk = failures.length === 0;

    return res.json({
      status: allOk ? 'healthy' : failures.length <= 2 ? 'degraded' : 'unhealthy',
      passed: `${passed}/${Object.keys(checks).length}`,
      elapsed_ms: Date.now() - startTime,
      failures: failures.map(([k, v]) => ({ check: k, reason: v.msg })),
      ...(verbose ? { checks } : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

// Quick liveness check
router.get('/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

module.exports = router;
