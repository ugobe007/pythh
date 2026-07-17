'use strict';

/**
 * Build preview shortlists that mix angel and VC investors instead of letting
 * one class dominate when stage-fit boosts angels.
 */

const {
  dedupeInvestorMatchesByFirm,
  getInvestorFromMatch,
  normalizeInvestorFirmKey,
} = require('./dedupeInvestorMatchesByFirm');
const { getInvestorClass } = require('./investorClass');
const { getStartupStageBand } = require('./stageInvestorFit');

const VALID_MIX = new Set(['balanced', 'vc', 'angel', 'all']);

/**
 * Default slot split based on startup stage band.
 * @param {object|null} startup
 * @returns {{ mix: string, vcSlots: number, angelSlots: number, total: number }}
 */
function defaultPreviewMixOptions(startup, total = 10) {
  const band = getStartupStageBand(startup?.stage);
  if (band === 'early') {
    return { mix: 'balanced', vcSlots: Math.ceil(total / 2), angelSlots: Math.floor(total / 2), total };
  }
  if (band === 'mid') {
    return { mix: 'balanced', vcSlots: Math.ceil(total * 0.7), angelSlots: Math.floor(total * 0.3), total };
  }
  return { mix: 'vc', vcSlots: total, angelSlots: 0, total };
}

/**
 * @param {string} raw
 * @returns {'balanced'|'vc'|'angel'|'all'}
 */
function normalizeMixParam(raw) {
  const m = String(raw || 'balanced').toLowerCase().trim();
  if (m === 'both') return 'balanced';
  if (m === 'vcs') return 'vc';
  if (m === 'angels') return 'angel';
  return VALID_MIX.has(m) ? m : 'balanced';
}

/**
 * @template T
 * @param {T[]} matches
 * @param {object} [options]
 * @param {number} [options.total=10]
 * @param {number} [options.vcSlots]
 * @param {number} [options.angelSlots]
 * @param {'balanced'|'vc'|'angel'|'all'} [options.mix='balanced']
 * @returns {T[]}
 */
function buildMixedInvestorShortlist(matches, options = {}) {
  const total = Math.max(1, Number(options.total) || 10);
  const mix = normalizeMixParam(options.mix);

  if (!Array.isArray(matches) || matches.length === 0) return [];

  if (mix === 'all') {
    return dedupeInvestorMatchesByFirm(matches, total);
  }

  const sorted = [...matches].sort(
    (a, b) => (Number(b.match_score) || 0) - (Number(a.match_score) || 0)
  );

  const angels = sorted.filter((m) => getInvestorClass(getInvestorFromMatch(m)) === 'angel');
  const vcs = sorted.filter((m) => getInvestorClass(getInvestorFromMatch(m)) === 'vc');

  if (mix === 'vc') {
    return dedupeInvestorMatchesByFirm(vcs.length ? vcs : sorted, total);
  }
  if (mix === 'angel') {
    return dedupeInvestorMatchesByFirm(angels.length ? angels : sorted, total);
  }

  const vcSlots = Number.isFinite(options.vcSlots) ? options.vcSlots : Math.ceil(total / 2);
  const angelSlots = Number.isFinite(options.angelSlots) ? options.angelSlots : Math.floor(total / 2);

  const vcPicks = dedupeInvestorMatchesByFirm(vcs, vcSlots);
  const angelPicks = dedupeInvestorMatchesByFirm(angels, angelSlots);

  const seen = new Set();
  const out = [];

  const tryAdd = (m) => {
    const inv = getInvestorFromMatch(m);
    const key = normalizeInvestorFirmKey(inv);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    out.push(m);
    return true;
  };

  for (const m of vcPicks) tryAdd(m);
  for (const m of angelPicks) tryAdd(m);

  if (out.length < total) {
    for (const m of sorted) {
      tryAdd(m);
      if (out.length >= total) break;
    }
  }

  return out
    .sort((a, b) => (Number(b.match_score) || 0) - (Number(a.match_score) || 0))
    .slice(0, total);
}

/**
 * Attach investor_class to each match row for UI badges.
 * @template T
 * @param {T[]} matches
 * @returns {Array<T & { investor_class: 'angel'|'vc' }>}
 */
function annotateMatchesWithInvestorClass(matches) {
  if (!Array.isArray(matches)) return [];
  return matches.map((m) => {
    const inv = getInvestorFromMatch(m);
    return {
      ...m,
      investor_class: getInvestorClass(inv),
    };
  });
}

module.exports = {
  buildMixedInvestorShortlist,
  defaultPreviewMixOptions,
  normalizeMixParam,
  annotateMatchesWithInvestorClass,
  VALID_MIX,
};
