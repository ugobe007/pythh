'use strict';

/**
 * Shared investor name checks (aligned with scripts/cleanup-garbage-investors.js).
 * Used by entity-resolution-gate before expensive enrichment.
 *
 * Rejects headline/team-page scraper junk: job titles glued to names, VC program
 * tags in parentheses (Playground, A16zcrypto, …), and concatenation artifacts.
 */

const PUBLISHER_SUFFIX =
  /\s+(Entrackr|YourStory|Inc42|TechCrunch|VentureBeat|Crunchbase|PitchBook|DealStreetAsia|VCCircle|PE Hub)\s*$/i;

// VC firm canonical suffixes — a name ending in these is almost certainly a real firm
const VC_FIRM_SUFFIXES = /\b(Capital|Ventures?|Partners?|Group|Fund|Investments?|Advisors?|Holdings?|Management|Labs?|Financial|Securities|Equity|Asset|Accelerator|Studio|Combinator|Exchange|Network|Global)\s*$/i;
// Entity legal suffixes
const LEGAL_ENTITY_SUFFIX = /\s(LP|LLC|Inc\.?|Co\.?|Corp\.?|Ltd\.?)\s*$/i;

/** First token is a media/outlet label glued to a firm name in RSS headline scrapes. */
const PUBLISHER_HEADLINE_FIRST = new Set([
  'journal',
  'journals',
  'ventureburn',
  'telegraph',
  'times',
  'pandaily',
  'brewbound',
  'wamda',
  'buzz',
  'decrypt',
  'newswire',
  'whalesbook',
  'bitget',
  'tekedia',
  'disrupt',
  'digitalpulse',
  'infibeam',
  'overproof',
  'entrackr',
  'techloy',
  'tnglobal',
  'indiatimes',
  'globenewswire',
  'finsmes',
  'dealstreet',
  'vccircle',
  'yourstory',
  'inc42',
  'economic',
  'mercom',
  'morningstar',
  'outlook',
  'wire',
  'information',
  'digitization',
  'motion',
  'transformation',
  'completes',
  'aboard',
  'record',
  'sues',
  'cashflows',
  'searching',
  'backer',
  'adds',
  'innovators',
  'mint',
  'upstream',
  'insider',
  'office',
  'freitas',
  'lures',
  'magnific',
  'science',
  'adviser',
  'management',
  'arabia',
  'europe',
  'africa',
  'india',
  'dive',
  'fusion',
  'globe',
  'startup',
  'startups',
  'newswire',
  'tech',
  'finance',
  'blockchain',
]);

const HEADLINE_JUNK_PREFIXES = [
  /^existing (?:key )?investor /i,
  /^Investor /i,
  /^Ace investor /i,
  /^But Scaling /i,
  /^Raising Venture /i,
  /^Lists Venture /i,
  /^Enters Venture /i,
  /^Million (?:Seed|Ocean|Growth)/i,
  /^Searching For /i,
  /^Network Action /i,
  /^Backer Expands /i,
  /^Jeff Clavier Founding /i,
  /^YanSenior /i,
  /^crypto vet /i,
  /^enormous infrastructure /i,
  /^Financing /i,
  /^ed ventures$/i,
];

/**
 * RSS headline: "[Publisher] [Firm] Capital" — e.g. Journal Eka Ventures, Ventureburn Haun Ventures.
 * @param {string} name
 */
function isPublisherHeadlineJunk(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 3) return false;

  const core = trimmed.replace(/\s*\([^)]{1,40}\)\s*$/, '').trim();
  if (!VC_FIRM_SUFFIXES.test(core) && !LEGAL_ENTITY_SUFFIX.test(core)) return false;

  const first = (words[0] || '').toLowerCase();
  if (PUBLISHER_HEADLINE_FIRST.has(first)) return true;

  // Bloomberg Beta is real; Bloomberg Blockchain Capital is headline junk
  if (/^Bloomberg\s+/i.test(trimmed) && !/^Bloomberg\s+Beta\b/i.test(core)) return true;

  // Block Tower etc. may be real; Block Blockchain / Block Solana are junk
  if (/^Block\s+(?:Blockchain|Solana)\b/i.test(trimmed)) return true;

  // Black Diamond is real; Black Zeal / Black Collide are junk
  if (/^Black\s+(?:Zeal|Collide|Private)\b/i.test(trimmed)) return true;

  // Global Founders Capital is real
  if (/^Global\s+(?!Founders\b)/i.test(trimmed)) return true;

  // International Finance / IFC-adjacent names may be real
  if (/^International\s+(?!Finance\b)/i.test(trimmed)) return true;

  return false;
}

/**
 * Publisher glued anywhere in name (quality-gate quarantine path).
 * @param {string} name
 */
function isPublisherConcatName(name) {
  const t = (name || '').trim();
  if (!t) return false;
  if (/^Michael Bloomberg$/i.test(t)) return false;
  if (/[\s\u00a0]{2,}/.test(t)) return true;
  if (isPublisherHeadlineJunk(t)) return true;
  for (const pat of HEADLINE_JUNK_PREFIXES) {
    if (pat.test(t)) return true;
  }
  return /\b(TechCrunch|YourStory|Economic Times|GlobeNewswire|outlookbusiness|entARABI|markets|Indiatimes|Entrackr|TNGlobal|Techloy|Ventureburn|Decrypt|Newswire|Morningstar|Pandaily|Brewbound|Wamda|Tekedia|Finsmes|DealStreet|VCCircle|Inc42|Mercom|Tech\.eu)\b/i.test(
    t
  );
}

const GARBAGE_NAME_PATTERNS = [
  /\s{2,}/, // scraper concat: "Marloo  Capital", "Greenoaks Capital  Entrackr"
  PUBLISHER_SUFFIX,
  /^(Former|Builder|News|Of)\s+/i,
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
  /^PORTFOLIO/i,
  /\bbuilt our fund\b/i,
  /\bexpect our partners\b/i,
  /^Internal AI/i,
  /^a group of investors$/i,
  // Parenthetical program or fund tags scraped into the name field
  /\(\s*(Playground|A16z[a-z]*|a16z[a-z]*|D[Cc]VC|DCVC|Nfx|NFX)\s*\)/i,
  /\([^)]*(?:playground|a16z|dcvc|nfx)\s*[^)]*\)/i,
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
  'former',
  'builder',
  'news',
  'of',
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

/**
 * @param {string} name
 * @returns {boolean}
 */
function isGarbageInvestorName(name) {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  if (trimmed.length > 80) return true;

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 8) return true;

  // Scraper artifacts — must run before VC-suffix fast-pass
  if (/\s{2,}/.test(trimmed)) return true;
  if (PUBLISHER_SUFFIX.test(trimmed)) return true;
  if (/^(Former|Builder|News|Of)\s+/i.test(trimmed)) return true;
  if (/^PORTFOLIO/i.test(trimmed)) return true;
  if (/\bbuilt our fund\b/i.test(trimmed)) return true;
  if (/\bexpect our partners\b/i.test(trimmed)) return true;
  if (/^Internal AI/i.test(trimmed)) return true;
  if (/^a group of investors$/i.test(trimmed)) return true;

  if (isPublisherHeadlineJunk(trimmed)) return true;
  for (const pat of HEADLINE_JUNK_PREFIXES) {
    if (pat.test(trimmed)) return true;
  }

  // Strip parenthetical (firm attribution or acronym) for suffix check
  const core = trimmed.replace(/\s*\([^)]{1,40}\)\s*$/, '').trim();

  // Scraped headline fragments: lowercase phrase + VC suffix ("million growth capital")
  // Keep real brands/programs: a16z Scout Fund (digit in first token), official scout funds
  const firstToken = core.split(/\s+/)[0] || '';
  const digitBrandFirstToken = /^[0-9a-z]*[0-9][0-9a-z]*$/i.test(firstToken);
  const scoutProgram = /\bscout\s+fund\b/i.test(core);
  if (
    /^[a-z]/.test(trimmed) &&
    !digitBrandFirstToken &&
    !scoutProgram &&
    (VC_FIRM_SUFFIXES.test(core) || LEGAL_ENTITY_SUFFIX.test(core))
  ) {
    return true;
  }

  // Fast-pass before /^\d/ and other headline patterns — digit-prefixed firms (500 Global, 8VC)
  if (VC_FIRM_SUFFIXES.test(core) || LEGAL_ENTITY_SUFFIX.test(core)) {
    return hasGluedRoleSuffix(core);
  }
  // "500 Startups" and similar accelerator brands
  if (/\b(Startups?|Global|Combinator)\s*$/i.test(core) && !hasGluedRoleSuffix(core)) {
    return false;
  }
  // Alphanumeric VC brands without a suffix (8VC, a16z, 1confirmation)
  if (/^[0-9A-Za-z]{2,20}$/.test(core) && !hasGluedRoleSuffix(core)) {
    return false;
  }

  for (const pattern of GARBAGE_NAME_PATTERNS) {
    if (pattern.test(trimmed)) return true;
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

/**
 * Firm-level row worth an oracle news search (not a GP duplicate or headline junk).
 * @param {{ name?: string; firm?: string; url?: string|null }} inv
 * @param {{ includePartners?: boolean }} [opts]
 */
function isFirmLevelOracleRow(inv, opts = {}) {
  const { includePartners = false } = opts;
  const name = (inv.name || '').trim();
  const firm = (inv.firm || '').trim();
  if (!name) return false;
  if (isGarbageInvestorName(name) || isPublisherConcatName(name)) return false;
  if (!includePartners && /\s+\([^)]{2,60}\)\s*$/.test(name)) return false;
  // Firm check before person — "Vsquared Ventures" is two Title Case tokens but a real fund.
  if (looksLikeCleanFirmName(name) || (firm && looksLikeCleanFirmName(firm))) return true;
  if (!includePartners && looksLikeCleanPersonName(name)) return false;
  return Boolean(inv.url);
}

module.exports = {
  isGarbageInvestorName,
  isHardJunkInvestorName,
  isPublisherConcatName,
  isPublisherHeadlineJunk,
  investorHasResolvableUrl,
  isFirmLevelOracleRow,
  looksLikeCleanPersonName,
  looksLikeCleanFirmName,
};
