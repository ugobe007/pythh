/**
 * Deduplicate investor match rows so each VC / firm appears at most once (highest match_score kept).
 * Keep in sync with src/lib/dedupeInvestorMatchesByFirm.ts (app bundle).
 */

'use strict';

function getInvestorFromMatch(m) {
  if (!m || typeof m !== 'object') return null;
  if (m.investor) return m.investor;
  const inv = m.investors;
  return Array.isArray(inv) ? inv[0] : inv;
}

/** Stable key: prefer firm, else solo-angel name, else investor id */
function normalizeInvestorFirmKey(investor) {
  if (!investor || typeof investor !== 'object') return '';
  const firm = investor.firm != null && String(investor.firm).trim();
  if (firm) return firm.toLowerCase().replace(/\s+/g, ' ').trim();
  const name = investor.name != null && String(investor.name).trim();
  if (name) return `name:${name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
  if (investor.id) return `id:${investor.id}`;
  return '';
}

/**
 * @template T
 * @param {T[]} matches - sorted by match_score desc
 * @param {number} limit
 * @returns {T[]}
 */
function dedupeInvestorMatchesByFirm(matches, limit = 5) {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  const sorted = [...matches].sort(
    (a, b) => (Number(b.match_score) || 0) - (Number(a.match_score) || 0)
  );
  const seen = new Set();
  const out = [];
  for (const m of sorted) {
    const inv = getInvestorFromMatch(m);
    const key = normalizeInvestorFirmKey(inv);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

module.exports = {
  dedupeInvestorMatchesByFirm,
  normalizeInvestorFirmKey,
  getInvestorFromMatch,
};
