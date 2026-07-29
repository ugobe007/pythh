'use strict';

function clampScore(value, fallback = 0) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function hasValue(value) {
  if (Array.isArray(value)) return value.some(Boolean);
  return value != null && String(value).trim() !== '';
}

function lifecycleScore(fit) {
  switch (fit?.level) {
    case 'exact': return 100;
    case 'compatible': return 82;
    case 'inferred': return 65;
    case 'mismatch': return 0;
    default: return 55;
  }
}

function reachabilityScore(investor = {}) {
  const verifiedEmail = investor.email_status === 'verified' || investor.email_has_mx === true;
  if (verifiedEmail && (investor.email || investor.email_best_guess)) return 100;
  if (investor.email || investor.email_best_guess) return 85;
  if (investor.linkedin_url) return 72;
  if (investor.twitter_url) return 52;
  return 30;
}

function profileScore(investor = {}) {
  const checks = [
    hasValue(investor.name) || hasValue(investor.firm),
    hasValue(investor.sectors),
    hasValue(investor.stage),
    hasValue(investor.check_size_min) || hasValue(investor.check_size_max),
    hasValue(investor.investment_thesis) || hasValue(investor.notable_investments),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function behavioralScore(behavior) {
  if (!behavior || Number(behavior.sample_size || 0) <= 0) return null;
  const measures = [
    behavior.response_rate,
    behavior.follow_through_rate,
    behavior.close_rate,
    behavior.founder_experience_score,
  ].filter((value) => Number.isFinite(Number(value)));
  if (!measures.length) return null;
  return clampScore(measures.reduce((sum, value) => sum + Number(value), 0) / measures.length);
}

/**
 * Investor Fitness is startup-specific. Missing behavioral evidence is excluded
 * rather than treated as poor behavior.
 */
function calculateInvestorFitness(match = {}) {
  const rawInvestor = match.investor ?? match.investors;
  const investor = Array.isArray(rawInvestor) ? rawInvestor[0] || {} : rawInvestor || {};
  const alignment = clampScore(match.match_score, 50);
  const lifecycle = lifecycleScore(match.funding_lifecycle_fit);
  const reachability = reachabilityScore(investor);
  const profile = profileScore(investor);
  const behavior = behavioralScore(match.investor_behavior);
  const behaviorSamples = Number(match.investor_behavior?.sample_size || 0);

  const score = behavior == null
    ? alignment * 0.5 + lifecycle * 0.25 + reachability * 0.15 + profile * 0.1
    : alignment * 0.38 + lifecycle * 0.2 + behavior * 0.25 + reachability * 0.1 + profile * 0.07;

  const confidence = behaviorSamples >= 10
    ? 'high'
    : behaviorSamples >= 3
      ? 'medium'
      : 'building';

  const factors = [
    match.funding_lifecycle_fit?.level === 'exact'
      ? 'Exact funding-stage alignment'
      : match.funding_lifecycle_fit?.level === 'compatible'
        ? 'Compatible funding-stage focus'
        : 'Funding-stage focus inferred',
    reachability >= 85
      ? 'Direct contact path available'
      : reachability >= 70
        ? 'Professional network path available'
        : 'Reachability still being verified',
    behavior == null
      ? 'Behavioral history is still building'
      : `${behaviorSamples} verified outreach outcome${behaviorSamples === 1 ? '' : 's'}`,
  ];

  return {
    score: clampScore(score),
    confidence,
    factors,
    components: {
      alignment,
      lifecycle,
      reachability,
      profile,
      behavior,
    },
    behavior_sample_size: behaviorSamples,
    methodology_version: 'fitness_v1',
  };
}

module.exports = {
  calculateInvestorFitness,
  clampScore,
  lifecycleScore,
  reachabilityScore,
  profileScore,
};
