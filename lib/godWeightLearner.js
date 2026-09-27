'use strict';

/**
 * Sidebar learner for startup GOD component shares.
 *
 * Training rows are funded rounds (positive evidence only): the aspects cited
 * when an investor wrote a check. Each aspect maps to a GOD component. The
 * learner steps the live weights toward that mix by at most 2 percentage
 * points, keeps every share at or above 8%, and holds vision (no investment
 * aspect maps to it). This is not a GOD formula rewrite and it does not use
 * unfunded startups as negatives.
 */

const COMPONENTS = ['team', 'traction', 'market', 'product', 'vision'];
const MIN_OBSERVATIONS = 30;
const MAX_STEP = 0.02;
const MIN_WEIGHT = 0.08;
const MAX_L1 = 0.05;

const ASPECT_COMPONENT = {
  hiring: 'team',
  board: 'team',
  revenue_growth: 'traction',
  customer_growth: 'traction',
  product_market_fit: 'traction',
  partners: 'market',
  customer_access_partnership: 'market',
  unique_tech: 'product',
  product_rev: 'product',
};

const PRIORITY_COMPONENT = {
  hire: 'team',
  revenue: 'traction',
  customers: 'traction',
  product: 'product',
};

function emptyCounts() {
  return { team: 0, traction: 0, market: 0, product: 0, vision: 0 };
}

function addCount(counts, component, n) {
  if (!component || !COMPONENTS.includes(component)) return 0;
  const amount = Number(n) || 0;
  if (amount <= 0) return 0;
  counts[component] += amount;
  return amount;
}

/**
 * @param {Array<{ aspect_counts?: object, priorities?: string[] }>} models
 */
function tallyInvestmentEvidence(models) {
  const counts = emptyCounts();
  let observations = 0;
  let investors = 0;
  for (const model of Array.isArray(models) ? models : []) {
    if (!model) continue;
    investors += 1;
    const aspects = model.aspect_counts && typeof model.aspect_counts === 'object' ? model.aspect_counts : {};
    let usedAspect = false;
    for (const [aspect, count] of Object.entries(aspects)) {
      const added = addCount(counts, ASPECT_COMPONENT[aspect], count);
      if (added) {
        observations += added;
        usedAspect = true;
      }
    }
    if (usedAspect) continue;
    for (const priority of model.priorities || []) {
      observations += addCount(counts, PRIORITY_COMPONENT[priority], 1);
    }
  }
  return { counts, observations, investors };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function sumWeights(weights) {
  return COMPONENTS.reduce((total, key) => total + (Number(weights[key]) || 0), 0);
}

function fitSum(weights, base) {
  const next = { ...weights, vision: base.vision };
  let drift = COMPONENTS.reduce((total, key) => total + next[key], 0) - 1;
  const order = COMPONENTS.filter((key) => key !== 'vision');
  for (const key of order) {
    if (Math.abs(drift) < 1e-9) break;
    const ceiling = base[key] + MAX_STEP;
    const floor = Math.max(MIN_WEIGHT, base[key] - MAX_STEP);
    if (drift > 0) {
      const cut = Math.min(drift, next[key] - floor);
      next[key] -= cut;
      drift -= cut;
    } else {
      const add = Math.min(-drift, ceiling - next[key]);
      next[key] += add;
      drift += add;
    }
  }
  return next;
}

/**
 * @param {object} current
 * @param {{ counts: object, observations: number }} evidence
 */
function learnComponentWeights(current, evidence) {
  const base = {};
  for (const key of COMPONENTS) base[key] = Number(current?.[key]) || 0;
  const observations = Number(evidence?.observations) || 0;
  if (observations < MIN_OBSERVATIONS) {
    return {
      weights: base,
      moved: false,
      reason: 'not_enough_observations',
      observations,
      counts: evidence?.counts || emptyCounts(),
    };
  }

  const counts = evidence.counts || emptyCounts();
  const evidenceTotal = COMPONENTS
    .filter((key) => key !== 'vision')
    .reduce((total, key) => total + (Number(counts[key]) || 0), 0);
  const room = Math.max(0, 1 - base.vision);
  const target = { vision: base.vision };
  for (const key of COMPONENTS) {
    if (key === 'vision') continue;
    target[key] = evidenceTotal > 0 ? ((Number(counts[key]) || 0) / evidenceTotal) * room : base[key];
  }

  const stepped = { vision: base.vision };
  for (const key of COMPONENTS) {
    if (key === 'vision') continue;
    const delta = target[key] - base[key];
    const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, delta));
    stepped[key] = Math.max(MIN_WEIGHT, base[key] + step);
  }
  let next = fitSum(stepped, base);

  const l1 = COMPONENTS.reduce((total, key) => total + Math.abs(next[key] - base[key]), 0);
  if (l1 > MAX_L1) {
    const scale = MAX_L1 / l1;
    const capped = { vision: base.vision };
    for (const key of COMPONENTS) {
      if (key === 'vision') continue;
      capped[key] = base[key] + (next[key] - base[key]) * scale;
    }
    next = fitSum(capped, base);
  }

  const rounded = {};
  for (const key of COMPONENTS) rounded[key] = round4(next[key]);
  const drift = round4(sumWeights(rounded) - 1);
  rounded.traction = round4(rounded.traction - drift);

  const moved = COMPONENTS.some((key) => Math.abs(rounded[key] - base[key]) >= 0.001);
  return {
    weights: rounded,
    moved,
    reason: moved ? 'stepped_toward_funded_rounds' : 'already_aligned',
    observations,
    counts,
    target: Object.fromEntries(COMPONENTS.map((key) => [key, round4(target[key])])),
  };
}

module.exports = {
  COMPONENTS,
  ASPECT_COMPONENT,
  MIN_OBSERVATIONS,
  tallyInvestmentEvidence,
  learnComponentWeights,
};
