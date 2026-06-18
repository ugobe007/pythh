/**
 * Stage-based post-money valuation bands for portfolio entry estimates.
 * GOD 70 → floor of band; GOD 100 → ceiling (stronger picks mark higher in-range).
 *
 * Bands (USD):
 *   Pre-seed  $5M – $15M
 *   Seed      $10M – $20M
 *   Series A  $30M – $40M
 *   Series B  $50M – $100M
 *   Mezzanine $75M – $125M  (between B and C)
 *   Series C  $100M – $200M
 *
 * Fallback only — prefer timed rounds from fundingTimelineService when available.
 */

const STAGE_VALUATION_RANGES = {
  'pre-seed': [5_000_000, 15_000_000],
  seed: [10_000_000, 20_000_000],
  'series a': [30_000_000, 40_000_000],
  'series b': [50_000_000, 100_000_000],
  mezzanine: [75_000_000, 125_000_000],
  'series c': [100_000_000, 200_000_000],
};

const STAGE_ALIASES = {
  1: 'pre-seed',
  'stage 1': 'pre-seed',
  'pre-seed': 'pre-seed',
  preseed: 'pre-seed',
  'pre seed': 'pre-seed',
  2: 'seed',
  'stage 2': 'seed',
  seed: 'seed',
  3: 'series a',
  'stage 3': 'series a',
  'series a': 'series a',
  4: 'series b',
  'stage 4': 'series b',
  'series b': 'series b',
  'series b+': 'series b',
  mezzanine: 'mezzanine',
  'mezz round': 'mezzanine',
  5: 'series c',
  'stage 5': 'series c',
  'series c': 'series c',
  'series c+': 'series c',
};

function normalizeStage(stage) {
  const raw = String(stage ?? '').trim().toLowerCase();
  if (!raw) return 'pre-seed';
  return STAGE_ALIASES[raw] || (STAGE_VALUATION_RANGES[raw] ? raw : 'pre-seed');
}

/**
 * @param {string|number|null} stage
 * @param {number} [godScore=70]
 * @returns {number} post-money USD
 */
function estimateEntryValuationUsd(stage, godScore = 70) {
  const key = normalizeStage(stage);
  const [min, max] = STAGE_VALUATION_RANGES[key] || STAGE_VALUATION_RANGES['pre-seed'];
  const score = Number(godScore) || 70;
  const t = Math.min(1, Math.max(0, (score - 70) / 30));
  return Math.round(min + t * (max - min));
}

/** Midpoint per normalized stage (for display / legacy maps). */
function stageValuationMidpoints() {
  const out = {};
  for (const [stage, [min, max]] of Object.entries(STAGE_VALUATION_RANGES)) {
    out[stage] = Math.round((min + max) / 2);
  }
  return out;
}

/** Median primary-round dilution (ownership sold) by stage — for post-money inference. */
const TYPICAL_ROUND_DILUTION = {
  'pre-seed': 0.12,
  seed: 0.18,
  'series a': 0.2,
  'series b': 0.16,
  mezzanine: 0.1,
  'series c': 0.1,
};

const ROUND_TYPE_TO_STAGE = {
  'pre-seed': 'pre-seed',
  seed: 'seed',
  'series-a': 'series a',
  'series-b': 'series b',
  mezzanine: 'mezzanine',
  'series-c': 'series c',
  growth: 'series c',
  'late-stage': 'series c',
};

function roundTypeToStageKey(roundType) {
  const raw = String(roundType ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (ROUND_TYPE_TO_STAGE[raw]) return ROUND_TYPE_TO_STAGE[raw];
  const m = raw.match(/series-?([a-e])/);
  if (m) {
    const letter = m[1];
    if (letter === 'a') return 'series a';
    if (letter === 'b') return 'series b';
    return 'series c';
  }
  if (raw.includes('pre') && raw.includes('seed')) return 'pre-seed';
  if (raw.includes('seed')) return 'seed';
  if (raw.includes('mezz')) return 'mezzanine';
  if (raw.includes('extension')) return 'series a';
  return 'seed';
}

function isExtensionRound(roundType, headline = '') {
  const text = `${roundType || ''} ${headline || ''}`.toLowerCase();
  return /\bextension\b|\btop[- ]?up\b|\badd[- ]?on\b|\banother\b|\badditional\b/i.test(text);
}

/**
 * Estimate post-money when press reports raise size but not valuation.
 * Uses typical dilution by stage; does not cap mega-rounds to stage bands.
 *
 * @param {object} p
 * @param {string} [p.roundType]
 * @param {number} [p.amountUsd]
 * @param {number} [p.preMoneyUsd]
 * @param {number} [p.postMoneyUsd]
 * @param {string} [p.headline]
 * @param {number} [p.totalRaisedUsd] cumulative "total funding" from headline
 * @returns {number|null}
 */
function estimatePostMoneyFromRound({
  roundType,
  amountUsd,
  preMoneyUsd,
  postMoneyUsd,
  headline,
  totalRaisedUsd,
} = {}) {
  const post = Number(postMoneyUsd);
  if (post > 0 && post <= 15_000_000_000) return Math.round(post);

  const pre = Number(preMoneyUsd);
  const amt = Number(amountUsd);
  if (pre > 0 && amt > 0) return Math.round(pre + amt);

  if (!(amt > 0)) {
    const total = Number(totalRaisedUsd);
    if (total > 0 && total <= 15_000_000_000) return Math.round(total * 1.35);
    return null;
  }

  const stageKey = roundTypeToStageKey(roundType);
  const [bandMin, bandMax] = STAGE_VALUATION_RANGES[stageKey] || STAGE_VALUATION_RANGES.seed;
  let dilution = TYPICAL_ROUND_DILUTION[stageKey] || 0.18;
  if (isExtensionRound(roundType, headline)) dilution *= 0.55;

  const implied = Math.round(amt / dilution);
  const total = Number(totalRaisedUsd);

  // Mega-round: dilution model; lift using cumulative funding when reported.
  if (amt >= bandMax || implied >= bandMax * 2) {
    let est = implied;
    if (total > 0) est = Math.round(Math.max(est, total * 1.15));
    return Math.min(est, 15_000_000_000);
  }

  // Typical round: dilution estimate, floored at stage band, soft-capped above band.
  const softCap = Math.round(bandMax * 2.5);
  let est = Math.max(bandMin, Math.min(implied, softCap));
  if (total > est && total <= 15_000_000_000) {
    est = Math.round(Math.max(est, total * 1.15));
  }
  return est;
}

module.exports = {
  STAGE_VALUATION_RANGES,
  TYPICAL_ROUND_DILUTION,
  normalizeStage,
  estimateEntryValuationUsd,
  stageValuationMidpoints,
  roundTypeToStageKey,
  estimatePostMoneyFromRound,
};
