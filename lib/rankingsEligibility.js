/**
 * Public rankings / GOD leaderboard eligibility — hide junk names and headline artifacts.
 */
'use strict';

const { createRequire } = require('module');
const requireEsm = createRequire(__filename);
const { ENTITY_QUARANTINE_BY_NAME } = requireEsm('./portfolioOutreachGate.mjs');
const { evaluateStartupNameForPipeline } = require('./startupNameGate');

const PUBLISHER_HOST_RE =
  /\b(?:techmeme|prnewswire|fintechnews|cervinventures|ventureburn|techinafrica|globenewswire|businessinsider|finsmes|techcrunch|saastr|substack|youtube|medium)\./i;

function hasPublisherWebsite(row = {}) {
  const url = String(row.website || row.company_domain || '').trim();
  if (!url) return false;
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
    return PUBLISHER_HOST_RE.test(host);
  } catch {
    return PUBLISHER_HOST_RE.test(url);
  }
}

/**
 * @param {object} row — startup_uploads-shaped row
 * @returns {{ ok: boolean, reason: string|null }}
 */
function isRankingsEligibleStartup(row = {}) {
  const gate = String(row.entity_gate || '').toLowerCase();
  if (gate === 'junk') return { ok: false, reason: 'entity_gate_junk' };

  const name = String(row.name || '').trim();
  if (!name) return { ok: false, reason: 'empty_name' };

  if (ENTITY_QUARANTINE_BY_NAME[name]) {
    return { ok: false, reason: 'quarantine_name' };
  }

  const nameEval = evaluateStartupNameForPipeline(name);
  if (!nameEval.ok) return { ok: false, reason: nameEval.reason };

  if (hasPublisherWebsite(row)) return { ok: false, reason: 'publisher_website' };

  return { ok: true, reason: null };
}

function filterRankingsStartups(rows = []) {
  return rows.filter((row) => isRankingsEligibleStartup(row).ok);
}

module.exports = {
  isRankingsEligibleStartup,
  filterRankingsStartups,
  hasPublisherWebsite,
  PUBLISHER_HOST_RE,
};
