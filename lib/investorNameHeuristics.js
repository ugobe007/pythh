'use strict';

/**
 * Shared investor name checks (aligned with scripts/cleanup-garbage-investors.js).
 * Used by entity-resolution-gate before expensive enrichment.
 *
 * Rejects headline/team-page scraper junk: job titles glued to names, VC program
 * tags in parentheses (Playground, A16zcrypto, …), and concatenation artifacts.
 */

const GARBAGE_NAME_PATTERNS = [
  /^(the |a |an |this |that |how |why |what |when |where |who |which )/i,
  /^(can |could |should |would |will |may |might |shall |must |do |does |did )/i,
  /^(is |are |was |were |been |being |have |has |had |get |gets |got )/i,
  /\b(says?|said|reports?|reported|announces?|announced|raises?|raised|receives?|received)\b/i,
  /\b(according to|in a|for a|of the|to the|on the|at the|from the|by the)\b/i,
  /\b(funding|investment|million|billion|round|series [A-F]|ipo|startup|fintech)\b.*\b(funding|investment|million|billion|round|series [A-F]|ipo)\b/i,
  /[.!?]$/,
  /^\d/,
  /\bhttps?:\/\//i,
  /[,;:]\s.*[,;:]/,
  // Team-page / blog fragments
  /^Startup\s+Lessons\b/i,
  /\bLessons\s+for\b/i,
  /^SongData\b/i,
  // Parenthetical program or fund tags scraped into the name field
  /\(\s*(Playground|A16z[a-z]*|a16z[a-z]*|D[Cc]VC|DCVC)\s*\)/i,
  /\([^)]*(?:playground|a16z|dcvc)\s*[^)]*\)/i,
];

/** Lowercase: person names should not *start* with these (title/role/section headers). */
const BAD_FIRST_TOKEN = new Set([
  'administrator',
  'assistant',
  'associate',
  'investing',
  'operations',
  'technical',
  'platform',
  'scientist',
  'bio',
  'startup',
  'lessons',
  'data',
  'life',
  'songdata',
  'song',
  'chief',
  'vp',
  'svp',
  'head',
  'director',
  'managing',
  'general',
  'partner',
  'principal',
]);

/** Single-token names that are never people in our DB context */
const BLOCKED_SINGLE_NAMES = new Set([
  'playground',
  'investing',
  'operations',
  'assistant',
  'platform',
  'technical',
  'administrator',
  'scientist',
  'bio',
  'startup',
  'lessons',
]);

/**
 * Interior boundary like …wagnerOperating… or …cientistTechnical… (scraper concat).
 * Tuned to avoid false positives like DeMarco (only one lowercase before capital).
 */
function hasLowercaseRunThenCapital(s) {
  return /[a-z]{3,}[A-Z]/.test(s);
}

/**
 * "WagnerOperating", "…SongData…" style glitches
 */
function hasGluedRoleSuffix(s) {
  return /[a-z]{2,}Operating\b/i.test(s) || /SongData/i.test(s) || /ScientistTechnical/i.test(s);
}

function looksLikeCleanPersonName(trimmed) {
  if (hasLowercaseRunThenCapital(trimmed) || hasGluedRoleSuffix(trimmed)) return false;

  // Strip parenthetical firm attribution like " (First Round)" or " (Bessemer)" from person names
  const strippedForPerson = trimmed.replace(/\s*\([^)]{1,40}\)\s*$/, '').trim();
  if (strippedForPerson !== trimmed) {
    // Re-check on the stripped name
    return looksLikeCleanPersonName(strippedForPerson);
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    const w = parts[0];
    if (BLOCKED_SINGLE_NAMES.has(w.toLowerCase())) return false;
    // Plain "Jane" / "Ali"
    if (/^[A-Z][a-z]{1,24}$/.test(w)) return true;
    // DeMarco, McDonald, OConnor (no space) — common in CRM imports
    if (/^[A-Z][a-z]{1,2}[A-Z][a-z]{2,}$/.test(w) && w.length <= 16) return true;
    return false;
  }

  if (parts.length < 2 || parts.length > 4) return false;

  const first = parts[0].replace(/^[^A-Za-z]+/, '');
  if (!first || BAD_FIRST_TOKEN.has(first.toLowerCase())) return false;

  // Title Case tokens; optional hyphen (Mary-Jane), O'Brien/D'Onofrio style, Mc/Mac prefix
  const tok = '(?:Mc|Mac|O\'|D\')?[A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\'[A-Z][a-z]+)?';
  const personRe = new RegExp(`^(?:${tok})(?:\\s+(?:${tok})){1,3}$`);
  if (!personRe.test(trimmed)) return false;

  return true;
}

function looksLikeCleanFirmName(trimmed) {
  if (hasLowercaseRunThenCapital(trimmed) || hasGluedRoleSuffix(trimmed)) return false;

  // Strip a parenthetical suffix like " (NEA)" or " (First Round)" before testing
  const core = trimmed.replace(/\s*\([^)]{1,40}\)\s*$/, '').trim();
  if (!core) return false;

  if (
    /\b(Capital|Ventures?|Partners?|Group|Fund|Investments?|Advisors?|Holdings?|Management|Labs?|Financial|Securities|Equity|Asset|Accelerator|Studio|Ventures?)\s*$/i.test(
      core
    )
  ) {
    return true;
  }
  if (/\s(LP|LLC|Inc\.?|Co\.?|Corp\.?|Ltd\.?)\s*$/i.test(core)) {
    return true;
  }
  // Well-known proper-noun VC brand names (Title Case, no lowercase runs)
  // e.g. "Y Combinator", "Andreessen Horowitz", "Sequoia", "Softbank", "Tiger Global"
  // First token may be a single uppercase letter (Y Combinator, A16z doesn't match — that's fine)
  if (
    /^[A-Z][A-Za-z]{0,20}(?:\s+[A-Z][A-Za-z]{1,20}){0,3}$/.test(core) &&
    core.split(/\s+/).length <= 4 &&
    !hasLowercaseRunThenCapital(core)
  ) {
    return true;
  }
  return false;
}

// VC firm canonical suffixes — a name ending in these is almost certainly a real firm
const VC_FIRM_SUFFIXES = /\b(Capital|Ventures?|Partners?|Group|Fund|Investments?|Advisors?|Holdings?|Management|Labs?|Financial|Securities|Equity|Asset|Accelerator|Studio|Combinator|Exchange|Network|Equity)\s*$/i;
// Entity legal suffixes
const LEGAL_ENTITY_SUFFIX = /\s(LP|LLC|Inc\.?|Co\.?|Corp\.?|Ltd\.?)\s*$/i;

/**
 * @param {string} name
 * @returns {boolean}
 */
function isGarbageInvestorName(name) {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  if (trimmed.length > 80) return true;

  for (const pattern of GARBAGE_NAME_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 8) return true;

  // Strip parenthetical (firm attribution or acronym) for suffix check
  const core = trimmed.replace(/\s*\([^)]{1,40}\)\s*$/, '').trim();

  // Fast-pass: names ending in a canonical VC suffix are real firms even if CamelCase
  if (VC_FIRM_SUFFIXES.test(core) || LEGAL_ENTITY_SUFFIX.test(core)) {
    return hasGluedRoleSuffix(core);
  }

  // Now apply the CamelCase guard (only for non-VC-suffix names)
  if (hasLowercaseRunThenCapital(trimmed)) return true;
  if (hasGluedRoleSuffix(trimmed)) return true;

  if (looksLikeCleanPersonName(trimmed) || looksLikeCleanFirmName(trimmed)) {
    return false;
  }

  return true;
}

/**
 * @param {{ url?: string|null, website?: string|null, linkedin_url?: string|null, crunchbase_url?: string|null, blog_url?: string|null, twitter_url?: string|null }} row
 */
function investorHasResolvableUrl(row) {
  const urls = [row.url, row.website, row.linkedin_url, row.crunchbase_url, row.blog_url, row.twitter_url];
  for (const u of urls) {
    if (u && String(u).trim().length > 8 && /^https?:\/\//i.test(String(u).trim())) return true;
  }
  return false;
}

/**
 * Hard-junk check: patterns that are definitively garbage regardless of URL.
 * Used by classifyInvestor as a first-pass gate that a valid URL cannot override.
 * Keeps headline scrapers, role-glue artifacts, and sentence fragments out.
 */
function isHardJunkInvestorName(name) {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  if (trimmed.length > 80) return true;

  for (const pattern of GARBAGE_NAME_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  if (hasGluedRoleSuffix(trimmed)) return true;
  if (trimmed.split(/\s+/).length > 8) return true;

  return false;
}

module.exports = { isGarbageInvestorName, isHardJunkInvestorName, investorHasResolvableUrl };
