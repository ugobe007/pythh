'use strict';

const crypto = require('node:crypto');

const MODEL_VERSION = 'capital-graph-shadow-v1';
const FEATURE_SCHEMA_VERSION = 'outcome-evidence-v1';
const MIN_OUTCOMES_FOR_SCORE = 3;
const MAX_MATCHES_PER_IMPRESSION = 20;
const STARTUP_COOLDOWN_MS = 15 * 60 * 1000;
const recentStartups = new Map();

const OUTCOME_VALUE = Object.freeze({
  explanation_opened: 0.15,
  saved: 0.25,
  outreach_sent: 0.3,
  email_bounced: 0,
  replied: 0.6,
  meeting_booked: 0.8,
  passed: 0,
  diligence: 0.9,
  term_sheet: 0.97,
  funded: 1,
});

function isShadowEnabled(env = process.env) {
  return String(env.CAPITAL_GRAPH_SHADOW_ENABLED || '').toLowerCase() === 'true';
}

function computeOutcomeGraphScore(outcomes = []) {
  const usable = outcomes.filter((row) => row?.verified && Object.hasOwn(OUTCOME_VALUE, row?.outcome_type));
  if (usable.length < MIN_OUTCOMES_FOR_SCORE) {
    return { graphScore: null, evidenceCount: usable.length, reason: 'insufficient_verified_outcome_evidence' };
  }
  const priorStrength = 3;
  const priorMean = 0.5;
  const observedValue = usable.reduce((sum, row) => sum + OUTCOME_VALUE[row.outcome_type], 0);
  const score = ((priorStrength * priorMean + observedValue) / (priorStrength + usable.length)) * 100;
  return { graphScore: Math.round(score * 100) / 100, evidenceCount: usable.length, reason: 'verified_outcome_evidence' };
}

function normalizeServedMatches(matches = []) {
  return matches.map((match, index) => ({
    investorId: match?.investor_id || match?.investors?.id || match?.investor?.id || null,
    semanticScore: Number(match?.match_score),
    rankPosition: index + 1,
  })).filter((match) => match.investorId && Number.isFinite(match.semanticScore)).slice(0, MAX_MATCHES_PER_IMPRESSION);
}

function shouldSample(startupId, env = process.env, now = Date.now(), random = Math.random) {
  if (!isShadowEnabled(env) || !startupId) return false;
  const rate = Math.max(0, Math.min(1, Number(env.CAPITAL_GRAPH_SHADOW_SAMPLE_RATE || 0.1)));
  if (rate === 0 || random() > rate) return false;
  const previous = recentStartups.get(startupId) || 0;
  if (now - previous < STARTUP_COOLDOWN_MS) return false;
  recentStartups.set(startupId, now);
  return true;
}

async function captureShadowImpression({ supabase, startupId, matches, requestId, endpoint, cacheStatus }) {
  const served = normalizeServedMatches(matches);
  if (!served.length) return { captured: 0 };
  const investorIds = served.map((match) => match.investorId);
  const { data: outcomes, error: outcomeError } = await supabase.from('match_outcomes')
    .select('investor_id, outcome_type, verified, occurred_at').in('investor_id', investorIds)
    .eq('verified', true).order('occurred_at', { ascending: false }).limit(1000);
  if (outcomeError) throw new Error(`shadow outcome read failed: ${outcomeError.message}`);

  const outcomesByInvestor = new Map();
  for (const outcome of outcomes || []) {
    const rows = outcomesByInvestor.get(outcome.investor_id) || [];
    rows.push(outcome);
    outcomesByInvestor.set(outcome.investor_id, rows);
  }
  const computedAt = new Date().toISOString();
  const sessionId = crypto.randomUUID();
  const features = served.map((match) => ({ ...match, ...computeOutcomeGraphScore(outcomesByInvestor.get(match.investorId) || []) }));
  const snapshotRows = features.map((feature) => ({
    startup_id: startupId, investor_id: feature.investorId, model_version: MODEL_VERSION,
    feature_schema_version: FEATURE_SCHEMA_VERSION, semantic_score: feature.semanticScore,
    graph_score: feature.graphScore,
    final_score: feature.graphScore == null ? feature.semanticScore : Math.round((feature.semanticScore * 0.8 + feature.graphScore * 0.2) * 100) / 100,
    feature_values: { outcome_evidence_count: feature.evidenceCount, graph_score_reason: feature.reason, live_rank_position: feature.rankPosition },
    computed_at: computedAt,
  }));
  const { error: snapshotError } = await supabase.from('match_feature_snapshots').insert(snapshotRows);
  if (snapshotError) throw new Error(`shadow snapshot write failed: ${snapshotError.message}`);
  const impressionRows = features.map((feature) => ({
    startup_id: startupId, investor_id: feature.investorId, session_id: sessionId,
    model_version: MODEL_VERSION, rank_position: feature.rankPosition, selection_probability: 1,
    score: feature.semanticScore / 100,
    context: { endpoint, request_id: requestId || null, cache_status: cacheStatus || null, policy: 'live_rank_unchanged' },
    shown_at: computedAt,
  }));
  const { error: impressionError } = await supabase.from('ranking_impressions').insert(impressionRows);
  if (impressionError) throw new Error(`shadow impression write failed: ${impressionError.message}`);
  return { captured: features.length, sessionId };
}

function scheduleShadowImpression(input, { env = process.env, log = console } = {}) {
  if (!shouldSample(input?.startupId, env)) return false;
  setImmediate(() => captureShadowImpression(input).catch((error) => log.warn?.('[capital-graph-shadow] capture failed:', error.message)));
  return true;
}

module.exports = { FEATURE_SCHEMA_VERSION, MAX_MATCHES_PER_IMPRESSION, MODEL_VERSION, captureShadowImpression, computeOutcomeGraphScore, isShadowEnabled, normalizeServedMatches, scheduleShadowImpression, shouldSample };
