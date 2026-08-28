/**
 * Pick top-N match rows with one slot per investor firm (partner rows collapse).
 * Used by instant submit sync + BG phases so the same Initialized partner
 * cannot occupy multiple top-5 slots.
 */
'use strict';

const { isGarbageInvestorName, isHardJunkInvestorName } = require('./investorNameHeuristics');

function canonicalFirmKey(investor) {
  if (!investor || typeof investor !== 'object') return '';
  const parenthetical = String(investor.name || '').match(/\(([^)]+)\)\s*$/)?.[1];
  const label = String(investor.firm || parenthetical || investor.name || '')
    .trim()
    .toLowerCase()
    .replace(/\b(?:ventures?|capital|partners?|management|fund|holdings?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!label || label.length < 2) return '';
  const display = String(investor.firm || investor.name || '').trim();
  if (isGarbageInvestorName(display) || isHardJunkInvestorName(display)) return '';
  return `label:${label}`;
}

function scoreOf(row) {
  return Number(row.match_score ?? row.result?.score ?? 0);
}

function investorIdOf(row, getInvestorId) {
  return String(getInvestorId(row) || '');
}

/**
 * @param {object[]} scoredRows - match rows or { inv, result } pairs
 * @param {Map<string, object>} investorById
 * @param {number} limit
 * @param {{ forceInvestorIds?: Iterable<string>, getInvestorId?: (row: object) => string }} [opts]
 */
function selectTopMatchesByFirm(scoredRows, investorById, limit, opts = {}) {
  const force = new Set([...(opts.forceInvestorIds || [])].map(String));
  const getId = opts.getInvestorId || ((row) => row.investor_id || row.inv?.id);

  const ranked = [...(scoredRows || [])].sort(
    (a, b) => scoreOf(b) - scoreOf(a) || investorIdOf(a, getId).localeCompare(investorIdOf(b, getId)),
  );

  const selected = [];
  const seenFirms = new Set();
  const seenIds = new Set();

  const tryAdd = (row) => {
    const id = investorIdOf(row, getId);
    if (!id || seenIds.has(id)) return false;
    const inv = row.inv || investorById?.get(id);
    if (!inv) return false;
    const firmKey = canonicalFirmKey(inv);
    if (!firmKey || seenFirms.has(firmKey)) return false;
    seenFirms.add(firmKey);
    seenIds.add(id);
    selected.push(row);
    return true;
  };

  if (force.size) {
    for (const row of ranked) {
      if (!force.has(investorIdOf(row, getId))) continue;
      tryAdd(row);
      if (selected.length >= limit) return selected;
    }
  }

  for (const row of ranked) {
    if (seenIds.has(investorIdOf(row, getId))) continue;
    tryAdd(row);
    if (selected.length >= limit) break;
  }

  return selected;
}

module.exports = {
  canonicalFirmKey,
  selectTopMatchesByFirm,
};
