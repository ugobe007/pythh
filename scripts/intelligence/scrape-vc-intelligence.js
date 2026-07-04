#!/usr/bin/env node
/**
 * VC Intelligence Scraper
 *
 * FBI-style profiling: scrapes VC blogs, RSS feeds, and public writing
 * to extract how each investor thinks, what they value, and what they avoid.
 *
 * Sources per firm:
 *   - Firm RSS/blog feed (most authoritative)
 *   - Google News RSS (recent coverage + quotes)
 *   - Known VC blog URLs (hardcoded for top firms)
 *
 * Writes raw scraped data to: vc_intelligence
 * Then triggers: build-vc-profiles.js (LLM profiling step)
 *
 * Usage:
 *   node scripts/intelligence/scrape-vc-intelligence.js              # all investors with URLs
 *   node scripts/intelligence/scrape-vc-intelligence.js --limit=20   # first N
 *   node scripts/intelligence/scrape-vc-intelligence.js --firm="a16z" # single firm
 *   node scripts/intelligence/scrape-vc-intelligence.js --dry-run
 */

'use strict';
require('dotenv').config();

const https   = require('https');
const http    = require('http');
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');
const {
  fetchInvestorUniverse,
  parseLimitArg,
  parseOffsetArg,
  parseCohortArg,
} = require('../lib/investorUniverse.mjs');

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT   = parseLimitArg(process.argv.slice(2), { defaultZero: true });
const OFFSET  = parseOffsetArg(process.argv.slice(2));
const COHORT  = parseCohortArg(process.argv.slice(2));
const FIRM_FILTER = (process.argv.find(a => a.startsWith('--firm=')) || '').replace('--firm=', '').toLowerCase();
const CONCURRENCY = 4;
const TIMEOUT_MS  = 12_000;

// ── Known VC blog/RSS endpoints ─────────────────────────────────────────────
// These are the primary intelligence sources we care about most.
const VC_BLOG_REGISTRY = {
  'a16z.com':           { rss: 'https://a16z.com/feed/', blog: 'https://a16z.com/insights/' },
  'sequoiacap.com':     { rss: 'https://www.sequoiacap.com/feed/', blog: 'https://www.sequoiacap.com/grove/' },
  'firstround.com':     { rss: 'https://review.firstround.com/feed.xml', blog: 'https://review.firstround.com/' },
  'ycombinator.com':    { rss: 'https://www.ycombinator.com/blog/feed', blog: 'https://www.ycombinator.com/blog' },
  'benchmark.com':      { rss: 'https://benchmark.com/feed', blog: 'https://benchmark.com/blog' },
  'accel.com':          { rss: 'https://www.accel.com/insights/rss', blog: 'https://www.accel.com/insights' },
  'greylock.com':       { rss: 'https://greylock.com/feed/', blog: 'https://greylock.com/greymatter/' },
  'kpcb.com':           { rss: 'https://www.kleinerperkins.com/feed/', blog: 'https://www.kleinerperkins.com/perspectives/' },
  'nea.com':            { rss: 'https://www.nea.com/feed/', blog: 'https://www.nea.com/insights' },
  'bessemervp.com':     { rss: 'https://www.bvp.com/feed', blog: 'https://www.bvp.com/atlas' },
  'generalcatalyst.com':{ rss: 'https://www.generalcatalyst.com/feed', blog: 'https://www.generalcatalyst.com/thinking' },
  'lsvp.com':           { rss: 'https://lsvp.com/feed/', blog: 'https://lsvp.com/stories/' },
  'indexventures.com':  { rss: 'https://www.indexventures.com/perspectives/feed/', blog: 'https://www.indexventures.com/perspectives/' },
  'redpoint.com':       { rss: 'https://www.redpoint.com/feed/', blog: 'https://www.redpoint.com/blog/' },
  'founderfund.com':    { rss: 'https://foundersfund.com/feed/', blog: 'https://foundersfund.com/writing/' },
  'usv.com':            { rss: 'https://www.usv.com/feed.xml', blog: 'https://www.usv.com/writing/' },
  'sparkCapital.com':   { rss: 'https://spark.com/feed', blog: 'https://spark.com/blog' },
  'crv.com':            { rss: 'https://www.crv.com/feed/', blog: 'https://www.crv.com/blog/' },
  'felicis.com':        { rss: 'https://www.felicis.com/news/rss', blog: 'https://www.felicis.com/news' },
  'boldstart.vc':       { rss: 'https://www.boldstart.vc/feed/', blog: 'https://www.boldstart.vc/insights/' },
};

// Candidate RSS feed paths to try when firm URL doesn't match registry
const RSS_PROBES = ['/feed', '/feed/', '/blog/feed', '/blog/rss', '/rss', '/rss.xml', '/feed.xml', '/atom.xml'];

function sb() { return createClient(SB_URL, SB_KEY); }

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function fetchRaw(url, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Pythh-IntelBot/1.0 (research; contact: research@pythh.ai)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Follow one redirect
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          return fetchRaw(res.headers.location, timeoutMs).then(resolve).catch(reject);
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', d => { body += d; if (body.length > 400_000) req.destroy(); });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchText(url) {
  try {
    const { status, body } = await fetchRaw(url);
    return status >= 200 && status < 400 ? body : '';
  } catch { return ''; }
}

// ── RSS parsing ──────────────────────────────────────────────────────────────
function parseRssItems(xml, maxItems = 10) {
  const items = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  for (const m of itemMatches.slice(0, maxItems)) {
    const block = m[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
    const link  = (block.match(/<link>([^<]+)<\/link>/)  || [])[1]?.trim() || '';
    const date  = (block.match(/<pubDate>([^<]+)<\/pubDate>/) || [])[1]?.trim() || '';
    const desc  = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]?.trim() || '';
    if (title || link) {
      items.push({ title, url: link, date, excerpt: desc.replace(/<[^>]+>/g, '').slice(0, 500) });
    }
  }
  return items;
}

// ── Signal extraction from text ──────────────────────────────────────────────
const SIGNAL_PATTERNS = {
  founder_led:      /\b(founder[-\s]?led|founder-driven|operator|ex-founder|first[-\s]?time founder|repeat founder)\b/i,
  market_size:      /\b(large market|TAM|massive market|trillion[-\s]?dollar|billion[-\s]?dollar market|market size|market opportunity)\b/i,
  b2b_saas:         /\b(b2b|enterprise\s+saas|software[-\s]as[-\s]a[-\s]service|enterprise\s+software|recurring\s+revenue|ARR|MRR|SaaS)\b/i,
  deep_tech:        /\b(deep tech|deep[-\s]?tech|hard tech|defensible|moat|proprietary|IP|patent|technical\s+differentiation)\b/i,
  network_effects:  /\b(network effects|marketplace|platform|two[-\s]?sided|community|viral|flywheel)\b/i,
  revenue_first:    /\b(revenue|traction|ARR|customers?|paying\s+customers?|revenue\s+growth|top[-\s]?line)\b/i,
  team_first:       /\b(team|founders?|people|talent|operator|background|experience|domain\s+expertise)\b/i,
  vision:           /\b(vision|future|change the world|transform|category|defining|10x|revolutionary|paradigm)\b/i,
  contrarian:       /\b(contrarian|disagree|non[-\s]?obvious|others\s+miss|underestimated|overlooked|unpopular)\b/i,
  speed:            /\b(speed|velocity|fast|move fast|iterate|execute|ship fast|bias\s+to\s+action)\b/i,
  unit_economics:   /\b(unit economics|gross margin|LTV|CAC|burn|runway|profitability|efficiency)\b/i,
  climate:          /\b(climate|sustainability|clean energy|net zero|carbon|ESG|impact|green)\b/i,
  ai_ml:            /\b(AI|machine learning|LLM|GPT|foundation model|generative|artificial intelligence|ML|deep learning)\b/i,
  crypto_web3:      /\b(crypto|web3|blockchain|DeFi|NFT|token|decentralized)\b/i,
};

function extractSignals(text) {
  return Object.entries(SIGNAL_PATTERNS)
    .filter(([, re]) => re.test(text))
    .map(([signal]) => signal);
}

// ── Try to find RSS feed for a firm domain ───────────────────────────────────
async function discoverRssFeed(domain) {
  // Check registry first
  const known = VC_BLOG_REGISTRY[domain];
  if (known?.rss) return known.rss;

  // Try common probe paths
  for (const path of RSS_PROBES) {
    const url = `https://${domain}${path}`;
    const body = await fetchText(url);
    if (body.includes('<rss') || body.includes('<feed') || body.includes('<channel>')) {
      return url;
    }
  }
  return null;
}

// ── Google News RSS for a firm ────────────────────────────────────────────────
async function scrapeGoogleNews(firmName) {
  const q = encodeURIComponent(`"${firmName}" investment OR portfolio OR thesis OR investing`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  const body = await fetchText(url);
  return parseRssItems(body, 5);
}

// ── Scrape firm blog homepage for recent content ─────────────────────────────
async function scrapeBlogHomepage(blogUrl) {
  if (!blogUrl) return '';
  const body = await fetchText(blogUrl);
  // Extract text content (strip HTML)
  return body
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8_000);
}

// ── Main scrape routine for one investor ─────────────────────────────────────
async function scrapeInvestor(investor) {
  const { id: investor_id, name, url: firm_url, firm } = investor;
  const firmName = firm || name || '';
  const domain = firm_url ? (() => { try { return new URL(firm_url.startsWith('http') ? firm_url : `https://${firm_url}`).hostname.replace(/^www\./, ''); } catch { return null; } })() : null;

  console.log(`  → ${firmName} (${domain || 'no domain'})`);

  // ── Scrape RSS feed ──────────────────────────────────────────────────────
  let rss_articles = [];
  if (domain) {
    const rssUrl = await discoverRssFeed(domain);
    if (rssUrl) {
      const xml = await fetchText(rssUrl);
      rss_articles = parseRssItems(xml, 12);
      console.log(`    RSS: ${rss_articles.length} articles from ${rssUrl}`);
    }
  }

  // ── Scrape Google News ───────────────────────────────────────────────────
  const newsArticles = await scrapeGoogleNews(firmName);
  console.log(`    News: ${newsArticles.length} articles`);

  // ── Scrape blog homepage for thesis text ─────────────────────────────────
  const registry = domain ? VC_BLOG_REGISTRY[domain] : null;
  const blogText = await scrapeBlogHomepage(registry?.blog || (domain ? `https://${domain}/blog` : null));

  // ── Extract signals ──────────────────────────────────────────────────────
  const allText = [
    ...rss_articles.map(a => `${a.title} ${a.excerpt}`),
    ...newsArticles.map(a => `${a.title} ${a.excerpt}`),
    blogText,
  ].join(' ');

  const signals = extractSignals(allText);

  // ── Language patterns (top recurring phrases) ────────────────────────────
  const words = allText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const stopWords = new Set(['that','this','with','from','have','been','will','they','their','more','about','some','into','what','when','there','which','than','your','also','such','even','most','these','those','only','over','just','would','could','should','make','very','here','like','much','well','then','were','also','each']);
  const language_patterns = Object.entries(freq)
    .filter(([w]) => !stopWords.has(w))
    .sort(([,a],[,b]) => b - a)
    .slice(0, 30)
    .map(([phrase, frequency]) => ({ phrase, frequency }));

  const result = {
    investor_id,
    firm_name: firmName,
    firm_url: firm_url || null,
    rss_articles,
    blog_posts: newsArticles,
    portfolio_signals: [{ signals, source: 'text_analysis' }],
    language_patterns,
    source_count: rss_articles.length + newsArticles.length,
    scraped_at: new Date().toISOString(),
    confidence: Math.min(1, (rss_articles.length * 0.08 + newsArticles.length * 0.04 + (blogText.length > 1000 ? 0.2 : 0))),
  };

  if (!DRY_RUN) {
    const client = sb();
    const { error } = await client.from('vc_intelligence').upsert(result, { onConflict: 'investor_id', ignoreDuplicates: false });
    if (error) console.error(`    ✗ DB error: ${error.message}`);
    else console.log(`    ✅ Saved (${signals.length} signals, confidence ${result.confidence.toFixed(2)})`);
  } else {
    console.log(`    [dry-run] signals: ${signals.join(', ')}`);
  }

  return result;
}

async function runBatch(items, concurrency, fn) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
  }
}

async function main() {
  console.log('🔍 VC Intelligence Scraper');
  console.log('═'.repeat(50));
  console.log('Run at:', new Date().toISOString());
  if (DRY_RUN) console.log('⚠️  DRY-RUN mode — no DB writes');
  if (FIRM_FILTER) console.log('Filter:', FIRM_FILTER);
  console.log('');

  const client = sb();
  let investors = await fetchInvestorUniverse(client, {
    limit: LIMIT,
    offset: OFFSET,
    cohort: COHORT,
    requireUrl: true,
    staleFirst: true,
  });

  if (FIRM_FILTER) {
    investors = investors.filter((inv) => inv.name.toLowerCase().includes(FIRM_FILTER));
  }

  if (!investors?.length) { console.log('No investors found.'); process.exit(0); }

  console.log(`Scraping ${investors.length} investors (cohort ${COHORT})...\n`);

  let done = 0;
  await runBatch(investors, CONCURRENCY, async (inv) => {
    try {
      await scrapeInvestor(inv);
      done++;
    } catch (e) {
      console.error(`  ✗ Error on ${inv.name}:`, e.message);
    }
  });

  console.log(`\n✅ Done — ${done}/${investors.length} investors scraped`);
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
