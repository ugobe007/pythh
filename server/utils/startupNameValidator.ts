/**
 * Startup name validation — delegates to lib/startupNameValidator.js (single source of truth).
 * sanitizeStartupName remains here for RSS/import cleanup that strips regional prefixes.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const lib = require('../../lib/startupNameValidator.js') as {
  isValidStartupName: (name: string | null | undefined) => ValidationResult;
  normalizeForBlocklist: (name: string) => string;
  NON_COMPANY_EXACT_NAMES: Set<string>;
};

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export const isValidStartupName = lib.isValidStartupName;
export const normalizeForBlocklist = lib.normalizeForBlocklist;
export const NON_COMPANY_EXACT_NAMES = lib.NON_COMPANY_EXACT_NAMES;

/**
 * Sanitizes a startup name by removing common prefixes/suffixes
 * This is a best-effort cleanup, but validation should still be used
 */
export function sanitizeStartupName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let cleaned = name.trim();

  cleaned = cleaned.replace(/^[A-Za-z][A-Za-z.\s]{0,30}?[- ]based\s+/i, '');

  const NATIONALITY_RE =
    /^(?:norwegian|swedish|finnish|danish|dutch|belgian|swiss|austrian|polish|czech|hungarian|romanian|bulgarian|greek|portuguese|spanish|italian|french|german|british|irish|slovak|slovenian|american|canadian|australian|singaporean|indian|chinese|japanese|korean|taiwanese|thai|vietnamese|indonesian|malaysian|philippine|israeli|turkish|nigerian|kenyan|ghanaian|egyptian|moroccan|emirati|saudi|brazilian|argentinian|chilean|colombian|peruvian|mexican|latvian|lithuanian|estonian|ukrainian|russian|georgian)\s+/i;
  if (NATIONALITY_RE.test(cleaned) && cleaned.replace(NATIONALITY_RE, '').trim().length >= 2) {
    cleaned = cleaned.replace(NATIONALITY_RE, '');
  }

  cleaned = cleaned.replace(
    /^(?:[A-Za-z][A-Za-z0-9\-/]+\s+){0,3}(?:startup|company|firm|platform|chipmaker|provider|maker|developer|builder|unicorn|venture)\s+/i,
    ''
  );

  return cleaned.trim();
}
