#!/usr/bin/env node
/**
 * STARTUP DOMAIN NORMALIZER v1
 * ==============================
 * Extracts canonical company domains from the messy website/source_url fields.
 *
 * Problem: `website` field often contains article URLs (techcrunch.com, pulse2.com, etc.)
 *          instead of actual company domains.
 *
 * Strategy (in priority order):
 *   1. Check `website` field — if it's not a publisher/news domain, extract domain
 *   2. Check `extracted_data.canonical_domain` — if present and not a publisher
 *   3. Try to infer from startup `name` using common TLD patterns
 *   4. Check `source_url` for company name mentions in the path
 *
 * Outputs per startup:
 *   - company_domain: normalized domain (e.g., "stripe.com")
 *   - company_domain_confidence: 0.0–1.0
 *   - domain_source: which field/method yielded the domain
 *
 * USAGE (module):
 *   const { normalizeDomain, extractCompanyDomain } = require('./startup-domain-normalizer');
 *
 * USAGE (CLI):
 *   node scripts/startup-domain-normalizer.js --test
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: PUBLISHER / NEWS DOMAIN BLACKLIST
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Domains that are NEVER a startup's own domain.
 * Includes news, aggregators, social platforms, dev blogs, etc.
 */
const PUBLISHER_DOMAINS = new Set([
  // Major tech news
  'techcrunch.com', 'venturebeat.com', 'theverge.com', 'wired.com',
  'arstechnica.com', 'engadget.com', 'zdnet.com', 'cnet.com',
  'mashable.com', 'gizmodo.com', 'theinformation.com', 'protocol.com',
  'sifted.eu', 'therecord.media',

  // Business / finance news
  'bloomberg.com', 'reuters.com', 'fortune.com', 'forbes.com',
  'businessinsider.com', 'entrepreneur.com', 'inc.com', 'fastcompany.com',
  'cnbc.com', 'wsj.com', 'ft.com', 'economist.com', 'barrons.com',
  'axios.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com',
  'bbc.com', 'bbc.co.uk', 'apnews.com',

  // Startup / VC news
  'pulse2.com', 'finsmes.com', 'eu-startups.com', 'tech.eu',
  'arcticstartup.com', 'startupdaily.net', 'startupgrind.com',
  'betakit.com', 'e27.co', 'techinasia.com', 'thenextweb.com',
  'seedtable.com', 'dealstreetasia.com', 'krasia.com',
  'yourstory.com', 'vccircle.com', 'entrackr.com',
  'thebridge.jp', 'jumpstartmag.com',

  // VC / investment
  'a16z.com', 'sequoia.com', 'accel.com', 'benchmark.com',
  'greylock.com', 'crunchbase.com', 'news.crunchbase.com',
  'pitchbook.com', 'cbinsights.com', 'dealroom.co',

  // Fintech news
  'fintechnews.org', 'thefintechtimes.com', 'finextra.com',
  'pymnts.com', 'finovate.com', 'bankingtech.com',

  // Crypto / web3 news
  'cointelegraph.com', 'coindesk.com', 'decrypt.co', 'theblock.co',
  'blockworks.co', 'defiant.io',

  // Aggregators & platforms
  'news.google.com', 'google.com', 'feedly.com',
  'news.ycombinator.com', 'ycombinator.com',
  'producthunt.com', 'betalist.com', 'angellist.com',

  // Social
  'twitter.com', 'x.com', 'linkedin.com', 'facebook.com',
  'instagram.com', 'reddit.com', 'medium.com', 'substack.com',

  // Dev platforms
  'dev.to', 'hackernoon.com', 'dzone.com', 'infoq.com',
  'towardsdatascience.com', 'stackoverflow.com',

  // General hosting / marketplace
  'github.com', 'gitlab.com', 'bitbucket.org',
  'gumroad.com', 'shopify.com', 'wordpress.com',
  'youtube.com', 'vimeo.com',

  // Government / edu
  'nih.gov', 'nsf.gov', 'europa.eu', 'gov.uk',

  // Misc publishers
  'techradar.com', 'tomshardware.com', 'pcmag.com',
  'geekwire.com', 'siliconangle.com', 'computerworld.com',
  'infoworld.com', 'businesswire.com', 'prnewswire.com',
  'globenewswire.com', 'accesswire.com', 'newswire.com',
  'prsync.com', 'einnews.com',
  'ainews.eu', 'ainewsclimate.com',
  'runtechclub.co',

  // Discovered from v1 domain leakage audit
  'pehub.com', 'techmeme.com', 'saastr.com', 'medcitynews.com',
  'techfundingnews.com', 'contxto.com', 'statnews.com',
  'inc42.com', 'technode.com', 'heyfuturenexus.com',
  'lsvp.com', 'ventureradar.com', 'newcomer.co',
  'siliconrepublic.com', 'ventureburn.com', 'technologyreview.com',
  'cleantechnica.com', 'venturefizz.com', 'artificialintelligence-news.com',
  'foundersfund.com', 'mattermark.com', 'stackoverflow.blog',
  'avc.com', 'usv.com', 'ctvc.co', 'techcabal.com',
  'blog.samaltman.com', 'stratechery.com', 'vccafe.com',
  'arctic15.com', 'alleywatch.com', 'mezha.net',
]);

/**
 * Parent domains for publisher subdomains.
 * If domain ends with any of these, it's a publisher.
 */
const PUBLISHER_SUFFIXES = [
  '.google.com', '.bloomberg.com', '.wsj.com', '.nytimes.com',
  '.reuters.com', '.bbc.co.uk', '.bbc.com',
  '.wordpress.com', '.medium.com', '.substack.com',
  '.github.io', '.gitlab.io', '.netlify.app', '.vercel.app',
  '.herokuapp.com', '.firebaseapp.com',
  '.samaltman.com', '.ashbyhq.com',
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: DOMAIN EXTRACTION & VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a URL or domain string into a clean domain.
 * Handles: full URLs, protocol-less, trailing slashes/paths, etc.
 *
 * Examples:
 *   "https://www.stripe.com/payments" → "stripe.com"
 *   "11x.ai" → "11x.ai"
 *   "www.example.com" → "example.com"
 */
function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return null;

  let s = input.trim().toLowerCase();

  // Remove protocol
  s = s.replace(/^https?:\/\//i, '');
  // Remove www.
  s = s.replace(/^www\./i, '');
  // Remove trailing path, query, fragment
  s = s.replace(/[/?#].*$/, '');
  // Remove trailing dots
  s = s.replace(/\.+$/, '');
  // Remove port
  s = s.replace(/:\d+$/, '');

  // Must have at least one dot
  if (!s.includes('.')) return null;

  // Must look like a domain (alphanumeric, hyphens, dots)
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(s)) return null;

  // Must have a valid TLD (at least 2 chars after last dot)
  const parts = s.split('.');
  if (parts[parts.length - 1].length < 2) return null;

  return s;
}

/**
 * Check if a domain is a known publisher/news/aggregator domain.
 * Returns true if the domain should NOT be used as a company domain.
 */
function isPublisherDomain(domain) {
  if (!domain) return true;
  const d = domain.toLowerCase();

  // Direct match
  if (PUBLISHER_DOMAINS.has(d)) return true;

  // Suffix match (news.crunchbase.com → .crunchbase.com)
  for (const suffix of PUBLISHER_SUFFIXES) {
    if (d.endsWith(suffix)) return true;
  }

  // Check if it's a subdomain of a publisher
  const parts = d.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(1).join('.');
    if (PUBLISHER_DOMAINS.has(parentDomain)) return true;
    // Check 2-level parent (e.g., news.bbc.co.uk → bbc.co.uk)
    if (parts.length > 3) {
      const grandParent = parts.slice(2).join('.');
      if (PUBLISHER_DOMAINS.has(grandParent)) return true;
    }
  }

  return false;
}

/**
 * Score how likely a domain is to be the startup's actual domain.
 * Uses startup name matching, path depth, and domain structure.
 *
 * @param {string} domain - Normalized domain
 * @param {string} startupName - Startup name
 * @param {string} tagline - Startup tagline (optional)
 * @returns {number} Score 0.0–1.0
 */
function scoreDomainMatch(domain, startupName, tagline) {
  if (!domain || !startupName) return 0.3;

  let score = 0.5; // baseline for any non-publisher domain

  const domBase = domain.replace(/\.[^.]+$/, '').replace(/[.-]/g, '').toLowerCase();
  const nameLower = startupName.toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // strip non-alphanumeric
    .replace(/^(the|a|an)\s*/i, ''); // strip articles

  // Name contains domain base or vice versa
  if (nameLower.includes(domBase) || domBase.includes(nameLower)) {
    score = Math.max(score, 0.9);
  }

  // Fuzzy: domain base shares > 60% of characters with name
  if (domBase.length > 3 && nameLower.length > 3) {
    const overlap = longestCommonSubstring(domBase, nameLower);
    const overlapRatio = overlap / Math.max(domBase.length, nameLower.length);
    if (overlapRatio > 0.6) score = Math.max(score, 0.75);
    else if (overlapRatio > 0.4) score = Math.max(score, 0.6);
  }

  // Known startup TLDs boost
  if (/\.(ai|io|co|app|dev|tech|cloud|so|xyz)$/.test(domain)) {
    score = Math.min(1.0, score + 0.05);
  }

  // Very short domain (< 4 chars before TLD) — slightly suspicious
  if (domBase.length < 4) score = Math.min(score, 0.7);

  // Gumroad/shopify subdomain
  if (/\.(gumroad|shopify|carrd|webflow|wixsite)\.com$/.test(domain)) {
    score = Math.min(score, 0.4);
  }

  return Math.round(score * 100) / 100;
}

/**
 * Longest common substring length.
 */
function longestCommonSubstring(a, b) {
  let maxLen = 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) maxLen = dp[i][j];
      }
    }
  }
  return maxLen;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: DOMAIN EXTRACTION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract the company's canonical domain from a startup row.
 *
 * Priority:
 *   1. website field (if not a publisher domain)
 *   2. extracted_data.canonical_domain (if not a publisher)
 *   3. extracted_data.source_url (if it's not a publisher — sometimes this is the company URL)
 *   4. source_url (for RSS items, try to extract company from article path)
 *   5. Name-based heuristic (e.g., "Stripe" → try stripe.com)
 *
 * @param {object} startup - Startup row from DB
 * @returns {{ company_domain: string|null, confidence: number, source: string }}
 */
function extractCompanyDomain(startup) {
  const name = startup.name || '';
  const tagline = startup.tagline || '';
  const ed = startup.extracted_data || {};

  // ─── Strategy 1: website field ──────────────────────────────────────────
  if (startup.website) {
    const domain = normalizeDomain(startup.website);
    if (domain && !isPublisherDomain(domain)) {
      const score = scoreDomainMatch(domain, name, tagline);
      return {
        company_domain: domain,
        confidence: Math.max(0.6, score),
        source: 'website_field',
      };
    }
  }

  // ─── Strategy 2: extracted_data.canonical_domain ──────────────────────────
  if (ed.canonical_domain) {
    const domain = normalizeDomain(ed.canonical_domain);
    if (domain && !isPublisherDomain(domain)) {
      const score = scoreDomainMatch(domain, name, tagline);
      return {
        company_domain: domain,
        confidence: Math.max(0.55, score),
        source: 'extracted_data_canonical',
      };
    }
  }

  // ─── Strategy 3: extracted_data source_url (sometimes is company URL) ───
  if (ed.source_url) {
    const domain = normalizeDomain(ed.source_url);
    if (domain && !isPublisherDomain(domain)) {
      const score = scoreDomainMatch(domain, name, tagline);
      if (score > 0.6) {
        return {
          company_domain: domain,
          confidence: Math.max(0.5, score * 0.9),
          source: 'extracted_data_source_url',
        };
      }
    }
  }

  // ─── Strategy 4: Try to extract company domain from source_url path ─────
  if (startup.source_url) {
    const domainFromArticle = extractDomainFromArticlePath(startup.source_url, name);
    if (domainFromArticle) {
      return {
        company_domain: domainFromArticle.domain,
        confidence: domainFromArticle.confidence,
        source: 'article_path_inference',
      };
    }
  }

  // ─── Strategy 5: Name-based heuristic ───────────────────────────────────
  const nameBasedDomain = inferDomainFromName(name);
  if (nameBasedDomain) {
    return {
      company_domain: nameBasedDomain,
      confidence: 0.3,
      source: 'name_inference',
    };
  }

  return {
    company_domain: null,
    confidence: 0,
    source: 'none',
  };
}

/**
 * Try to extract company domain from an article URL's path.
 * e.g., "https://techcrunch.com/2025/07/01/stripe-raises-200m/" → "stripe.com" (low conf)
 * This is very heuristic and only works in some cases.
 */
function extractDomainFromArticlePath(url, startupName) {
  if (!url || !startupName) return null;

  // Clean name for matching
  const nameClean = startupName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')[0]; // first word of name

  if (nameClean.length < 3) return null;

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.toLowerCase().split(/[/-]/).filter(p => p.length > 2);

    // Check if startup name appears in path
    for (const part of pathParts) {
      if (part === nameClean || part.includes(nameClean)) {
        // Try common TLDs
        const candidate = `${nameClean}.com`;
        return { domain: candidate, confidence: 0.25 };
      }
    }
  } catch {
    // Invalid URL
  }

  return null;
}

/**
 * Infer a likely domain from a startup name.
 * Very low confidence — just generates a candidate.
 */
function inferDomainFromName(name) {
  if (!name || name.length < 2) return null;

  // Clean the name
  const clean = name.toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (clean.length < 2 || clean.length > 30) return null;

  // Skip names that are clearly descriptions, not company names
  if (/^(this|the|how|what|why|when|these|a |an )/.test(name.toLowerCase())) return null;
  if (name.split(' ').length > 4) return null;

  // If name already looks like a domain
  if (/\.[a-z]{2,}$/.test(clean)) return clean;

  // Generate candidate with .com
  return `${clean.replace(/\./g, '')}.com`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: CLI / TEST MODE
// ═══════════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const testCases = [
    { name: 'Stripe', website: 'https://stripe.com/payments', source_url: 'https://techcrunch.com/stripe-raises' },
    { name: 'Anthropic', website: null, source_url: 'https://www.entrepreneur.com/business-news/anthropic-raises-30b', description: 'Anthropic raised $30B' },
    { name: 'Mysa', website: null, source_url: 'https://news.google.com/rss/articles/CBMi...', tagline: 'Fintech startup' },
    { name: 'Solutions', website: 'https://pulse2.com/uptiq-25-million-series-b/', source_url: 'https://pulse2.com/uptiq-25-million-series-b/' },
    { name: '11x.ai', website: '11x.ai', source_url: null },
    { name: 'University venture fund', website: 'https://news.google.com/rss/articles/CBMiowFBVV95cUxQ', source_url: 'https://news.google.com/rss/articles/CBMiowFBVV95cUxQ' },
    { name: 'Dynamic Core Capital Partners', website: 'https://pulse2.com/dynamic-core-capital-partners-closes-240-', source_url: 'https://pulse2.com/dynamic-core-capital-partners-closes-240-' },
    { name: 'simmetry.ai', website: 'https://www.eu-startups.com/2026/02/german-synthetic-data-st', source_url: 'https://www.eu-startups.com/2026/02/german-synthetic-data-startup-simmetry-ai-se' },
    { name: 'Air', website: 'air.ai', source_url: null },
    { name: 'Hauler Hero', website: 'https://pulse2.com/hauler-hero-16-million-series-a/', source_url: 'https://pulse2.com/hauler-hero-16-million-series-a/' },
  ];

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  DOMAIN NORMALIZER v1 — Test Mode                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const tc of testCases) {
    const result = extractCompanyDomain(tc);
    const dom = result.company_domain || '(none)';
    const conf = result.confidence.toFixed(2);
    console.log(`  ${(tc.name || '').padEnd(35)} → ${dom.padEnd(30)} conf=${conf}  src=${result.source}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  normalizeDomain,
  isPublisherDomain,
  scoreDomainMatch,
  extractCompanyDomain,
  extractDomainFromArticlePath,
  inferDomainFromName,
  PUBLISHER_DOMAINS,
};
