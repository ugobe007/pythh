'use strict';

const STAGE_ORDER = ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'];

function normalizeFundingStage(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Legacy startup rows use 0=pre-seed, 1=seed, 2=Series A.
    return STAGE_ORDER[Math.max(0, Math.min(STAGE_ORDER.length - 1, value))] || null;
  }

  const token = String(value).toLowerCase().trim().replace(/[_\s]+/g, '-');
  if (/^(idea|angel|friends-and-family|pre-?seed)$/.test(token)) return 'pre-seed';
  if (/^seed(-stage|-round)?$/.test(token)) return 'seed';
  if (/^(series-?a|a)$/.test(token)) return 'series-a';
  if (/^(series-?b|b)$/.test(token)) return 'series-b';
  if (/^(series-?c|c)$/.test(token)) return 'series-c';
  if (/(growth|late|private-equity|buyout)/.test(token)) return 'growth';
  if (/(early|pre-seed-and-seed|preseed-and-seed)/.test(token)) return 'early';
  return null;
}

function getStartupFundingStage(startup = {}) {
  const extracted = startup.extracted_data && typeof startup.extracted_data === 'object'
    ? startup.extracted_data
    : {};
  const candidates = [
    startup.funding_stage,
    extracted.funding_stage,
    extracted.funding_round,
    typeof startup.stage === 'string' ? startup.stage : null,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeFundingStage(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function getInvestorFundingStages(investor = {}) {
  const raw = Array.isArray(investor.stage)
    ? investor.stage
    : investor.stage != null
      ? [investor.stage]
      : [];
  return [...new Set(raw.map(normalizeFundingStage).filter(Boolean))];
}

function isImplicitEarlyInvestor(investor = {}) {
  const type = `${investor.type || ''} ${investor.capital_type || ''}`.toLowerCase();
  if (investor.is_individual === true) return true;
  if (/(angel|scout|accelerator|incubator|pre.?seed|seed)/.test(type)) return true;
  const maxCheck = Number(investor.check_size_max) || 0;
  return maxCheck > 0 && maxCheck <= 2_500_000;
}

/**
 * Exact stage is required when an investor publishes a specific lifecycle.
 * Unspecified angel/seed investors remain eligible as a lower-confidence fallback.
 */
function evaluateFundingLifecycleFit(startup, investor = {}) {
  const startupStage = getStartupFundingStage(startup);
  const investorStages = getInvestorFundingStages(investor);

  if (!startupStage) {
    return { eligible: true, level: 'unknown', startupStage: null, investorStages, delta: 0 };
  }

  if (investorStages.includes(startupStage)) {
    return { eligible: true, level: 'exact', startupStage, investorStages, delta: 15 };
  }

  if (
    (startupStage === 'pre-seed' || startupStage === 'seed') &&
    investorStages.includes('early')
  ) {
    return { eligible: true, level: 'compatible', startupStage, investorStages, delta: 7 };
  }

  if (investorStages.length === 0 && isImplicitEarlyInvestor(investor)) {
    const early = startupStage === 'pre-seed' || startupStage === 'seed';
    return {
      eligible: early,
      level: early ? 'inferred' : 'mismatch',
      startupStage,
      investorStages,
      delta: early ? 3 : -25,
    };
  }

  return {
    eligible: false,
    level: 'mismatch',
    startupStage,
    investorStages,
    delta: -25,
  };
}

function filterAndRankByFundingLifecycle(matches, startup) {
  if (!Array.isArray(matches)) return [];
  return matches
    .map((match, index) => {
      const raw = match?.investor ?? match?.investors;
      const investor = Array.isArray(raw) ? raw[0] : raw;
      return { match, fit: evaluateFundingLifecycleFit(startup, investor || {}), index };
    })
    .filter(({ fit }) => fit.eligible)
    .sort((a, b) => {
      const levelRank = { exact: 3, compatible: 2, inferred: 1, unknown: 0 };
      return (levelRank[b.fit.level] || 0) - (levelRank[a.fit.level] || 0) || a.index - b.index;
    })
    .map(({ match, fit }) => ({
      ...match,
      funding_lifecycle_fit: fit,
    }));
}

module.exports = {
  STAGE_ORDER,
  normalizeFundingStage,
  getStartupFundingStage,
  getInvestorFundingStages,
  evaluateFundingLifecycleFit,
  filterAndRankByFundingLifecycle,
};
