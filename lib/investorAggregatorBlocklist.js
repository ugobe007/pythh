'use strict';

/**
 * Directories, databases, and media — not capital allocators.
 * Also filters scraper junk names (NFX blog fragments, headline glue, etc.).
 * Keep in sync with src/lib/investorAggregatorBlocklist.ts
 */

const { isGarbageInvestorName } = require('./investorNameHeuristics');

const NON_INVESTOR_EXACT = new Set([
  'vc sheet',
  'vcsheet',
  'crunchbase',
  'angellist',
  'angel list',
  'pitchbook',
  'vc list',
  'investor database',
  'investor directory',
  'dealroom',
  'tracxn',
  'f6s',
  'wellfound',
]);

const NON_INVESTOR_SUBSTRINGS = [
  'vc sheet',
  'vcsheet.com',
  'crunchbase',
  'pitchbook',
  'investor directory',
  'investor database',
];

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Real firm rows that fail headline heuristics (OpenView, 3G Capital, …). */
function isKnownInvestorBrand(investor) {
  const nameRaw = investor.name != null ? String(investor.name).trim() : '';
  const firmRaw = investor.firm != null ? String(investor.firm).trim() : '';
  if (!nameRaw || nameRaw.toLowerCase() !== firmRaw.toLowerCase()) return false;
  if (nameRaw.includes('(')) return false;
  if (/\b(for|who|were|invested|investing|playbook|assistant|partner|raises|build)\b/i.test(nameRaw)) {
    return false;
  }

  const words = nameRaw.split(/\s+/);
  if (words.length > 3) return false;

  const hasSectors = Array.isArray(investor.sectors) && investor.sectors.length > 0;
  const score = Number(investor.investor_score) || 0;
  const core = nameRaw.replace(/\s*\([^)]{1,40}\)\s*$/, '').trim();

  if (
    /\b(Capital|Ventures?|Partners?|Group|Fund|Investments?|Management|Holdings?|Advisors?)\s*$/i.test(
      core
    ) &&
    hasSectors &&
    score >= 20
  ) {
    return true;
  }

  if (words.length === 1 && /^[A-Z][A-Za-z0-9]{2,20}$/.test(nameRaw) && hasSectors && score >= 20) {
    return true;
  }

  return score >= 30 && hasSectors && words.length <= 3;
}

/**
 * @param {{ name?: string|null, firm?: string|null, website?: string|null, url?: string|null, sectors?: string[]|null, investor_score?: number|null }} investor
 */
function isNonInvestorAggregator(investor) {
  if (!investor || typeof investor !== 'object') return false;
  if (isKnownInvestorBrand(investor)) return false;

  const name = normalizeKey(investor.name);
  const firm = normalizeKey(investor.firm);
  const website = normalizeKey(investor.website || investor.url);

  // Platform is the record itself (not a person who works at the platform).
  if (name && NON_INVESTOR_EXACT.has(name)) return true;
  if (name && firm && name === firm && NON_INVESTOR_EXACT.has(firm)) return true;
  if (firm && NON_INVESTOR_EXACT.has(firm) && (!name || name === firm || name.startsWith(`${firm} `))) {
    return true;
  }

  for (const key of [name, firm]) {
    if (!key) continue;
    for (const sub of NON_INVESTOR_SUBSTRINGS) {
      if (key.includes(sub)) return true;
    }
  }

  if (website.includes('vcsheet.com')) return true;

  const nameRaw = investor.name != null ? String(investor.name).trim() : '';
  const firmRaw = investor.firm != null ? String(investor.firm).trim() : '';
  if (nameRaw && isGarbageInvestorName(nameRaw)) {
    if (isKnownInvestorBrand(investor)) return false;
    return true;
  }
  if (firmRaw && firmRaw !== nameRaw && isGarbageInvestorName(firmRaw)) return true;

  return false;
}

module.exports = {
  NON_INVESTOR_EXACT,
  NON_INVESTOR_SUBSTRINGS,
  isNonInvestorAggregator,
};
