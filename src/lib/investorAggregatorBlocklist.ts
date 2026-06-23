/**
 * Directories, databases, and media — not capital allocators.
 * Keep in sync with lib/investorAggregatorBlocklist.js
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

/** Scraper junk — keep aligned with lib/investorNameHeuristics.js */
const JUNK_INVESTOR_SUBSTRINGS = [
  'investing network for',
  'investors who were',
  'invested in diverse',
  'invested in female',
  'startup lessons for',
  '(nfx)',
  '(nea)',
  '(a16z)',
  '(playground)',
  '(dcvc)',
];

function normalizeKey(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isKnownInvestorBrand(investor: {
  name?: string | null;
  firm?: string | null;
  sectors?: string[] | null;
  investor_score?: number | null;
}): boolean {
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

export function isNonInvestorAggregator(investor: {
  name?: string | null;
  firm?: string | null;
  website?: string | null;
  url?: string | null;
  sectors?: string[] | null;
  investor_score?: number | null;
} | null | undefined): boolean {
  if (!investor || typeof investor !== 'object') return false;
  if (isKnownInvestorBrand(investor)) return false;

  const name = normalizeKey(investor.name);
  const firm = normalizeKey(investor.firm);
  const website = normalizeKey(investor.website || investor.url);

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

  for (const key of [name, firm]) {
    if (!key) continue;
    for (const sub of JUNK_INVESTOR_SUBSTRINGS) {
      if (key.includes(sub)) return true;
    }
    const first = key.split(/\s+/)[0];
    if (first && ['investing', 'invested', 'investors', 'startup', 'assistant'].includes(first)) {
      return true;
    }
  }

  return false;
}
