'use strict';

/**
 * Submit URL Intelligence Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Logs every URL submission outcome, learns resolver patterns per domain,
 * and provides ML-informed hints to improve resolution on the next attempt.
 *
 * Tables used:
 *   submit_intelligence_log   — per-request outcome record
 *   domain_resolver_stats     — aggregated ML weights per domain
 *
 * Usage (fire-and-forget, never blocks the hot path):
 *   const intel = require('./submitUrlIntelligence');
 *   intel.log({ url, domain, endpoint, resolverTier, startupId, isNew, latencyMs, matchCount, ... });
 *   const hint = await intel.getResolverHint(domain);
 */

const { createClient } = require('@supabase/supabase-js');

// ── Supabase client (service role so we can write without RLS) ───────────────
function getClient() {
  const url  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_KEY
            || process.env.SUPABASE_SERVICE_ROLE_KEY
            || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTld(domain) {
  const parts = domain.split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : domain;
}

function extractRootDomain(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const parts = u.hostname.replace(/^www\./, '').split('.');
    return parts.slice(-2).join('.');
  } catch {
    return url.replace(/^www\./, '').split('/')[0];
  }
}

// Build a lightweight feature vector for ML export
function buildFeatures({ url, domain, endpoint, resolverTier, isNew, latencyMs, matchCount, godScore, dataCompleteness }) {
  const tld = extractTld(domain);
  return {
    tld,
    is_new: isNew ? 1 : 0,
    endpoint_instant: endpoint === 'instant' ? 1 : 0,
    tier_exact:   resolverTier === 'exact'   ? 1 : 0,
    tier_rpc:     resolverTier === 'rpc'     ? 1 : 0,
    tier_fuzzy:   resolverTier === 'fuzzy'   ? 1 : 0,
    tier_new:     resolverTier === 'new'     ? 1 : 0,
    latency_ms:   latencyMs   || 0,
    match_count:  matchCount  || 0,
    god_score:    godScore     || 0,
    data_completeness: dataCompleteness || 0,
    url_has_path: (url || '').replace(/https?:\/\/[^/]+/, '').length > 1 ? 1 : 0,
    url_has_www:  /^https?:\/\/www\./i.test(url) ? 1 : 0,
  };
}

// ── Core log function (fire-and-forget) ───────────────────────────────────────

/**
 * Log one URL submission outcome.
 * Call this at the END of every submit handler after the response is built.
 *
 * @param {object} p
 * @param {string}  p.url
 * @param {string}  p.domain           - root domain (e.g. 'stripe.com')
 * @param {string}  p.endpoint         - 'instant' | 'discovery'
 * @param {string}  [p.resolverTier]   - 'exact' | 'rpc' | 'fuzzy' | 'new'
 * @param {string}  [p.startupId]
 * @param {boolean} [p.isNew]
 * @param {number}  [p.latencyMs]
 * @param {number}  [p.matchCount]
 * @param {number}  [p.godScore]
 * @param {number}  [p.dataCompleteness]
 * @param {string}  [p.errorCode]
 * @param {string}  [p.errorMsg]
 */
async function log(p) {
  try {
    const sb = getClient();
    if (!sb) return;

    const domain = p.domain || extractRootDomain(p.url || '');
    const tld    = extractTld(domain);
    const record = {
      url:              p.url,
      domain,
      tld,
      url_normalized:   p.urlNormalized || null,
      endpoint:         p.endpoint,
      resolver_tier:    p.resolverTier  || null,
      startup_id:       p.startupId     || null,
      is_new:           p.isNew         ?? false,
      latency_ms:       p.latencyMs     || null,
      match_count:      p.matchCount    || 0,
      god_score:        p.godScore      || null,
      data_completeness:p.dataCompleteness || null,
      error_code:       p.errorCode     || null,
      error_msg:        p.errorMsg      || null,
      features:         buildFeatures({ ...p, domain, tld }),
    };

    // Write log row (non-blocking)
    sb.from('submit_intelligence_log').insert([record]).then(({ error }) => {
      if (error) console.warn('[intel] log insert error:', error.message);
    });

    // Update aggregated domain stats (non-blocking)
    updateDomainStats(sb, domain, tld, p).catch(() => {});

  } catch (e) {
    console.warn('[intel] log() threw:', e.message);
  }
}

// ── Domain resolver stats (online learning) ───────────────────────────────────

async function updateDomainStats(sb, domain, tld, p) {
  const isSuccess = !p.errorCode && (p.startupId || p.isNew);
  const tier = p.resolverTier || 'unknown';

  // Upsert into domain_resolver_stats with EMA (α = 0.3)
  const { data: existing } = await sb
    .from('domain_resolver_stats')
    .select('*')
    .eq('domain_pattern', domain)
    .maybeSingle();

  const EMA_ALPHA = 0.3;

  if (existing) {
    const newAttempts  = existing.attempts + 1;
    const newSuccesses = existing.successes + (isSuccess ? 1 : 0);
    const newLatency   = existing.avg_latency_ms
      ? (1 - EMA_ALPHA) * existing.avg_latency_ms + EMA_ALPHA * (p.latencyMs || 0)
      : (p.latencyMs || 0);

    // Update tier weights map
    const weights = existing.tier_weights || {};
    weights[tier] = weights[tier] != null
      ? (1 - EMA_ALPHA) * weights[tier] + EMA_ALPHA * (isSuccess ? 1 : 0)
      : (isSuccess ? 1 : 0);
    const bestTier = Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0];

    await sb.from('domain_resolver_stats').update({
      attempts:       newAttempts,
      successes:      newSuccesses,
      avg_latency_ms: newLatency,
      tier_weights:   weights,
      best_tier:      bestTier,
      last_seen:      new Date().toISOString(),
      last_outcome:   isSuccess ? 'success' : 'failure',
      updated_at:     new Date().toISOString(),
    }).eq('domain_pattern', domain);
  } else {
    const weights = { [tier]: isSuccess ? 1 : 0 };
    await sb.from('domain_resolver_stats').insert([{
      domain_pattern: domain,
      tld,
      attempts:       1,
      successes:      isSuccess ? 1 : 0,
      avg_latency_ms: p.latencyMs || 0,
      tier_weights:   weights,
      best_tier:      tier,
      last_seen:      new Date().toISOString(),
      last_outcome:   isSuccess ? 'success' : 'failure',
    }]);
  }
}

// ── Resolver hint (used before resolution to pick best tier first) ─────────────

/**
 * Returns ML-informed hints for how to resolve this domain.
 * Call this BEFORE running the resolver to optionally reorder tiers.
 *
 * @param {string} domain - root domain, e.g. 'stripe.com'
 * @returns {Promise<{ bestTier: string|null, avgLatencyMs: number, successRate: number, tierWeights: object }>}
 */
async function getResolverHint(domain) {
  const defaults = { bestTier: null, avgLatencyMs: 0, successRate: 0, tierWeights: {} };
  try {
    const sb = getClient();
    if (!sb) return defaults;
    const { data } = await sb
      .from('domain_resolver_stats')
      .select('best_tier, avg_latency_ms, attempts, successes, tier_weights')
      .eq('domain_pattern', domain)
      .maybeSingle();
    if (!data) return defaults;
    return {
      bestTier:     data.best_tier,
      avgLatencyMs: Math.round(data.avg_latency_ms || 0),
      successRate:  data.attempts > 0 ? Math.round((data.successes / data.attempts) * 100) : 0,
      tierWeights:  data.tier_weights || {},
    };
  } catch {
    return defaults;
  }
}

// ── Accuracy label (set by user feedback or watchdog) ────────────────────────

/**
 * Label a previous log entry as correct or incorrect.
 * Called by the feedback endpoint and the watchdog.
 *
 * @param {string} logId - submit_intelligence_log.id
 * @param {boolean} wasCorrect
 * @param {string} source - 'user' | 'watchdog' | 'auto'
 */
async function labelOutcome(logId, wasCorrect, source = 'auto') {
  try {
    const sb = getClient();
    if (!sb) return;
    await sb.from('submit_intelligence_log').update({
      was_correct:     wasCorrect,
      feedback_at:     new Date().toISOString(),
      feedback_source: source,
    }).eq('id', logId);
  } catch (e) {
    console.warn('[intel] labelOutcome error:', e.message);
  }
}

// ── Stats query (used by health check and watchdog) ───────────────────────────

/**
 * Returns rolling 24h error rate and P95 latency for a given endpoint.
 */
async function getRollingStats(endpoint = 'instant', hours = 24) {
  const sb = getClient();
  if (!sb) return null;
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from('submit_intelligence_log')
      .select('latency_ms, error_code, is_new')
      .eq('endpoint', endpoint)
      .gte('created_at', since);

    if (!data || data.length === 0) return null;

    const total   = data.length;
    const errors  = data.filter(r => r.error_code).length;
    const latencies = data.map(r => r.latency_ms || 0).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const newPct = Math.round((data.filter(r => r.is_new).length / total) * 100);

    return {
      endpoint,
      windowHours: hours,
      total,
      errorRate:  Math.round((errors / total) * 100),
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      newUrlPct:  newPct,
    };
  } catch (e) {
    console.warn('[intel] getRollingStats error:', e.message);
    return null;
  }
}

module.exports = { log, getResolverHint, labelOutcome, getRollingStats };
