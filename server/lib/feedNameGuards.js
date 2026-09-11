/**
 * Quality guards for public match feeds (recent-matches, hot-matches).
 * Rejects scraped title mash, placeholders, and malformed entity names.
 */

const { classifySuspiciousStartupWebsite } = require('../../lib/suspiciousStartupWebsite');

const PLACEHOLDER_STARTUP =
  /^(full\s+name|unknown\s+startup|unknown|test\s+startup|sample\s+startup|your\s+company|company\s+name|startup\s+name|n\/a|na|tbd|untitled)$/i;

const ROLE_BEFORE_PAREN = /\b(Venture|Vice|Operations|Partner|Principal|Associate|Managing)\s*\(/i;

/** Trajectory / score-state words scrapers store as a company name. */
const FEED_STATUS_WORDS = new Set([
  'declining', 'rising', 'cooling', 'accelerating', 'decelerating',
  'growing', 'falling', 'improving', 'worsening', 'stable', 'stagnant',
  'oversubscribed', 'emerging', 'trending', 'surging', 'slumping',
  'collapsing', 'anytime',
]);

const FEED_NOT_A_STARTUP = new Set([
  'towerbrook',
  'xmrig',
  'lianyungang',
]);

const MONTH_PREFIX =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+/i;

function unwrapFeedName(name) {
  return String(name || '').trim().replace(/^[\[\(\{\"“‘']+|[\]\)\}\"”’']+$/g, '').trim();
}

function isCleanStartupNameForFeed(name) {
  if (!name || name.trim() === '') return false;
  const raw = name.trim();
  if (/^[\[\(\{\"“‘']/.test(raw) || /[\]\)\}\"”’']$/.test(raw)) return false;
  const n = unwrapFeedName(raw);
  if (!n) return false;
  if (n.length > 60) return false;
  if (n.split(/\s+/).length > 6) return false;
  if (/^[a-z]/.test(n)) return false;
  if (PLACEHOLDER_STARTUP.test(n)) return false;
  if (FEED_STATUS_WORDS.has(n.toLowerCase())) return false;
  if (FEED_NOT_A_STARTUP.has(n.toLowerCase())) return false;
  if (MONTH_PREFIX.test(n)) return false;
  if (/\bnot$/i.test(n) && n.split(/\s+/).length <= 3) return false;
  if (/^(How|Why|What|When|Where|While|If|As|Since|After|Before|Former|Post)\s+/i.test(n)) return false;
  if (/\b(funding|raises|raised|million|billion)\b/i.test(n)) return false;
  if (/^(Startup|Firm|Company|Article|Report|Deeptech|European)\s+/i.test(n)) return false;
  if (/\b(startup|platform|service|solution|provider|startups)s?\s*$/i.test(n) && n.split(/\s+/).length > 1) {
    return false;
  }
  return true;
}

function isPublicFeedStartup(su) {
  if (!su || su.status !== 'approved') return false;
  if (String(su.entity_gate || '').toLowerCase() !== 'qualified') return false;
  const website = String(su.website || '').trim();
  if (!website) return false;
  if (classifySuspiciousStartupWebsite(website).suspicious) return false;
  return isCleanStartupNameForFeed(su.name);
}

function isCleanInvestorNameForFeed(name, firm) {
  if (!name || name.trim() === '') return false;
  const n = name.trim();
  const f = (firm || '').trim();
  if (n.length > 72) return false;
  if (PLACEHOLDER_STARTUP.test(n)) return false;
  // Interior camelCase mash: OperationsSam, KirschnerVice
  if (/[a-z][A-Z][a-z]/.test(n)) return false;
  // Lowercase firm slug in parens: (archventure), (villageglobal)
  if (/\([a-z][a-z0-9]*\)/.test(n)) return false;
  // Person + role + firm: "Kevin Hrusovsky Venture (Archventure)"
  if (ROLE_BEFORE_PAREN.test(n)) return false;
  // Name duplicates firm with title noise or long scraped blob
  if (f && n === f && (/[a-z][A-Z][a-z]/.test(n) || n.split(/\s+/).length > 5)) return false;
  // Scraped partner pages: "Bio Carol Suh (Archventure)" — 3+ name tokens then firm slug
  if (/^([A-Z][a-z]+\s+){2,}[A-Z][a-z]+\s+\([A-Za-z]+\)\s*$/.test(n)) return false;
  if (/^teamview/i.test(n)) return false;
  if (/\bview\s*all\b/i.test(n)) return false;
  return true;
}

module.exports = {
  isCleanStartupNameForFeed,
  isCleanInvestorNameForFeed,
  isPublicFeedStartup,
  unwrapFeedName,
};
