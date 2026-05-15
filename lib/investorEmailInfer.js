'use strict';
/**
 * investorEmailInfer.js
 *
 * Generates and verifies email address candidates for VC investors/firms
 * when no verified email is on file.
 *
 * Strategy (in priority order):
 *  1. Known firm overrides (hardcoded patterns for major VCs)
 *  2. Personal permutations from partner name + domain
 *  3. Generic VC intake addresses (pitch@, deals@, etc.)
 *  4. DNS MX verification to confirm domain accepts email
 */

const dns = require('dns').promises;
const { URL } = require('url');

// ─── Known firm email patterns ────────────────────────────────────────────────
// Format: domain → template function(firstName, lastName) → email
const KNOWN_FIRM_PATTERNS = {
  'a16z.com':           (f)      => `${f}@a16z.com`,
  'sequoiacap.com':     (f, l)   => `${f}.${l}@sequoiacap.com`,
  'benchmark.com':      (f)      => `${f}@benchmark.com`,
  'accel.com':          (f, l)   => `${f}.${l}@accel.com`,
  'greylock.com':       (f, l)   => `${f}.${l}@greylock.com`,
  'kleinerperkins.com': (f, l)   => `${f}.${l}@kleinerperkins.com`,
  'nea.com':            (f, l)   => `${f}.${l}@nea.com`,
  'lightspeedvp.com':   (f, l)   => `${f}.${l}@lightspeedvp.com`,
  'gv.com':             (f, l)   => `${f}.${l}@gv.com`,
  'firstround.com':     (f, l)   => `${f}.${l}@firstround.com`,
  'usv.com':            (f, l)   => `${f}.${l}@usv.com`,
  'foundationcapital.com': (f, l) => `${f}.${l}@foundationcapital.com`,
  'boldstart.vc':       (f)      => `${f}@boldstart.vc`,
  'founders.fund':      (f, l)   => `${f}.${l}@foundersfund.com`,
  'foundersfund.com':   (f, l)   => `${f}.${l}@foundersfund.com`,
  'generalcatalyst.com':(f, l)   => `${f}.${l}@generalcatalyst.com`,
  'bvp.com':            (f, l)   => `${f}.${l}@bvp.com`,
  'igsb.com':           (f, l)   => `${f}${l.charAt(0)}@igsb.com`,
  'spark.camp':         (f)      => `${f}@spark.camp`,
  'indexventures.com':  (f, l)   => `${f}.${l}@indexventures.com`,
  'crv.com':            (f, l)   => `${f}.${l}@crv.com`,
  'redpoint.com':       (f, l)   => `${f}.${l}@redpoint.com`,
  'bessemer.com':       (f, l)   => `${f}.${l}@bessemer.com`,
  'ivc.vc':             (f, l)   => `${f}.${l}@ivc.vc`,
};

// ─── Generic VC intake addresses (ordered by how often VCs actually read them) ─
const INTAKE_SLUGS = [
  'pitch',
  'invest',
  'deals',
  'founders',
  'submit',
  'inquiries',
  'hello',
  'info',
  'hi',
  'apply',
  'contact',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9]/g, '');        // letters and digits only
}

/**
 * Extract the root email-sending domain from a firm website URL.
 * Handles: http://www.thewfund.com, https://122west.vc/, etc.
 */
function extractDomain(url) {
  if (!url) return null;
  try {
    const raw = url.startsWith('http') ? url : `https://${url}`;
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Parse a full name into { first, last, initials }.
 * Handles: "Marc Andreessen", "a16z", "500 Startups" (firm-only)
 */
function parseName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return { first: slugify(parts[0]), last: '', initials: slugify(parts[0]).charAt(0) };
  const first = slugify(parts[0]);
  const last  = slugify(parts[parts.length - 1]);
  return { first, last, initials: first.charAt(0) + last.charAt(0) };
}

/**
 * Generate all personal email permutations for a named partner at a domain.
 * Returns an ordered array — most common VC patterns first.
 */
function personalPermutations(firstName, lastName, domain) {
  const f = slugify(firstName);
  const l = slugify(lastName);
  if (!f || !l || !domain) return [];

  const fi = f.charAt(0);   // first initial
  const li = l.charAt(0);   // last initial

  return [
    // Most common enterprise + VC patterns first
    `${f}.${l}@${domain}`,       // marc.andreessen@firm.com
    `${f}@${domain}`,            // marc@firm.com
    `${fi}.${l}@${domain}`,      // m.andreessen@firm.com
    `${fi}${l}@${domain}`,       // mandreessen@firm.com
    `${f}${li}@${domain}`,       // marca@firm.com
    `${l}@${domain}`,            // andreessen@firm.com
    `${f}${l}@${domain}`,        // marcandreessen@firm.com
    `${fi}${li}@${domain}`,      // ma@firm.com
    `${l}${fi}@${domain}`,       // andreessenm@firm.com
    `${f}_${l}@${domain}`,       // marc_andreessen@firm.com (some firms)
    `${f}-${l}@${domain}`,       // marc-andreessen@firm.com (rare)
  ].filter((v, i, a) => a.indexOf(v) === i); // dedupe
}

/**
 * Generate intake/generic email candidates for a domain.
 */
function intakeAddresses(domain) {
  if (!domain) return [];
  return INTAKE_SLUGS.map(slug => `${slug}@${domain}`);
}

// ─── DNS MX verification ──────────────────────────────────────────────────────

const _mxCache = new Map();   // domain → boolean (has MX records)

/**
 * Returns true if the domain has at least one MX record.
 * Cached per process run. Never throws.
 */
async function domainHasMx(domain) {
  if (_mxCache.has(domain)) return _mxCache.get(domain);
  try {
    const records = await dns.resolveMx(domain);
    const has = Array.isArray(records) && records.length > 0;
    _mxCache.set(domain, has);
    return has;
  } catch {
    _mxCache.set(domain, false);
    return false;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build an ordered list of email candidates for an investor record.
 *
 * @param {object} investor  — row from the investors table
 *   investor.name           — partner name OR firm name
 *   investor.firm           — firm name
 *   investor.url            — firm website URL
 *   investor.email          — already-known verified email (if any)
 *   investor.partners       — JSON array of partner names (optional)
 *
 * @param {object} [opts]
 *   opts.verifyDns          — run MX lookup (default true)
 *   opts.partnerName        — explicit partner name to use for personal permutations
 *
 * @returns {Promise<{
 *   domain: string|null,
 *   hasMx: boolean,
 *   verified: string|null,
 *   personal: string[],
 *   intake: string[],
 *   all: string[],          — personal + intake, deduplicated, personal first
 *   bestGuess: string|null, — top candidate (known pattern > personal[0] > intake[0])
 * }>}
 */
async function inferEmails(investor, opts = {}) {
  const { verifyDns = true, partnerName = null } = opts;

  const domain = extractDomain(investor.url || investor.website);
  const hasMx  = domain && verifyDns ? await domainHasMx(domain) : !!domain;

  // If the investor already has a verified email, return it immediately
  if (investor.email) {
    return {
      domain, hasMx,
      verified: investor.email,
      personal: [],
      intake: intakeAddresses(domain),
      all: [investor.email, ...intakeAddresses(domain)],
      bestGuess: investor.email,
    };
  }

  // Determine whose name to use for personal permutations
  // Priority: explicit partnerName arg > investor.name (if it looks like a person) > null
  const nameToUse = partnerName || (isPersonName(investor.name) ? investor.name : null);
  const parsed = nameToUse ? parseName(nameToUse) : null;

  let personal = [];

  if (parsed && parsed.first && parsed.last && domain) {
    // Check if we have a known firm override
    const knownFn = KNOWN_FIRM_PATTERNS[domain];
    if (knownFn) {
      const knownEmail = knownFn(parsed.first, parsed.last);
      personal = [knownEmail, ...personalPermutations(parsed.first, parsed.last, domain)];
      personal = [...new Set(personal)];
    } else {
      personal = personalPermutations(parsed.first, parsed.last, domain);
    }
  }

  // Also generate intake addresses for the firm
  const intake = domain ? intakeAddresses(domain) : [];

  // Also add partners from the investor.partners field if it's an array
  let partnerPersonal = [];
  if (Array.isArray(investor.partners)) {
    for (const pName of investor.partners.slice(0, 5)) {
      // Guard against non-string, object, or garbage entries
      if (typeof pName !== 'string') continue;
      if (!isPersonName(pName)) continue;  // must look like a real person name
      const pParsed = parseName(pName);
      if (!pParsed || !pParsed.first || !pParsed.last || !domain) continue;
      const knownFn = KNOWN_FIRM_PATTERNS[domain];
      if (knownFn) partnerPersonal.push(knownFn(pParsed.first, pParsed.last));
      partnerPersonal.push(`${pParsed.first}@${domain}`);
      partnerPersonal.push(`${pParsed.first}.${pParsed.last}@${domain}`);
    }
    partnerPersonal = [...new Set(partnerPersonal)];
  }

  const allPersonal = [...new Set([...personal, ...partnerPersonal])];
  const all = [...new Set([...allPersonal, ...intake])];

  return {
    domain,
    hasMx,
    verified: null,
    personal: allPersonal,
    intake,
    all,
    bestGuess: allPersonal[0] || intake[0] || null,
  };
}

// Common firm-name words that appear as last tokens — not last names
const FIRM_SUFFIXES = new Set([
  'ventures', 'venture', 'capital', 'partners', 'partner', 'fund', 'funds',
  'investments', 'investment', 'equity', 'management',
  'group', 'holdings', 'associates', 'advisors', 'advisory', 'network',
  'labs', 'lab', 'studio', 'studios', 'collective', 'innovation', 'innovations',
  'enterprise', 'enterprises', 'solutions', 'technologies', 'technology',
  'inc', 'llc', 'ltd', 'corp', 'co', 'gp', 'lp', 'vc',
  'global', 'international', 'growth', 'alpha', 'beta', 'seed', 'stage',
  'accelerator', 'incubator', 'syndicate', 'platform', 'asset', 'assets',
  'financial', 'finance', 'wealth', 'micro', 'digital', 'impact', 'social',
  'opportunity', 'foundation', 'trust', 'society', 'institute', 'school',
]);

/**
 * Heuristic: does this string look like a person's name rather than a firm name?
 * "Marc Andreessen" → true
 * "a16z" → false
 * "500 Startups" → false
 * "Lightspeed Ventures" → false (common firm suffix)
 * "John Smith" → true
 */
function isPersonName(name) {
  if (!name) return false;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return false;                          // single word → firm
  if (parts.length > 4) return false;                          // 5+ words → firm
  if (/\d/.test(parts[0])) return false;                       // starts with digit → firm
  if (parts[0].length <= 2) return false;                      // "VC" or initials
  if (!/^[A-Za-z]{2,15}$/.test(parts[0])) return false;       // first word = alpha only
  // Last word must NOT be a known firm suffix
  const lastWord = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
  if (FIRM_SUFFIXES.has(lastWord)) return false;
  // Middle words also must not be firm suffixes (e.g. "Andreessen Horowitz Capital")
  for (let i = 1; i < parts.length; i++) {
    const w = parts[i].toLowerCase().replace(/[^a-z]/g, '');
    if (FIRM_SUFFIXES.has(w)) return false;
  }
  return true;
}

/**
 * Bulk: infer emails for many investors at once.
 * Returns a Map of investor.id → result object.
 *
 * @param {object[]} investors
 * @param {object}   [opts]
 * @param {boolean}  [opts.verifyDns=true]
 * @param {function} [opts.onProgress]  — called with (done, total) after each item
 */
async function inferEmailsBulk(investors, opts = {}) {
  const { verifyDns = true, onProgress } = opts;
  const results = new Map();

  // Pre-cache MX for unique domains (batch DNS lookup is faster)
  if (verifyDns) {
    const domains = [...new Set(
      investors.map(inv => extractDomain(inv.url || inv.website)).filter(Boolean)
    )];
    await Promise.allSettled(domains.map(d => domainHasMx(d)));
  }

  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    const result = await inferEmails(inv, { verifyDns });
    results.set(inv.id, result);
    if (onProgress) onProgress(i + 1, investors.length);
  }

  return results;
}

/**
 * Quick summary of all unique domains with their MX status.
 * Useful for identifying which VC firm domains are reachable.
 */
async function auditDomains(investors) {
  const domainMap = {};
  for (const inv of investors) {
    const domain = extractDomain(inv.url || inv.website);
    if (!domain) continue;
    if (!domainMap[domain]) domainMap[domain] = { domain, firms: [], hasMx: null };
    domainMap[domain].firms.push(inv.name || inv.firm);
  }
  const domains = Object.values(domainMap);
  await Promise.allSettled(
    domains.map(async d => { d.hasMx = await domainHasMx(d.domain); })
  );
  return domains.sort((a, b) => (b.hasMx ? 1 : 0) - (a.hasMx ? 1 : 0));
}

module.exports = {
  inferEmails,
  inferEmailsBulk,
  auditDomains,
  extractDomain,
  parseName,
  personalPermutations,
  intakeAddresses,
  domainHasMx,
  isPersonName,
  KNOWN_FIRM_PATTERNS,
  INTAKE_SLUGS,
};
