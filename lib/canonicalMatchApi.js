'use strict';

/**
 * CANONICAL public match API contract — founder URL → preview funnel.
 *
 * All browser-facing endpoints that return investor matches MUST shape rows here:
 *   GET /api/preview/:startupId
 *   GET /api/preview/:startupId/investor/:investorId
 *   GET /api/instant/results
 *
 * Guarantees for clients:
 *   - why_you_match: string | null (never raw Postgres string[])
 *   - match_score: number
 *   - investor.name / investor.firm: string | null
 *   - investor_class: 'angel' | 'vc'
 */

const { normalizeWhyYouMatch } = require('./normalizeWhyYouMatch');
const { getInvestorClass } = require('./investorClass');
const {
  buildMixedInvestorShortlist,
  defaultPreviewMixOptions,
  normalizeMixParam,
} = require('./mixedInvestorShortlist');
const { getInvestorFromMatch } = require('./dedupeInvestorMatchesByFirm');

/**
 * Coerce investor join row to a stable API shape.
 * @param {object|null|undefined} investor
 * @returns {object|null}
 */
function shapeInvestorForApi(investor) {
  if (!investor || typeof investor !== 'object') return null;
  const firmRaw = investor.firm;
  const firm =
    firmRaw != null && String(firmRaw).trim() ? String(firmRaw).trim() : null;
  const name =
    investor.name != null && String(investor.name).trim()
      ? String(investor.name).trim()
      : null;

  return {
    id: investor.id ?? null,
    name,
    firm,
    title: investor.title != null ? String(investor.title) : null,
    type: investor.type != null ? String(investor.type) : null,
    sectors: Array.isArray(investor.sectors) ? investor.sectors : investor.sectors ?? null,
    stage: investor.stage ?? null,
    check_size_min: investor.check_size_min ?? null,
    check_size_max: investor.check_size_max ?? null,
    investor_tier: investor.investor_tier ?? null,
    twitter_url: investor.twitter_url ?? null,
    linkedin_url: investor.linkedin_url ?? null,
    photo_url: investor.photo_url ?? null,
    investor_class: getInvestorClass(investor),
  };
}

/**
 * @param {object|null|undefined} row
 * @returns {object|null}
 */
function shapeMatchForApi(row) {
  if (!row || typeof row !== 'object') return null;

  const investorRaw = row.investor ?? row.investors;
  const investorJoined = Array.isArray(investorRaw) ? investorRaw[0] : investorRaw;
  const investor = shapeInvestorForApi(investorJoined);

  const why = normalizeWhyYouMatch(row.why_you_match);
  const score = Number(row.match_score);
  const matchScore = Number.isFinite(score) ? score : 0;

  return {
    investor_id: row.investor_id ?? investor?.id ?? null,
    match_score: matchScore,
    why_you_match: why || null,
    reasoning: row.reasoning != null ? String(row.reasoning) : null,
    confidence_level: row.confidence_level ?? null,
    fit_analysis: row.fit_analysis ?? null,
    investor,
    investor_class: investor ? investor.investor_class : getInvestorClass(investorJoined),
  };
}

/**
 * Map + filter nulls.
 * @param {object[]} rows
 * @returns {object[]}
 */
function shapeMatchListForApi(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(shapeMatchForApi).filter(Boolean);
}

/**
 * Preview shortlist: mixed angel/VC slots, then canonical API shape.
 * @param {object[]} rawMatches
 * @param {object} [mixOptions]
 * @returns {object[]}
 */
function buildPreviewMatchList(rawMatches, mixOptions = {}) {
  const mixed = buildMixedInvestorShortlist(rawMatches, mixOptions);
  return shapeMatchListForApi(mixed);
}

/**
 * Resolve preview mix options from query + startup stage.
 * @param {object|null} startup
 * @param {string} mixParamRaw
 * @param {number} [total=10]
 */
function resolvePreviewMixOptions(startup, mixParamRaw, total = 10) {
  const mixParam = normalizeMixParam(mixParamRaw);
  const previewMix = defaultPreviewMixOptions(startup, total);
  return {
    total: previewMix.total,
    mix: mixParam === 'balanced' ? previewMix.mix : mixParam,
    vcSlots: previewMix.vcSlots,
    angelSlots: previewMix.angelSlots,
  };
}

/**
 * Summary counts for preview response metadata.
 * @param {object[]} matches
 */
function summarizeShortlistMix(matches, mixOptions) {
  const list = Array.isArray(matches) ? matches : [];
  return {
    mode: mixOptions.mix,
    vc_slots: mixOptions.vcSlots,
    angel_slots: mixOptions.angelSlots,
    vc_count: list.filter((m) => m.investor_class === 'vc').length,
    angel_count: list.filter((m) => m.investor_class === 'angel').length,
  };
}

module.exports = {
  normalizeWhyYouMatch,
  shapeInvestorForApi,
  shapeMatchForApi,
  shapeMatchListForApi,
  buildPreviewMatchList,
  resolvePreviewMixOptions,
  summarizeShortlistMix,
  getInvestorFromMatch,
};
