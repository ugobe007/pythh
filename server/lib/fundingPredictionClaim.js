'use strict';

const DEFAULT_TARGET_RATE = 0.85;
const DEFAULT_MIN_SAMPLE = 100;

function wilsonInterval(successes, total, z = 1.959963984540054) {
  const n = Number(total);
  const hits = Number(successes);
  if (!Number.isFinite(n) || !Number.isFinite(hits) || n <= 0 || hits < 0 || hits > n) {
    return { lower: null, upper: null };
  }
  const rate = hits / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (rate + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((rate * (1 - rate) + z2 / (4 * n)) / n)) / denominator;
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

function buildClaimReadiness({
  confirmedHits = 0,
  confirmedMisses = 0,
  indeterminate = 0,
  targetRate = DEFAULT_TARGET_RATE,
  minimumAuditedOutcomes = DEFAULT_MIN_SAMPLE,
} = {}) {
  const auditedOutcomes = confirmedHits + confirmedMisses;
  const observedRate = auditedOutcomes ? confirmedHits / auditedOutcomes : null;
  const confidence95 = wilsonInterval(confirmedHits, auditedOutcomes);
  const blockers = [];
  if (auditedOutcomes < minimumAuditedOutcomes) {
    blockers.push(`needs_${minimumAuditedOutcomes - auditedOutcomes}_more_audited_outcomes`);
  }
  if (observedRate == null) blockers.push('no_audited_outcomes');
  else if (observedRate < targetRate) blockers.push('observed_rate_below_target');
  if (confidence95.lower == null || confidence95.lower < targetRate) {
    blockers.push('confidence_lower_bound_below_target');
  }
  if (indeterminate > 0) blockers.push('funded_outcomes_still_indeterminate');
  return {
    metric: 'startup_level_hit_at_5_among_audited_funded_startups',
    definition: 'A hit means at least one of five investors predicted before the round is proven to have participated. A miss requires a complete or explicitly audited participant list.',
    target_rate: targetRate,
    minimum_audited_outcomes: minimumAuditedOutcomes,
    confirmed_hits: confirmedHits,
    confirmed_misses: confirmedMisses,
    audited_outcomes: auditedOutcomes,
    indeterminate_funded_outcomes: indeterminate,
    observed_rate: observedRate,
    confidence_95: confidence95,
    claim_ready: blockers.length === 0,
    blockers,
  };
}

module.exports = {
  DEFAULT_TARGET_RATE,
  DEFAULT_MIN_SAMPLE,
  wilsonInterval,
  buildClaimReadiness,
};
