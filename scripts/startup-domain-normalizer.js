#!/usr/bin/env node
/**
 * STARTUP DOMAIN NORMALIZER v2
 * ============================
 * Purpose:
 *   - Derive canonical company_domain from messy inputs (website/source_url/linkedin/text)
 *   - Prevent publisher/article domains from polluting RSS discovery + HN search
 *
 * Two-pass approach:
 *   Pass 1: Extract all candidate URLs/domains from fields + text
 *   Pass 2: Score candidates, apply guardrails, pick best company_domain
 *
 * Outputs:
 *   - company_domain (string|null)
 *   - company_domain_confidence (0.0–1.0)
 *   - domain_source ('website'|'linkedin'|'text'|'source_url'|'inferred'|'none')
 *   - discovery_source_url (string|null)  // where it was found (article URL, etc.)
 *   - domain_candidates (evidence)
 *
 * USAGE (module):
 *   const { normalizeCompanyDomain } = require('./startup-domain-normalizer');
 *   const out = normalizeCompanyDomain(startupRow);
 *
 * USAGE (CLI):
 *   node scripts/startup-domain-normalizer.js --id=UUID
 *   node scripts/startup-domain-normalizer.js --report
 */

const { URL } = require('url');

// ─────────────────────────────────────────────────────────────────────────────
// 1) Publisher / platform domains (cannot be company_domain)
//    NOTE: keep this list conservative; expand as you observe false hits.
// ─────────────────────────────────────────────────────────────────────────────
const PUBLISHER_DOMAINS = new Set([
  // Major tech news / startup databases
  'techcrunch.com',
  'venturebeat.com',
  'thenextweb.com',
  'theinformation.com',
  'forbes.com',
  'bloomberg.com',
  'wsj.com',
  'ft.com',
  'reuters.com',
  'businessinsider.com',
  'fastcompany.com',
  'inc.com',
  'wired.com',
  'axios.com',
  'fortune.com',
  'tech.eu',
  'eu-startups.com',
  'sifted.eu',
  'startupstash.com',
  'producthunt.com',
  'crunchbase.com',
  'pitchbook.com',
  'tracxn.com',
  'dealroom.co',
  'angel.co',
  'wellfound.com',
  'f6s.com',

  // Blog platforms
  'medium.com',
  'substack.com',
  'wordpress.com',
  'blogspot.com',

  // Social / video / code hosting (not company domain)
  'linkedin.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'youtu.be',
  'github.com',
  'gitlab.com',
  'bitbucket.org',

  // Generic link shorteners / redirectors
  't.co',
  'bit.ly',
  'tinyurl.com',
  'lnkd.in',

  // News aggregators / HN
  'news.ycombinator.com',
  'ycombinator.com',
  'news.google.com',
  'google.com',

  // Startup news sources seen in our data
  'pulse2.com',
  'siliconangle.com',
  'prnewswire.com',
  'businesswire.com',
  'globenewswire.com',
  'accesswire.com',
  'pymnts.com',
  'zdnet.com',
  'arstechnica.com',
  'theverge.com',
  'cnbc.com',
  'nytimes.com',
  'bbc.com',
  'bbc.co.uk',
  'theguardian.com',
  'cnn.com',
  'marketwatch.com',
  'seekingalpha.com',
  'finance.yahoo.com',

  // Dev/tech platforms
  'dev.to',
  'hackernoon.com',
  'techmeme.com',

  // URL redirect / forward services
  'gofwd.to',
]);

// Common "company" subdomain patterns on known platforms (also disallowed)
const DISALLOWED_HOST_SUFFIXES = [
  '.medium.com',
  '.substack.com',
  '.wordpress.com',
  '.blogspot.com',
];

// ─────────────────────────────────────────────────────────────────────────────
// 2) Helpers: URL extraction, domain normalization, tokenization
// ─────────────────────────────────────────────────────────────────────────────

function safeString(x) {
  return typeof x === 'string' ? x : '';
}

function extractUrls(text) {
  const t = safeString(text);
  if (!t) return [];
  // Basic URL finder: captures http(s)://... and bare domains like example.com/path
  const urls = [];
  const re = /((https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,})(\/[^\s)"']*)?/gi;
  let m;
  while ((m = re.exec(t)) !== null) {
    const full = (m[0] || '').trim();
    if (!full) continue;
    urls.push(full);
  }
  return Array.from(new Set(urls));
}

function toUrlish(str) {
  const s = safeString(str).trim();
  if (!s) return null;
  // If missing scheme but looks like a domain, add https://
  if (!/^https?:\/\//i.test(s) && /^[a-z0-9-]+\.[a-z]{2,}/i.test(s)) {
    return `https://${s}`;
  }
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

function normalizeHost(host) {
  if (!host) return null;
  let h = host.toLowerCase().trim();
  if (h.startsWith('www.')) h = h.slice(4);
  // Strip trailing dot
  h = h.replace(/\.$/, '');
  return h || null;
}

function getHostAndPath(urlStr) {
  const u = toUrlish(urlStr);
  if (!u) return null;
  try {
    const parsed = new URL(u);
    return {
      host: normalizeHost(parsed.hostname),
      path: parsed.pathname || '/',
      href: parsed.href,
    };
  } catch {
    return null;
  }
}

function isPublisherDomain(host) {
  if (!host) return true;
  if (PUBLISHER_DOMAINS.has(host)) return true;
  if (DISALLOWED_HOST_SUFFIXES.some(suf => host.endsWith(suf))) return true;
  return false;
}

function pathDepth(path) {
  if (!path) return 0;
  const cleaned = path.split('?')[0].split('#')[0];
  const parts = cleaned.split('/').filter(Boolean);
  return parts.length;
}

function normalizeNameTokens(name) {
  const n = safeString(name).toLowerCase();
  if (!n) return [];
  // remove punctuation, split
  return n
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(tok => tok.length >= 3 && !['inc', 'llc', 'ltd', 'gmbh', 'corp', 'co', 'company'].includes(tok));
}

function domainMatchesName(host, nameTokens) {
  if (!host || nameTokens.length === 0) return false;
  const bare = host.replace(/\.[a-z]{2,}$/, ''); // remove last TLD-ish chunk for rough match
  return nameTokens.some(tok => bare.includes(tok));
}

function extractEmailDomains(text) {
  const t = safeString(text);
  if (!t) return [];
  const re = /[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/gi;
  const out = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    const host = normalizeHost(m[1]);
    if (host) out.push(host);
  }
  return Array.from(new Set(out));
}

function looksLikeCompanyHomepageContext(context) {
  // heuristic phrases around links that suggest "this is the company site"
  const c = safeString(context).toLowerCase();
  return /(\bvisit\b|\bwebsite\b|\bhomepage\b|\bsite\b|\blearn more\b|\btry\b|\bget started\b|\bbook a demo\b|\bcontact\b)/i.test(c);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Candidate extraction from startup row
// ─────────────────────────────────────────────────────────────────────────────

function extractCandidates(startup) {
  const name = safeString(startup.name);
  const nameTokens = normalizeNameTokens(name);

  const fields = [
    { key: 'website', text: safeString(startup.website) },
    { key: 'source_url', text: safeString(startup.source_url) },
    { key: 'linkedin', text: safeString(startup.linkedin) },
    { key: 'tagline', text: safeString(startup.tagline) },
    { key: 'pitch', text: safeString(startup.pitch) },
    { key: 'description', text: safeString(startup.description) },
  ];

  const candidates = [];
  const discoveryUrls = [];

  // Extract URL-based candidates
  for (const f of fields) {
    const urls = extractUrls(f.text);
    for (const u of urls) {
      const hp = getHostAndPath(u);
      if (!hp || !hp.host) continue;

      const pub = isPublisherDomain(hp.host);
      const depth = pathDepth(hp.path);

      // Track likely discovery source URLs (articles often have deeper paths)
      if ((f.key === 'source_url' || f.key === 'website') && (pub || depth >= 2)) {
        // keep the full href as potential discovery source
        discoveryUrls.push(hp.href);
      }

      candidates.push({
        kind: 'url',
        source_field: f.key,
        host: hp.host,
        href: hp.href,
        path: hp.path,
        path_depth: depth,
        is_publisher: pub,
        name_match: domainMatchesName(hp.host, nameTokens),
        homepage_context: (f.key === 'website' || f.key === 'tagline') ? looksLikeCompanyHomepageContext(f.text) : false,
        score: 0,
        reasons: [],
      });
    }
  }

  // Extract email-domain candidates from text fields
  const textBlob = [startup.tagline, startup.pitch, startup.description].map(safeString).join('\n');
  const emailHosts = extractEmailDomains(textBlob);
  for (const host of emailHosts) {
    candidates.push({
      kind: 'email',
      source_field: 'text',
      host,
      href: null,
      path: null,
      path_depth: 0,
      is_publisher: isPublisherDomain(host),
      name_match: domainMatchesName(host, nameTokens),
      homepage_context: true,
      score: 0,
      reasons: ['email_domain'],
    });
  }

  return {
    nameTokens,
    candidates: dedupeCandidates(candidates),
    discoveryUrls: Array.from(new Set(discoveryUrls)),
  };
}

function dedupeCandidates(cands) {
  const byHost = new Map();
  for (const c of cands) {
    const key = `${c.host}::${c.kind}`;
    // Keep the best-scoring later; for now keep first and merge reasons
    if (!byHost.has(key)) byHost.set(key, c);
    else {
      const prev = byHost.get(key);
      prev.reasons = Array.from(new Set([...(prev.reasons || []), ...(c.reasons || [])]));
      // prefer shallower path (more homepage-like) if both are urls
      if (prev.kind === 'url' && c.kind === 'url' && c.path_depth < prev.path_depth) {
        prev.href = c.href;
        prev.path = c.path;
        prev.path_depth = c.path_depth;
        prev.source_field = prev.source_field || c.source_field;
      }
      byHost.set(key, prev);
    }
  }
  return Array.from(byHost.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Scoring + selection
// ─────────────────────────────────────────────────────────────────────────────

function scoreCandidates(candidates) {
  for (const c of candidates) {
    let score = 0;
    const reasons = [];

    // Hard reject publishers
    if (c.is_publisher) {
      c.score = -100;
      c.reasons = Array.from(new Set([...(c.reasons || []), 'publisher_domain']));
      continue;
    }

    // Source priors
    if (c.source_field === 'website') { score += 4; reasons.push('source=website'); }
    else if (c.source_field === 'linkedin') { score += 5; reasons.push('source=linkedin'); }
    else if (c.source_field === 'text') { score += 3; reasons.push('source=text'); }
    else if (c.source_field === 'source_url') { score += 1; reasons.push('source=source_url'); }
    else { score += 1; reasons.push('source=other'); }

    // URL depth penalty (articles have deeper paths)
    if (c.kind === 'url') {
      if (c.path_depth === 0 || c.path_depth === 1) { score += 2; reasons.push('shallow_path'); }
      else if (c.path_depth >= 2) { score -= 3; reasons.push('deep_path'); }
    }

    // Name match bonus
    if (c.name_match) { score += 3; reasons.push('name_match'); }

    // Homepage context bonus
    if (c.homepage_context) { score += 2; reasons.push('homepage_context'); }

    // Email domain is very strong when not a publisher
    if (c.kind === 'email') { score += 5; reasons.push('email_domain_strong'); }

    // Penalize suspicious "platform" subdomains (even if not in publisher list)
    // e.g., pages on notion.site, webflow.io, etc. (optional; keep conservative)
    if (/\b(notionsite|notion\.site|webflow\.io|wixsite\.com|squarespace\.com)\b/i.test(c.host)) {
      score -= 4; reasons.push('hosted_platform_domain');
    }

    c.score = score;
    c.reasons = Array.from(new Set([...(c.reasons || []), ...reasons]));
  }
  return candidates;
}

function pickBestCompanyDomain(candidates) {
  if (!candidates || candidates.length === 0) return null;
  const scored = scoreCandidates([...candidates]);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: prefer website/linkedin sources
    const pri = (x) => x.source_field === 'linkedin' ? 0 : x.source_field === 'website' ? 1 : x.source_field === 'text' ? 2 : 3;
    const pd = pri(a) - pri(b);
    if (pd !== 0) return pd;
    // Tie-break: prefer shallower paths
    return (a.path_depth || 0) - (b.path_depth || 0);
  });

  const best = scored[0];
  if (!best || best.score < 4) return null; // threshold to avoid bad picks
  return best;
}

function scoreToConfidence(score) {
  // Map score roughly 0..12 => 0..1 (cap)
  if (score <= 0) return 0;
  const conf = Math.min(1.0, score / 10);
  // Avoid overconfidence early
  return Math.round(conf * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) Public API: normalizeCompanyDomain
// ─────────────────────────────────────────────────────────────────────────────

function normalizeCompanyDomain(startup) {
  const { candidates, discoveryUrls } = extractCandidates(startup);
  const best = pickBestCompanyDomain(candidates);

  // Determine discovery_source_url
  // Prefer explicit source_url if it looks like an article (deep path or publisher)
  let discovery_source_url = null;
  const sourceHp = getHostAndPath(startup.source_url);
  if (sourceHp && (isPublisherDomain(sourceHp.host) || pathDepth(sourceHp.path) >= 2)) {
    discovery_source_url = sourceHp.href;
  } else {
    // else choose the most "article-like" among captured discovery URLs
    const scoredDiscovery = discoveryUrls
      .map(u => getHostAndPath(u))
      .filter(Boolean)
      .map(hp => ({
        href: hp.href,
        host: hp.host,
        isPublisher: isPublisherDomain(hp.host),
        depth: pathDepth(hp.path),
      }))
      .sort((a, b) => {
        // prefer publisher + deeper
        if (a.isPublisher !== b.isPublisher) return (b.isPublisher ? 1 : 0) - (a.isPublisher ? 1 : 0);
        return b.depth - a.depth;
      });

    discovery_source_url = scoredDiscovery.length ? scoredDiscovery[0].href : null;
  }

  if (!best) {
    return {
      company_domain: null,
      company_domain_confidence: 0,
      domain_source: 'none',
      discovery_source_url,
      domain_candidates: candidates.map(c => pickCandidateEvidence(c)),
    };
  }

  const domain_source =
    best.source_field === 'linkedin' ? 'linkedin' :
    best.source_field === 'website' ? 'website' :
    best.source_field === 'text' ? 'text' :
    best.source_field === 'source_url' ? 'source_url' :
    'inferred';

  return {
    company_domain: best.host,
    company_domain_confidence: scoreToConfidence(best.score),
    domain_source,
    discovery_source_url,
    domain_candidates: candidates
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 12)
      .map(c => pickCandidateEvidence(c)),
  };
}

function pickCandidateEvidence(c) {
  return {
    host: c.host,
    kind: c.kind,
    source_field: c.source_field,
    score: c.score,
    is_publisher: !!c.is_publisher,
    path_depth: c.path_depth,
    name_match: !!c.name_match,
    href: c.href ? c.href.substring(0, 200) : null,
    reasons: (c.reasons || []).slice(0, 10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) CLI
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  require('dotenv').config();
  const { createClient } = require('@supabase/supabase-js');

  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doReport = args.includes('--report');
  const idArg = args.find(a => a.startsWith('--id='));
  const startupId = idArg ? idArg.split('=')[1] : null;

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  STARTUP DOMAIN NORMALIZER v2                ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  if (!doApply) console.log('🔍 DRY RUN — use --apply to write\n');

  let query = supabase.from('startup_uploads').select('*');
  if (startupId) query = query.eq('id', startupId);
  query = query.order('created_at', { ascending: false });

  const { data: rows, error } = await query;
  if (error) {
    console.error('DB Error:', error.message);
    process.exit(1);
  }

  console.log(`📦 Analyzing ${rows.length} startups\n`);

  const results = [];
  let assigned = 0, nulls = 0, publisherBlocks = 0;

  for (const row of rows) {
    const out = normalizeCompanyDomain(row);
    results.push({ row, out });
    if (out.company_domain) assigned++;
    else nulls++;

    // Count if top candidates were publishers (indicates messy input)
    const top = (out.domain_candidates || [])[0];
    if (top && top.is_publisher) publisherBlocks++;

    if (rows.length <= 20 || startupId) {
      console.log(`━━━ ${row.name} ━━━`);
      console.log(`   website:   ${safeString(row.website).substring(0, 90)}`);
      console.log(`   source_url:${safeString(row.source_url).substring(0, 90)}`);
      console.log(`   linkedin:  ${safeString(row.linkedin).substring(0, 90)}`);
      console.log(`   company_domain: ${out.company_domain || 'NULL'} (conf ${out.company_domain_confidence}) source=${out.domain_source}`);
      console.log(`   discovery_source_url: ${out.discovery_source_url || 'NULL'}`);
      if (out.domain_candidates && out.domain_candidates.length) {
        console.log(`   candidates:`);
        for (const c of out.domain_candidates.slice(0, 6)) {
          console.log(`     - ${c.host.padEnd(28)} score=${String(c.score).padStart(3)} pub=${c.is_publisher ? 'Y' : 'N'} src=${c.source_field} reasons=${(c.reasons||[]).join('|')}`);
        }
      }
      console.log('');
    }

    if (doApply) {
      const patch = {
        company_domain: out.company_domain,
        company_domain_confidence: out.company_domain_confidence,
        domain_source: out.domain_source,
        discovery_source_url: out.discovery_source_url,
        domain_candidates: out.domain_candidates,
      };

      const { error: upErr } = await supabase
        .from('startup_uploads')
        .update(patch)
        .eq('id', row.id);

      if (upErr) {
        console.error(`Update failed for ${row.id}:`, upErr.message);
      }
    }
  }

  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  SUMMARY${doApply ? '' : ' (DRY RUN)'}                                ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Total:          ${rows.length}`);
  console.log(`  Assigned:       ${assigned} (${rows.length ? (assigned / rows.length * 100).toFixed(1) : '0.0'}%)`);
  console.log(`  NULL:           ${nulls} (${rows.length ? (nulls / rows.length * 100).toFixed(1) : '0.0'}%)`);
  console.log(`  Publisher top:  ${publisherBlocks}`);

  if (doReport) {
    const fs = require('fs');
    const path = require('path');
    const outDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const csvPath = path.join(outDir, 'startup-domain-normalizer-v2-report.csv');
    const header = 'Name,CompanyDomain,Confidence,DomainSource,DiscoverySourceUrl,Website,SourceUrl,LinkedIn\n';
    const lines = results.map(({ row, out }) => {
      const esc = (s) => `"${safeString(s).replace(/"/g, '""')}"`;
      return [
        esc(row.name),
        esc(out.company_domain || ''),
        out.company_domain_confidence,
        esc(out.domain_source || ''),
        esc(out.discovery_source_url || ''),
        esc(row.website || ''),
        esc(row.source_url || ''),
        esc(row.linkedin || ''),
      ].join(',');
    }).join('\n');

    fs.writeFileSync(csvPath, header + lines);
    console.log(`\n✅ Report: data/startup-domain-normalizer-v2-report.csv`);
  }

  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  PUBLISHER_DOMAINS,
  normalizeCompanyDomain,
  extractCandidates,
  extractUrls,
  getHostAndPath,
  isPublisherDomain,
  scoreCandidates,
  pickBestCompanyDomain,
  scoreToConfidence,
};

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
