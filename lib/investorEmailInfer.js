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

/**
 * Classify an outreach email as personal (partner), intake (pitch@), or generic.
 */
function classifyOutreachEmail(email, investorName) {
  if (!email) return 'missing';
  const local = String(email).split('@')[0].toLowerCase().trim();
  if (INTAKE_SLUGS.includes(local)) return 'intake';
  if (local.includes('.')) return 'personal';
  if (/^[a-z]{3,}$/.test(local) && isPersonName(investorName)) return 'personal';
  return 'generic';
}

function outreachGreeting(investor, emailType) {
  const firm = investor.firm && investor.firm !== 'null' ? investor.firm : investor.name ?? 'your firm';
  if (emailType === 'personal') {
    const first = (investor.name ?? '').split(' ')[0];
    return first ? `Hi ${first},` : `Hi,`;
  }
  return `Hi team at ${firm},`;
}

/** Startup + shared intake slugs (info@, team@ — same playbook as VC pitch@/deals@). */
const STARTUP_CONTACT_SLUGS = [
  'info',
  'hello',
  'team',
  'support',
  'contact',
  'inquiries',
  'founders',
  'hi',
  'pitch',
  'deals',
  'invest',
  'submit',
  'apply',
];

const BLOCKED_OUTREACH_DOMAINS = [
  'bulk@import.com',
  'auto@test.com',
  'test@test.com',
  'hotmoneyhoney.com',
];

/** News, directories, and listing hosts — never hunt founders on these as startup websites. */
const BLOCKED_STARTUP_WEBSITE_DOMAINS = [
  'marketwatch.com',
  'pehub.com',
  'rockhealth.com',
  'ycombinator.com',
  'techcrunch.com',
  'crunchbase.com',
  'bloomberg.com',
  'reuters.com',
  'forbes.com',
  'businesswire.com',
  'prnewswire.com',
  'venturebeat.com',
  'wsj.com',
  'ft.com',
  'theinformation.com',
  'axios.com',
  'linkedin.com',
  'medium.com',
  'substack.com',
  'news.ycombinator.com',
  'pitchbook.com',
  'dealstreetasia.com',
  'sifted.eu',
  'tech.eu',
  'thenextweb.com',
  'tnw.com',
  'finsmes.com',
  'pulse2.com',
  'ventureburn.com',
  'geekwire.com',
  'siliconangle.com',
  'businessinsider.com',
  'cnbc.com',
  'yahoo.com',
  'news.google.com',
  'producthunt.com',
  'wellfound.com',
  'angel.co',
  'angellist.com',
  'f6s.com',
  'betalist.com',
  'techinasia.com',
  'eu-startups.com',
  'dealroom.co',
  'tracxn.com',
  'fortune.com',
  'inc.com',
  'fastcompany.com',
  'wired.com',
  'theverge.com',
  'protocol.com',
  'zdnet.com',
];

const GENERIC_NAME_TOKENS = new Set([
  'health', 'labs', 'technologies', 'technology', 'software', 'systems',
  'solutions', 'platform', 'digital', 'global', 'group', 'holdings',
  'inc', 'llc', 'ltd', 'gmbh', 'corp', 'company',
]);

const DOMAIN_BRAND_PREFIX_RE = /^(get|use|try|go|join|with|meet|ask|the|hey|my)/;
const OUTREACH_HEADLINE_RE =
  /\b(nearly|doubles|triples|soars|nabs|bags|unveils|unveiled|inks|clinches|smashes)\b/i;

function asWebsiteUrl(value) {
  const s = String(value || '').trim();
  if (!s || s.includes(' ')) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.includes('.')) return `https://${s.replace(/^\/+/, '')}`;
  return null;
}

/**
 * Prefer recovered company identity over the scrape/article URL in `website`.
 */
function collectStartupWebsiteCandidates(startup) {
  const extracted = startup?.extracted_data && typeof startup.extracted_data === 'object'
    ? startup.extracted_data
    : {};
  const entries = [
    ['company_domain', startup?.company_domain],
    ['company_website', startup?.company_website],
    ['extracted.company_website', extracted.company_website],
    ['extracted.website', extracted.website],
    ['extracted.homepage', extracted.homepage],
    ['extracted.domain', extracted.domain],
    ['extracted.url', extracted.url],
    ['extracted.recovered_url', extracted.recovered_url],
    ['extracted.recovered_website', extracted.recovered_website],
    ['website', startup?.website],
  ];
  const seen = new Set();
  const out = [];
  for (const [source, value] of entries) {
    const url = asWebsiteUrl(value);
    const domain = extractDomain(url);
    if (!url || !domain || seen.has(domain)) continue;
    seen.add(domain);
    out.push({ url, domain, source });
  }
  return out;
}

function isNewsArticlePath(pathname) {
  const path = String(pathname || '').replace(/\/$/, '') || '/';
  const segs = path.split('/').filter(Boolean);
  if (path.includes('ycombinator.com') && path.startsWith('/companies')) return true;
  if (/\/20\d{2}\/\d{1,2}\//.test(path) && segs.length >= 3) return true;
  if (/\/(articles?|stories|press-releases?)\//i.test(path) && segs.length >= 2) return true;
  return false;
}

function isBlockedStartupWebsite(url) {
  const domain = extractDomain(url);
  if (!domain) return { blocked: true, reason: 'no_website' };
  if (BLOCKED_STARTUP_WEBSITE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return { blocked: true, reason: `aggregator_domain:${domain}` };
  }
  try {
    const raw = url.startsWith('http') ? url : `https://${url}`;
    const u = new URL(raw);
    const path = u.pathname.replace(/\/$/, '') || '/';
    if (domain.includes('ycombinator.com') && path.startsWith('/companies')) {
      return { blocked: true, reason: 'yc_listing_url' };
    }
    // Company product/blog paths are fine — Hunter uses the domain.
    // Only dated /articles/ paths on unknown hosts are scrape leftovers.
    if (isNewsArticlePath(path)) {
      return { blocked: true, reason: 'article_url' };
    }
  } catch {
    return { blocked: true, reason: 'invalid_url' };
  }
  return { blocked: false };
}

function domainBrandKeys(domain) {
  const raw = String(domain || '').split('.')[0].toLowerCase();
  const compact = raw.replace(/-/g, '');
  const stripped = compact.replace(DOMAIN_BRAND_PREFIX_RE, '');
  return { raw, compact, stripped: stripped.length >= 2 ? stripped : compact };
}

/**
 * Startup name should loosely match website domain (blocks wrong-entity rows).
 * Allows get/use/try prefixes (getpie.com ↔ Pie) and 3-letter brands.
 */
function startupNameMatchesDomain(startupName, domain) {
  const keys = domainBrandKeys(domain);
  if (!keys.compact || keys.compact.length < 2) return false;

  const cleaned = String(startupName || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !GENERIC_NAME_TOKENS.has(t));

  const matchesKey = (token) => {
    const prefix = token.slice(0, Math.min(5, token.length));
    return (
      keys.compact === token
      || keys.stripped === token
      || keys.compact.includes(token)
      || keys.stripped.includes(token)
      || token.includes(keys.compact)
      || token.includes(keys.stripped)
      || (token.length >= 5 && (keys.compact.includes(prefix) || keys.stripped.includes(prefix)))
    );
  };

  if (tokens.length === 0) {
    const compactName = cleaned.replace(/\s+/g, '');
    return compactName.length >= 2 && matchesKey(compactName);
  }

  return tokens.some(matchesKey);
}

function pickOutreachWebsite(startup) {
  const candidates = collectStartupWebsiteCandidates(startup);
  if (!candidates.length) return { rejected: true, reason: 'no_website' };

  let firstBlock = null;
  let firstMismatch = null;
  for (const candidate of candidates) {
    const siteCheck = isBlockedStartupWebsite(candidate.url);
    if (siteCheck.blocked) {
      if (!firstBlock) firstBlock = siteCheck;
      continue;
    }
    if (!startupNameMatchesDomain(startup?.name, candidate.domain)) {
      if (!firstMismatch) firstMismatch = candidate.domain;
      continue;
    }
    return { url: candidate.url, domain: candidate.domain, source: candidate.source };
  }
  if (firstMismatch) return { rejected: true, reason: `name_domain_mismatch:${firstMismatch}` };
  return { rejected: true, reason: firstBlock?.reason || 'no_website' };
}

function emailDomainMatchesWebsite(email, websiteUrl) {
  const emailDomain = String(email || '').split('@')[1]?.toLowerCase().trim();
  const siteDomain = extractDomain(websiteUrl);
  if (!emailDomain || !siteDomain) return false;
  return emailDomain === siteDomain;
}

function emailDomainMatchesStartup(email, startup) {
  return collectStartupWebsiteCandidates(startup)
    .some((candidate) => emailDomainMatchesWebsite(email, candidate.url));
}

/** Headline leftovers that pass the generic name validator ("Nirvana Nearly Doubles"). */
function isOutreachHeadlineName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 6) return true;
  return words.length >= 3 && OUTREACH_HEADLINE_RE.test(name);
}

function isBlockedOutreachEmail(email) {
  if (!email) return true;
  const e = String(email).trim().toLowerCase();
  if (!e.includes('@')) return true;
  if (e.startsWith('noreply@') || e.startsWith('no-reply@')) return true;
  const domain = e.split('@')[1] ?? '';
  const local = e.split('@')[0] ?? '';
  if (BLOCKED_OUTREACH_DOMAINS.some((d) => domain === d || e.endsWith(`@${d}`))) return true;
  if (local === 'bulk' && domain === 'import.com') return true;
  return false;
}

function classifyContactEmail(email) {
  if (!email) return 'missing';
  const local = String(email).split('@')[0].toLowerCase().trim();
  if (STARTUP_CONTACT_SLUGS.includes(local)) return 'intake';
  if (local.includes('.')) return 'personal';
  if (/^[a-z]{3,15}$/.test(local)) return 'personal';
  return 'generic';
}

/**
 * Greeting for startup or VC outreach from resolved contact email.
 * intake → "Hi team at {entity}," · personal local → "Hi {First},"
 */
function contactOutreachGreeting({ email, entityName, personName }) {
  const label = (entityName ?? 'your company').trim() || 'your company';
  const type = classifyContactEmail(email);
  const local = String(email ?? '').split('@')[0].toLowerCase().trim();

  if (type === 'personal' && !STARTUP_CONTACT_SLUGS.includes(local)) {
    const fromPerson = personName?.split(/\s+/)[0];
    const fromLocal = local.replace(/[._+-]/g, ' ').split(/\s+/)[0];
    const first = (fromPerson || fromLocal || '').trim();
    if (first.length >= 2 && !STARTUP_CONTACT_SLUGS.includes(first.toLowerCase())) {
      const cap = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
      return `Hi ${cap},`;
    }
  }

  return `Hi team at ${label},`;
}

function startupIntakeAddresses(domain) {
  if (!domain) return [];
  return STARTUP_CONTACT_SLUGS.map((slug) => `${slug}@${domain}`);
}

/**
 * Resolve best outreach address for a startup row.
 * Prefers non-junk submitted_email; falls back to info@domain when MX exists.
 */
async function resolveStartupContactEmail(startup) {
  const submitted = startup.submitted_email?.trim();
  if (submitted && !isBlockedOutreachEmail(submitted)) {
    return {
      email: submitted.toLowerCase(),
      source: 'submitted_email',
      emailType: classifyContactEmail(submitted),
    };
  }

  const domain = extractDomain(startup.website || startup.company_website);
  if (!domain) return null;
  if (!(await domainHasMx(domain))) return null;

  for (const candidate of startupIntakeAddresses(domain)) {
    return {
      email: candidate,
      source: 'inferred_intake',
      emailType: 'intake',
    };
  }
  return null;
}

module.exports = {
  inferEmails,
  inferEmailsBulk,
  auditDomains,
  extractDomain,
  classifyOutreachEmail,
  classifyContactEmail,
  outreachGreeting,
  contactOutreachGreeting,
  resolveStartupContactEmail,
  isBlockedOutreachEmail,
  isBlockedStartupWebsite,
  collectStartupWebsiteCandidates,
  pickOutreachWebsite,
  startupNameMatchesDomain,
  emailDomainMatchesWebsite,
  emailDomainMatchesStartup,
  isOutreachHeadlineName,
  parseName,
  personalPermutations,
  intakeAddresses,
  startupIntakeAddresses,
  domainHasMx,
  isPersonName,
  KNOWN_FIRM_PATTERNS,
  INTAKE_SLUGS,
  STARTUP_CONTACT_SLUGS,
};
