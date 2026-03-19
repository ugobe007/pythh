/**
 * Startup Name Validator (JS) — used when .ts is not available (production Node)
 * Ported from startupNameValidator.ts to avoid require/import of .ts in plain Node.
 */

const JUNK_PATTERNS = [
  /^Weekly\s+/i,
  /^Daily\s+/i,
  /^Monthly\s+/i,
  /^Top\s+\d+/i,
  /^How\s+/i,
  /^Why\s+/i,
  /^What\s+/i,
  /^The\s+Best/i,
  /^Best\s+/i,
  /^Latest\s+/i,
  /^News\s+/i,
  /^Update\s+/i,
  /^Roundup/i,
  /^Digest/i,
  /^Summary/i,
  /^test/i,
  /^demo/i,
  /^sample/i,
  /^placeholder/i,
  /^untitled/i,
  /^new startup/i,
  /^temp/i,
  /^draft/i,
  /^pending/i,
  /^unknown/i,
  /^unnamed/i,
  /^n\/a$/i,
  /^tbd$/i,
  /^.{0,1}$/,
  /^.{100,}$/,
  /\b(article|post|blog|newsletter|email|digest|roundup|summary|highlights|update|announcement)\b/i,
];

function isValidStartupName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, reason: 'empty_or_null' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) return { isValid: false, reason: 'too_short' };
  if (trimmed.length > 80) return { isValid: false, reason: 'too_long' };
  for (const p of JUNK_PATTERNS) {
    if (p.test(trimmed)) return { isValid: false, reason: `matches_pattern` };
  }
  if (!/[a-zA-Z0-9]/.test(trimmed)) return { isValid: false, reason: 'no_alphanumeric' };
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount > 8) return { isValid: false, reason: 'too_many_words' };
  return { isValid: true };
}

module.exports = { isValidStartupName };
