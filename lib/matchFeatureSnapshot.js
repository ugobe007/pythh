'use strict';

/**
 * Immutable feature snapshot for startup_investor_matches at generation time.
 * Used for ML labels, drift analysis, and time-split evaluation (match age vs current profile).
 */

const SNAPSHOT_VERSION = 1;

function num(n, fallback = null) {
  if (n == null || n === '') return fallback;
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * @param {object} opts
 * @param {string} opts.engine - e.g. instant_submit_phase1, instant_submit_phase3, queue_v16, investor_matching_ai
 * @param {string} [opts.phase] - optional sub-phase label
 * @param {object} opts.startup - subset of startup_uploads + GOD scores
 * @param {object} opts.investor - subset of investors row
 * @param {object} [opts.extra] - merged into root (e.g. signal_total)
 */
function buildMatchFeatureSnapshot({ engine, phase, startup, investor, extra = {} }) {
  const s = startup || {};
  const inv = investor || {};

  const startupOut = {
    id: s.id != null ? String(s.id) : null,
    sectors: Array.isArray(s.sectors) ? s.sectors.slice(0, 16) : [],
    stage: num(s.stage, null),
    total_god_score: num(s.total_god_score, null),
    team_score: num(s.team_score, null),
    traction_score: num(s.traction_score, null),
    market_score: num(s.market_score, null),
    product_score: num(s.product_score, null),
    vision_score: num(s.vision_score, null),
    maturity_level: s.maturity_level != null ? String(s.maturity_level) : null,
    data_completeness: num(s.data_completeness, null),
    has_revenue: !!s.has_revenue,
    has_customers: !!s.has_customers,
    is_launched: !!s.is_launched,
    mrr: num(s.mrr, null),
    arr: num(s.arr, null),
    customer_count: num(s.customer_count, null),
    growth_rate_monthly: num(s.growth_rate_monthly, null),
  };

  const investorOut = {
    id: inv.id != null ? String(inv.id) : null,
    sectors: Array.isArray(inv.sectors) ? inv.sectors.slice(0, 16) : [],
    stage: Array.isArray(inv.stage) ? inv.stage.slice(0, 16) : [],
    check_size_min: num(inv.check_size_min, null),
    check_size_max: num(inv.check_size_max, null),
    geography_focus: Array.isArray(inv.geography_focus) ? inv.geography_focus.slice(0, 12) : [],
    investor_score: num(inv.investor_score, null),
    investor_tier: inv.investor_tier != null ? String(inv.investor_tier) : null,
  };

  return {
    v: SNAPSHOT_VERSION,
    captured_at: new Date().toISOString(),
    engine: String(engine || 'unknown'),
    phase: phase != null ? String(phase) : null,
    startup: startupOut,
    investor: investorOut,
    ...extra,
  };
}

/**
 * Fixed-length numeric vector for simple linear / logistic models (order is stable).
 * Hash sectors as count + first sector length; for richer models use embeddings.
 */
function featureVectorFromSnapshot(snapshot, matchScore) {
  const s = snapshot?.startup || {};
  const inv = snapshot?.investor || {};
  const ms = num(matchScore, 0) / 100;
  return [
    1, // bias
    ms,
    num(s.total_god_score, 50) / 100,
    num(s.stage, 1) / 10,
    Math.min((s.sectors || []).length / 10, 1),
    num(s.team_score, 0) / 100,
    num(s.traction_score, 0) / 100,
    num(s.market_score, 0) / 100,
    num(s.product_score, 0) / 100,
    num(s.vision_score, 0) / 100,
    num(s.data_completeness, 0) / 100,
    s.has_revenue ? 1 : 0,
    s.has_customers ? 1 : 0,
    s.is_launched ? 1 : 0,
    Math.min(num(s.mrr, 0) / 1e7, 1),
    Math.min(num(s.arr, 0) / 1e8, 1),
    Math.min(num(s.customer_count, 0) / 5000, 1),
    num(inv.investor_score, 0) / 100,
    Math.min((inv.sectors || []).length / 10, 1),
    Math.min((inv.stage || []).length / 10, 1),
    Math.min(num(inv.check_size_min, 0) / 1e8, 1),
    Math.min(num(inv.check_size_max, 0) / 1e9, 1),
    typeof snapshot?.signal_total === 'number' ? Math.min(snapshot.signal_total / 10, 1) : 0,
  ];
}

const FEATURE_NAMES = [
  'bias',
  'match_score',
  'god_total',
  'stage',
  'sector_count',
  'team',
  'traction',
  'market',
  'product',
  'vision',
  'data_completeness',
  'has_revenue',
  'has_customers',
  'is_launched',
  'mrr_norm',
  'arr_norm',
  'customers_norm',
  'investor_score',
  'inv_sector_count',
  'inv_stage_count',
  'check_min_norm',
  'check_max_norm',
  'signal_total_norm',
];

module.exports = {
  SNAPSHOT_VERSION,
  buildMatchFeatureSnapshot,
  featureVectorFromSnapshot,
  FEATURE_NAMES,
};
