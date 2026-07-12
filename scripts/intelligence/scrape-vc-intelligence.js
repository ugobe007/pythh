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
 *   node scripts/intelligence/scrape-vc-intelligence.js --no-dedup   # scrape every row (legacy)
 *   node scripts/intelligence/scrape-vc-intelligence.js --stale-days=7  # skip firms scraped within 7d
 *   node scripts/intelligence/scrape-vc-intelligence.js --stale-days=0   # force full refresh
 *   node scripts/intelligence/scrape-vc-intelligence.js --resume         # continue after interrupt
 *   node scripts/intelligence/scrape-vc-intelligence.js --firm-offset=24 # skip first N firms
 *
 * Firm dedup: person-at-firm rows sharing the same domain are scraped once and
 * fan-out saved to all matching investor_ids (see lib/investorFirmDedup.mjs).
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
} = require('../../lib/investorUniverse.mjs');
const { groupInvestorsByFirm } = require('../../lib/investorFirmDedup.mjs');
const { isGarbageInvestorName } = require('../../lib/investorNameHeuristics.js');

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT   = parseLimitArg(process.argv.slice(2), { defaultZero: true });
const OFFSET  = parseOffsetArg(process.argv.slice(2));
const COHORT  = parseCohortArg(process.argv.slice(2));
const FIRM_FILTER = (process.argv.find(a => a.startsWith('--firm=')) || '').replace('--firm=', '').toLowerCase();
const NO_DEDUP = process.argv.includes('--no-dedup');
const STALE_DAYS = (() => {
  const a = process.argv.find((x) => x.startsWith('--stale-days='));
  if (!a) return 7; // default: skip firms scraped in the last week
  const n = parseInt(a.split('=')[1], 10);
  return Number.isFinite(n) && n >= 0 ? n : 7;
})();
const fs = require('fs');

const CHECKPOINT_PATH = process.env.VC_SCRAPE_CHECKPOINT || '/tmp/vc-scrape-checkpoint.json';
const RESUME = process.argv.includes('--resume');
const FIRM_OFFSET = (() => {
  const a = process.argv.find((x) => x.startsWith('--firm-offset='));
  return a ? Math.max(0, parseInt(a.split('=')[1], 10) || 0) : 0;
})();
const FIRM_TIMEOUT_MS = 45_000;
const CONCURRENCY = 4;
const TIMEOUT_MS = 12_000;

function loadCheckpoint() {
  try {
    if (!fs.existsSync(CHECKPOINT_PATH)) return null;
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveCheckpoint(state) {
  try {
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn(`  ⚠ checkpoint write failed: ${e.message}`);
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms (${label})`)), ms)
    ),
  ]);
}

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
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
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

// ── Scrape firm content once (shared across investor rows) ───────────────────
async function scrapeFirmContent({ firmName, domain, firmUrl }) {
  let rss_articles = [];
  if (domain) {
    const rssUrl = await discoverRssFeed(domain);
    if (rssUrl) {
      const xml = await fetchText(rssUrl);
      rss_articles = parseRssItems(xml, 12);
      console.log(`    RSS: ${rss_articles.length} articles from ${rssUrl}`);
    }
  }

  const newsArticles = await scrapeGoogleNews(firmName);
  console.log(`    News: ${newsArticles.length} articles`);

  const registry = domain ? VC_BLOG_REGISTRY[domain] : null;
  const blogText = await scrapeBlogHomepage(registry?.blog || (domain ? `https://${domain}/blog` : null));

  const allText = [
    ...rss_articles.map(a => `${a.title} ${a.excerpt}`),
    ...newsArticles.map(a => `${a.title} ${a.excerpt}`),
    blogText,
  ].join(' ');

  const signals = extractSignals(allText);

  const words = allText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const stopWords = new Set(['that','this','with','from','have','been','will','they','their','more','about','some','into','what','when','there','which','than','your','also','such','even','most','these','those','only','over','just','would','could','should','make','very','here','like','much','well','then','were','also','each']);
  const language_patterns = Object.entries(freq)
    .filter(([w]) => !stopWords.has(w))
    .sort(([,a],[,b]) => b - a)
    .slice(0, 30)
    .map(([phrase, frequency]) => ({ phrase, frequency }));

  return {
    rss_articles,
    blog_posts: newsArticles,
    portfolio_signals: [{ signals, source: 'text_analysis' }],
    language_patterns,
    source_count: rss_articles.length + newsArticles.length,
    scraped_at: new Date().toISOString(),
    confidence: Math.min(1, (rss_articles.length * 0.08 + newsArticles.length * 0.04 + (blogText.length > 1000 ? 0.2 : 0))),
    firm_url: firmUrl || null,
    firm_name: firmName,
    _signals: signals,
  };
}

async function saveFirmScrapeForInvestors(group, content) {
  const rows = group.investors.map((inv) => ({
    investor_id: inv.id,
    firm_name: content.firm_name,
    firm_url: content.firm_url,
    rss_articles: content.rss_articles,
    blog_posts: content.blog_posts,
    portfolio_signals: content.portfolio_signals,
    language_patterns: content.language_patterns,
    source_count: content.source_count,
    scraped_at: content.scraped_at,
    confidence: content.confidence,
  }));

  if (DRY_RUN) {
    console.log(`    [dry-run] signals: ${content._signals.join(', ')}`);
    return rows;
  }

  const client = sb();
  const { error } = await client.from('vc_intelligence').upsert(rows, { onConflict: 'investor_id', ignoreDuplicates: false });
  if (error) {
    console.error(`    ✗ DB error: ${error.message}`);
  } else {
    const n = group.investors.length;
    const label = n > 1 ? ` → ${n} investors` : '';
    console.log(`    ✅ Saved${label} (${content._signals.length} signals, confidence ${content.confidence.toFixed(2)})`);
  }
  return rows;
}

async function scrapeFirmGroup(group) {
  const aliasNote = group.investors.length > 1 ? ` [${group.investors.length} rows]` : '';
  console.log(`  → ${group.firmName} (${group.domain || 'no domain'})${aliasNote}`);

  const content = await scrapeFirmContent({
    firmName: group.firmName,
    domain: group.domain,
    firmUrl: group.firmUrl,
  });

  await saveFirmScrapeForInvestors(group, content);
  return content;
}

async function scrapeFirmGroupSafe(group) {
  try {
    return await withTimeout(scrapeFirmGroup(group), FIRM_TIMEOUT_MS, group.firmName);
  } catch (e) {
    console.error(`  ✗ ${group.firmName}: ${e.message}`);
    return null;
  }
}

async function runBatch(items, concurrency, fn, { onBatchDone } = {}) {
  const total = items.length;
  const batches = Math.ceil(total / concurrency);
  for (let i = 0; i < items.length; i += concurrency) {
    const batchNum = Math.floor(i / concurrency) + 1;
    const slice = items.slice(i, i + concurrency);
    const started = Date.now();
    console.log(`\n  [batch ${batchNum}/${batches}] ${slice.map((g) => g.firmName).join(' · ')}`);
    await Promise.allSettled(slice.map(fn));
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`  [batch ${batchNum}/${batches} done in ${elapsed}s]`);
    if (onBatchDone) onBatchDone({ batchNum, batches, slice, elapsed: Number(elapsed) });
  }
}

/** @param {ReturnType<typeof sb>} client @param {string[]} investorIds */
async function loadFreshInvestorIds(client, investorIds, staleDays) {
  if (!staleDays || !investorIds.length) return new Set();
  const cutoff = new Date(Date.now() - staleDays * 86400000).toISOString();
  const fresh = new Set();
  const chunkSize = 200;

  for (let i = 0; i < investorIds.length; i += chunkSize) {
    const chunk = investorIds.slice(i, i + chunkSize);
    let data = null;
    let lastErr = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await client
        .from('vc_intelligence')
        .select('investor_id')
        .in('investor_id', chunk)
        .gte('scraped_at', cutoff);
      if (!res.error) {
        data = res.data;
        lastErr = null;
        break;
      }
      lastErr = res.error;
      const delay = attempt * 1500;
      console.warn(`  ⚠ stale lookup attempt ${attempt}/3 failed: ${res.error.message} — retry in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    if (lastErr) {
      console.warn(
        `  ⚠ stale lookup unavailable (${lastErr.message}) — skipping scrape this run (assume firms are fresh)`
      );
      return new Set(investorIds);
    }

    for (const row of data || []) fresh.add(row.investor_id);
  }
  return fresh;
}

async function main() {
  console.log('🔍 VC Intelligence Scraper');
  console.log('═'.repeat(50));
  console.log('Run at:', new Date().toISOString());
  if (DRY_RUN) console.log('⚠️  DRY-RUN mode — no DB writes');
  if (FIRM_FILTER) console.log('Filter:', FIRM_FILTER);
  if (STALE_DAYS > 0) console.log(`Stale skip: firms scraped within ${STALE_DAYS}d`);
  else console.log('Stale skip: off (full refresh)');
  if (RESUME) console.log(`Resume: ${CHECKPOINT_PATH}`);
  if (FIRM_OFFSET > 0) console.log(`Firm offset: ${FIRM_OFFSET}`);
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

  const junkSkipped = investors.filter((inv) => isGarbageInvestorName(inv.name)).length;
  investors = investors.filter((inv) => !isGarbageInvestorName(inv.name));

  if (!investors?.length) { console.log('No investors found.'); process.exit(0); }

  const firmGroups = NO_DEDUP
    ? investors.map((inv) => ({
        dedupKey: `investor:${inv.id}`,
        firmName: inv.firm || inv.name || '',
        firmUrl: inv.url || null,
        domain: null,
        registryKey: null,
        investors: [inv],
      }))
    : groupInvestorsByFirm(investors);

  let groupsToScrape = firmGroups;
  let freshSkipped = 0;
  if (STALE_DAYS > 0) {
    const allIds = firmGroups.flatMap((g) => g.investors.map((i) => i.id));
    const freshIds = await loadFreshInvestorIds(client, allIds, STALE_DAYS);
    groupsToScrape = firmGroups.filter(
      (g) => !g.investors.some((inv) => freshIds.has(inv.id))
    );
    freshSkipped = firmGroups.length - groupsToScrape.length;
  }

  const aliasRows = investors.length - firmGroups.length;
  console.log(`Scraping ${investors.length} investor rows → ${firmGroups.length} unique firms (cohort ${COHORT})...`);
  if (junkSkipped > 0) console.log(`   junk names skipped: ${junkSkipped} rows (not yet quarantined in DB)`);
  if (aliasRows > 0 && !NO_DEDUP) console.log(`   firm dedup: ${aliasRows} duplicate domain rows collapsed`);
  if (freshSkipped > 0) console.log(`   stale skip: ${freshSkipped} firms scraped within ${STALE_DAYS}d`);
  console.log(`   will scrape: ${groupsToScrape.length} firms\n`);

  if (!groupsToScrape.length) {
    console.log('Nothing stale to scrape.');
    process.exit(0);
  }

  let startOffset = FIRM_OFFSET;
  if (RESUME) {
    const cp = loadCheckpoint();
    if (cp?.nextFirmOffset != null) {
      startOffset = Math.max(startOffset, cp.nextFirmOffset);
      console.log(`   resuming from firm ${startOffset + 1}/${groupsToScrape.length} (${cp.firmName || 'checkpoint'})\n`);
    }
  }
  if (startOffset > 0) {
    groupsToScrape = groupsToScrape.slice(startOffset);
  }

  if (!groupsToScrape.length) {
    console.log('Nothing left to scrape at this offset.');
    process.exit(0);
  }

  let done = 0;
  await runBatch(groupsToScrape, CONCURRENCY, scrapeFirmGroupSafe, {
    onBatchDone: ({ batchNum, batches, slice, elapsed }) => {
      const last = slice[slice.length - 1];
      saveCheckpoint({
        nextFirmOffset: Math.min(startOffset + batchNum * CONCURRENCY, startOffset + groupsToScrape.length),
        firmName: last?.firmName || null,
        batch: batchNum,
        batches,
        elapsed_s: elapsed,
        updated_at: new Date().toISOString(),
      });
    },
  });

  for (const group of groupsToScrape) {
    done += group.investors.length;
  }

  try {
    if (fs.existsSync(CHECKPOINT_PATH)) fs.unlinkSync(CHECKPOINT_PATH);
  } catch { /* ignore */ }

  console.log(
    `\n✅ Done — ${done}/${investors.length} investor rows scraped (${groupsToScrape.length} firms this run, offset ${startOffset})`
  );
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
