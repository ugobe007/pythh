'use strict';

/**
 * Stage-aware investor fit — prioritize angels/seed VCs for early startups
 * and growth/large-check investors for later-stage companies.
 */

const { isPartnerAngelInvestor } = require('./partnerAngelInvestors');

const EARLY_STAGE_RE = /^(preseed|pre-seed|seed|angel|idea|incubator|accelerator)/;
const MID_STAGE_RE = /^(seriesa|series-a|a)$/;
const LATE_STAGE_RE = /^(seriesb|series-b|seriesc|series-c|seriesd|growth|late|expansion|pe|buyout)/;

const EARLY_TYPES = ['angel', 'individual', 'accelerator', 'incubator', 'scout'];
const LATE_TYPES = ['pe', 'private equity', 'growth equity', 'buyout', 'late stage'];

function normStageToken(value) {
  if (value == null) return '';
  return String(value).toLowerCase().trim().replace(/[-_\s]/g, '');
}

/**
 * @param {number|string|null|undefined} stage - startup stage (numeric 0-5 or string)
 * @returns {'early'|'mid'|'late'|'unknown'}
 */
function getStartupStageBand(stage) {
  if (typeof stage === 'number' && Number.isFinite(stage)) {
    if (stage <= 1) return 'early';
    if (stage === 2) return 'mid';
    if (stage === 3) return 'mid';
    if (stage >= 4) return 'late';
  }

  const token = normStageToken(stage);
  if (!token) return 'early'; // most pipeline companies are pre-revenue / raising first round

  if (EARLY_STAGE_RE.test(token) || token.includes('early')) return 'early';
  if (MID_STAGE_RE.test(token) || token === 'seriesa') return 'mid';
  if (LATE_STAGE_RE.test(token) || token.includes('growth')) return 'late';
  return 'unknown';
}

/**
 * Score how strongly an investor targets each stage band.
 * @returns {{ band: 'early'|'mid'|'late'|'multi', early: number, mid: number, late: number, isAngel: boolean, isAccelerator: boolean }}
 */
function getInvestorStageProfile(investor = {}) {
  const type = String(investor.type || '').toLowerCase();
  const stagesRaw = Array.isArray(investor.stage)
    ? investor.stage
    : investor.stage != null
      ? [investor.stage]
      : [];

  let early = 0;
  let mid = 0;
  let late = 0;

  let isAngel = EARLY_TYPES.some((t) => type.includes(t));
  const isAccelerator = type.includes('accelerator') || type.includes('incubator');
  const isLateType = LATE_TYPES.some((t) => type.includes(t));

  if (investor.is_individual === true) {
    isAngel = true;
    early += 3;
  }

  if (isAngel) early += 4;
  if (isAccelerator) early += 3;
  if (isLateType) late += 4;
  if (type.includes('vc') && !isLateType) mid += 1;

  for (const raw of stagesRaw) {
    const token = normStageToken(typeof raw === 'number' ? raw : raw);
    if (!token) continue;
    if (EARLY_STAGE_RE.test(token) || token.includes('early')) early += 3;
    else if (MID_STAGE_RE.test(token) || token === 'seriesa') mid += 3;
    else if (LATE_STAGE_RE.test(token) || token.includes('growth')) late += 3;
    else if (token.length <= 12) mid += 1; // generic "Series A/B" strings
  }

  const minCheck = Number(investor.check_size_min) || 0;
  const maxCheck = Number(investor.check_size_max) || 0;

  if (maxCheck > 0 && maxCheck <= 2_500_000) early += 2;
  if (minCheck > 0 && minCheck <= 1_000_000 && maxCheck <= 8_000_000) early += 1;
  if (minCheck >= 3_000_000 && maxCheck > 0 && maxCheck <= 25_000_000) mid += 2;
  if (minCheck >= 15_000_000 || maxCheck >= 50_000_000) late += 3;
  if (minCheck >= 50_000_000) late += 2;

  const capitalType = String(investor.capital_type || '').toLowerCase();
  if (capitalType.includes('angel')) early += 2;
  if (capitalType.includes('seed')) early += 2;
  if (capitalType.includes('growth') || capitalType.includes('late')) late += 2;

  const scores = { early, mid, late };
  const max = Math.max(early, mid, late);
  if (max === 0) {
    return { band: 'multi', ...scores, isAngel, isAccelerator };
  }

  const topBands = ['early', 'mid', 'late'].filter((k) => scores[k] === max);
  const band = topBands.length > 1 ? 'multi' : topBands[0];

  return { band, ...scores, isAngel, isAccelerator };
}

const FIT_MATRIX = {
  early: { early: 10, mid: 2, late: -15, multi: 3, unknown: 0 },
  mid: { early: -10, mid: 8, late: 0, multi: 4, unknown: 0 },
  late: { early: -12, mid: 2, late: 10, multi: 4, unknown: 0 },
  unknown: { early: 5, mid: 3, late: -5, multi: 2, unknown: 0 },
};

/**
 * @param {object} startup
 * @param {object} investor
 * @returns {{ delta: number, note: string, startupBand: string, investorBand: string, profile: object }}
 */
function calculateStageInvestorFitAdjustment(startup, investor) {
  const startupBand = getStartupStageBand(startup?.stage);
  const profile = getInvestorStageProfile(investor);
  let delta = FIT_MATRIX[startupBand]?.[profile.band] ?? 0;

  // Extra nudge: angels/accelerators for clearly early companies
  if (startupBand === 'early' && profile.isAngel) delta += 3;
  if (startupBand === 'early' && profile.isAccelerator) delta += 2;
  if (startupBand === 'early' && isPartnerAngelInvestor(investor)) delta += 5;

  // Growth funds should not dominate pre-seed/seed results
  if (startupBand === 'early' && profile.late >= 3 && profile.early === 0) {
    delta = Math.min(delta, -12);
  }

  const partnerAngel = startupBand === 'early' && isPartnerAngelInvestor(investor);
  let note;
  if (partnerAngel && delta >= 8) {
    note = `Stage fit: VC partner / angel fund for ${startupBand}-stage startup`;
  } else if (delta >= 8) {
    note = `Stage fit: ${profile.isAngel ? 'angel/seed' : 'early-stage'} investor for ${startupBand}-stage startup`;
  } else if (delta >= 3) {
    note = `Stage fit: investor targets ${profile.band} stage (startup: ${startupBand})`;
  } else if (delta <= -10) {
    note = `Stage mismatch: ${profile.band === 'late' ? 'growth/late' : profile.band}-stage investor vs ${startupBand}-stage startup`;
  } else if (delta < 0) {
    note = `Stage stretch: investor skews ${profile.band}, startup is ${startupBand}`;
  } else {
    note = `Stage alignment: neutral (${startupBand} ↔ ${profile.band})`;
  }

  return {
    delta,
    note,
    startupBand,
    investorBand: profile.band,
    profile,
  };
}

/**
 * Apply stage-investor fit bonus/penalty to a scored match (mirrors tech VC adjustment pattern).
 */
function applyStageInvestorFitAdjustment(result, startup, investor) {
  const fit = calculateStageInvestorFitAdjustment(startup, investor);
  if (!fit.delta) return result;

  const score = Math.max(0, Math.min(95, (result.score || 0) + fit.delta));
  const fitAnalysis = {
    ...(result.fitAnalysis || {}),
    stage_investor_fit: fit,
    stage_investor_delta: fit.delta,
  };

  return {
    ...result,
    score,
    fitAnalysis,
    confidence:
      score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low',
  };
}

/**
 * Whether an investor matches a browse filter (API / UI investor directory).
 * @param {object} investor
 * @param {string} filter - early | mid | late | angel | all
 */
function investorMatchesStageFilter(investor, filter) {
  const f = String(filter || 'all').toLowerCase().trim();
  if (!f || f === 'all') return true;

  const profile = getInvestorStageProfile(investor);

  if (f === 'angel' || f === 'angels') return profile.isAngel;

  if (f === 'partner' || f === 'partners') {
    return isPartnerAngelInvestor(investor);
  }

  if (f === 'early') {
    if (profile.band === 'early') return true;
    if (profile.band === 'multi' && profile.early >= profile.late) return true;
    return profile.isAngel || profile.isAccelerator;
  }

  if (f === 'mid') {
    return profile.band === 'mid' || (profile.band === 'multi' && profile.mid >= profile.early && profile.mid >= profile.late);
  }

  if (f === 'late' || f === 'growth') {
    return profile.band === 'late' || (profile.band === 'multi' && profile.late > profile.early);
  }

  return profile.band === f;
}

/**
 * Supabase `.or()` clause to pre-filter investors before in-memory stage refinement.
 * @param {string} filter
 * @returns {string|null}
 */
function buildInvestorStageDbOrFilter(filter) {
  const f = String(filter || '').toLowerCase().trim();
  if (!f || f === 'all') return null;
  if (f === 'angel' || f === 'angels') {
    return 'type.ilike.%angel%,capital_type.ilike.%angel%';
  }
  if (f === 'partner' || f === 'partners') {
    const { buildPartnerAngelDbOrFilter } = require('./partnerAngelInvestors');
    return buildPartnerAngelDbOrFilter();
  }
  if (f === 'early') {
    return [
      'type.ilike.%angel%',
      'type.ilike.%accelerator%',
      'type.ilike.%incubator%',
      'stage.cs.{"Pre-seed"}',
      'stage.cs.{"pre-seed"}',
      'stage.cs.{"Seed"}',
      'stage.cs.{"seed"}',
      'capital_type.ilike.%seed%',
      'capital_type.ilike.%angel%',
    ].join(',');
  }
  if (f === 'mid') {
    return 'stage.cs.{"Series A"},stage.cs.{"series a"},stage.cs.{"Series A/B"}';
  }
  if (f === 'late' || f === 'growth') {
    return [
      'type.ilike.%pe%',
      'type.ilike.%growth%',
      'stage.cs.{"Series B"}',
      'stage.cs.{"Series C"}',
      'stage.cs.{"Growth"}',
      'stage.cs.{"growth"}',
    ].join(',');
  }
  return null;
}

module.exports = {
  getStartupStageBand,
  getInvestorStageProfile,
  calculateStageInvestorFitAdjustment,
  applyStageInvestorFitAdjustment,
  investorMatchesStageFilter,
  buildInvestorStageDbOrFilter,
  EARLY_STAGE_RE,
  MID_STAGE_RE,
  LATE_STAGE_RE,
};
