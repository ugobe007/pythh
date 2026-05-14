'use strict';

/**
 * Submit Feedback Route
 * ─────────────────────────────────────────────────────────────────────────────
 * Accepts accuracy labels from the frontend ("was this the right startup?")
 * and from the watchdog. Labels feed back into the ML training dataset.
 *
 * POST /api/submit/feedback
 *   Body: { log_id?, startup_id, was_correct, source? }
 *
 * GET /api/submit/intelligence?endpoint=instant&hours=24
 *   Returns rolling stats: error rate, P95 latency, new-URL %, domain leaderboard
 *
 * GET /api/submit/domain-stats?domain=stripe.com
 *   Returns ML resolver weights for a specific domain
 */

const express = require('express');
const router  = express.Router();
const intel   = require('../services/submitUrlIntelligence');
const { createClient } = require('@supabase/supabase-js');

function getClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );
}

// ── POST /api/submit/feedback ────────────────────────────────────────────────
router.post('/feedback', async (req, res) => {
  const { log_id, startup_id, was_correct, source = 'user' } = req.body || {};

  if (typeof was_correct !== 'boolean') {
    return res.status(400).json({ error: 'was_correct (boolean) required' });
  }
  if (!log_id && !startup_id) {
    return res.status(400).json({ error: 'log_id or startup_id required' });
  }

  try {
    const sb = getClient();

    if (log_id) {
      await intel.labelOutcome(log_id, was_correct, source);
      return res.json({ ok: true, labeled: log_id });
    }

    // Label the most recent log entry for this startup
    const { data } = await sb
      .from('submit_intelligence_log')
      .select('id')
      .eq('startup_id', startup_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.id) {
      return res.status(404).json({ error: 'No log entry found for startup_id' });
    }

    await intel.labelOutcome(data.id, was_correct, source);
    return res.json({ ok: true, labeled: data.id });
  } catch (e) {
    console.error('[submitFeedback] Error:', e);
    return res.status(500).json({ error: 'Failed to label outcome' });
  }
});

// ── GET /api/submit/intelligence ─────────────────────────────────────────────
router.get('/intelligence', async (req, res) => {
  const endpoint = req.query.endpoint || 'instant';
  const hours    = parseInt(req.query.hours || '24', 10);

  try {
    const [stats, topDomains] = await Promise.all([
      intel.getRollingStats(endpoint, hours),
      (async () => {
        const sb = getClient();
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        const { data } = await sb
          .from('submit_intelligence_log')
          .select('domain, resolver_tier, latency_ms, error_code, match_count')
          .eq('endpoint', endpoint)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(500);
        if (!data) return [];
        // Aggregate by domain
        const byDomain = {};
        for (const r of data) {
          if (!r.domain) continue;
          byDomain[r.domain] = byDomain[r.domain] || { domain: r.domain, hits: 0, errors: 0, latencies: [] };
          byDomain[r.domain].hits++;
          if (r.error_code) byDomain[r.domain].errors++;
          if (r.latency_ms) byDomain[r.domain].latencies.push(r.latency_ms);
        }
        return Object.values(byDomain)
          .sort((a, b) => b.hits - a.hits)
          .slice(0, 20)
          .map(d => ({
            domain:       d.domain,
            hits:         d.hits,
            errorRate:    d.hits ? Math.round((d.errors / d.hits) * 100) : 0,
            avgLatencyMs: d.latencies.length
              ? Math.round(d.latencies.reduce((a, b) => a + b, 0) / d.latencies.length)
              : 0,
          }));
      })(),
    ]);

    return res.json({
      stats,
      topDomains,
      endpoint,
      windowHours: hours,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/submit/domain-stats ─────────────────────────────────────────────
router.get('/domain-stats', async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'domain required' });
  try {
    const hint = await intel.getResolverHint(domain);
    return res.json({ domain, ...hint });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/submit/watchdog-status ──────────────────────────────────────────
router.get('/watchdog-status', async (req, res) => {
  try {
    const sb = getClient();
    const { data: recent } = await sb
      .from('submit_watchdog_events')
      .select('probe_url, status, latency_ms, action_taken, created_at, error')
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: summary } = await sb
      .from('submit_watchdog_events')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const total    = summary?.length || 0;
    const failures = (summary || []).filter(r => r.status === 'fail').length;
    const warnings = (summary || []).filter(r => r.status === 'warn').length;

    return res.json({
      last24h: { total, failures, warnings, passes: total - failures - warnings },
      recentProbes: recent || [],
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
