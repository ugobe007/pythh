'use strict';

/**
 * Directories, databases, and media — not capital allocators.
 * Keep in sync with src/lib/investorAggregatorBlocklist.ts
 */

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

/**
 * @param {{ name?: string|null, firm?: string|null, website?: string|null, url?: string|null }} investor
 */
function isNonInvestorAggregator(investor) {
  if (!investor || typeof investor !== 'object') return false;

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

  return false;
}

module.exports = {
  NON_INVESTOR_EXACT,
  NON_INVESTOR_SUBSTRINGS,
  isNonInvestorAggregator,
};
