#!/usr/bin/env node
/**
 * Hot Startup Discovery Agent
 *
 * Scours multiple intelligence sources to surface the hottest startups
 * that aren't yet in the Pythh database. Writes findings to hot_startup_discoveries.
 *
 * Sources:
 *   - ProductHunt daily digest (RSS)
 *   - Hacker News "Show HN" + top stories
 *   - TechCrunch / Crunchbase Daily (RSS)
 *   - VC portfolio announcement RSS (from vc_blog_registry)
 *   - Y Combinator batch announcements
 *   - RSS feeds already in Pythh's rss_sources table
 *
 * Usage:
 *   node scripts/intelligence/discover-hot-startups.js
 *   node scripts/intelligence/discover-hot-startups.js --dry-run
 *   node scripts/intelligence/discover-hot-startups.js --submit  # auto-submit to API
 */

'use strict';
require('dotenv').config();

const https   = require('https');
const http    = require('http');
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');

const SB_URL   = process.env.SUPABASE_URL;
const SB_KEY   = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3002';
const DRY_RUN  = process.argv.includes('--dry-run');
const AUTO_SUBMIT = process.argv.includes('--submit');
const CONCURRENCY = 6;
const TIMEOUT_MS  = 10_000;

// ── Intelligence source registry ─────────────────────────────────────────────
const DISCOVERY_SOURCES = [
  // Startup launch feeds
  { name: 'ProductHunt',       url: 'https://www.producthunt.com/feed', source: 'producthunt', heat_base: 70 },
  { name: 'HackerNews ShowHN', url: 'https://hnrss.org/show',          source: 'hackernews',  heat_base: 65 },
  { name: 'HackerNews Top',    url: 'https://hnrss.org/frontpage',      source: 'hackernews',  heat_base: 60 },

  // VC deal flow announcements
  { name: 'TechCrunch',       url: 'https://techcrunch.com/feed/',       source: 'techcrunch',  heat_base: 75 },
  { name: 'TechCrunch Startups', url: 'https://techcrunch.com/category/startups/feed/', source: 'techcrunch', heat_base: 80 },
  { name: 'VentureBeat',      url: 'https://venturebeat.com/feed/',      source: 'venturebeat', heat_base: 65 },
  { name: 'The Information',  url: 'https://www.theinformation.com/feed', source: 'theinformation', heat_base: 85 },

  // Crunchbase-style
  { name: 'Crunchbase News',  url: 'https://news.crunchbase.com/feed/',  source: 'crunchbase',  heat_base: 80 },

  // YC-specific
  { name: 'YC Blog',          url: 'https://www.ycombinator.com/blog/feed', source: 'yc',       heat_base: 90 },
  { name: 'YC News',          url: 'https://news.ycombinator.com/rss',      source: 'hackernews', heat_base: 70 },

  // VC deal announcement blogs
  { name: 'a16z',             url: 'https://a16z.com/feed/',             source: 'vc_rss',     heat_base: 85 },
  { name: 'Sequoia',          url: 'https://www.sequoiacap.com/feed/',   source: 'vc_rss',     heat_base: 85 },
  { name: 'First Round',      url: 'https://review.firstround.com/feed.xml', source: 'vc_rss', heat_base: 80 },
  { name: 'Accel',            url: 'https://www.accel.com/insights/rss', source: 'vc_rss',     heat_base: 80 },
  { name: 'Bessemer',         url: 'https://www.bvp.com/feed',           source: 'vc_rss',     heat_base: 80 },
  { name: 'GV (Google)',      url: 'https://www.gv.com/feed/',           source: 'vc_rss',     heat_base: 80 },
];

// Startup keyword signals
const STARTUP_RE = /\b(launch|series\s+[a-e]|seed\s+round|raises?\s+\$|pre[-\s]?seed|funding\s+round|backed\s+by|yc\s+(s|w)\d{2}|ycombinator|techstars|announced today|new\s+startup|founded|co-founded|seed\s+stage)\b/i;
const FUNDING_RE = /\$\s*(\d+(?:\.\d+)?)\s*(M|million|B|billion)\b/i;
const URL_RE     = /https?:\/\/(?:www\.)?([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2})?)/i;
const VC_RE      = /\b(a16z|sequoia|andreessen|first round|yc|ycombinator|accel|benchmark|lightspeed|greylock|khosla|kleiner|bessemer|general catalyst|tiger global|coatue|insight|softbank)\b/i;

function sb() { return createClient(SB_URL, SB_KEY); }

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error('bad url')); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers: { 'User-Agent': 'Pythh-DiscoveryBot/1.0' }, timeout: TIMEOUT_MS },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          return fetchRaw(res.headers.location).then(resolve).catch(reject);
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', d => { body += d; if (body.length > 300_000) req.destroy(); });
        res.on('end', () => resolve(body));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchText(url) {
  try { return await fetchRaw(url); } catch { return ''; }
}

function parseRssItems(xml, maxItems = 20) {
  const items = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].concat([...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]);
  for (const m of blocks.slice(0, maxItems)) {
    const block = m[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim().replace(/<[^>]+>/g, '') || '';
    const link  = (block.match(/<link>([^<]+)/) || block.match(/<link[^>]+href="([^"]+)"/) || [])[1]?.trim() || '';
    const date  = (block.match(/<pubDate>([^<]+)/) || block.match(/<published>([^<]+)/) || [])[1]?.trim() || '';
    const desc  = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) ||
                   block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1]?.replace(/<[^>]+>/g, '').trim() || '';
    if (title) items.push({ title, url: link, date, excerpt: desc.slice(0, 600) });
  }
  return items;
}

function calcHeatScore(item, baseHeat, text) {
  let score = baseHeat;
  if (FUNDING_RE.test(text)) {
    const m = text.match(FUNDING_RE);
    const amount = parseFloat(m[1]);
    const mult   = m[2].toLowerCase().startsWith('b') ? 1000 : 1;
    const amountM = amount * mult;
    if (amountM >= 100) score += 15;
    else if (amountM >= 10) score += 10;
    else score += 5;
  }
  if (VC_RE.test(text))        score += 8;
  if (/yc|ycombinator/i.test(text)) score += 12;
  if (/series\s+[a-e]/i.test(text)) score += 5;
  return Math.min(100, score);
}

function extractCompanyUrl(text, headline) {
  const m = (text + ' ' + headline).match(URL_RE);
  if (!m) return null;
  const domain = m[1];
  // Filter out news sites
  const news = ['techcrunch', 'venturebeat', 'producthunt', 'ycombinator', 'hackernews', 'crunchbase', 'google', 'theinformation', 'twitter', 'linkedin'];
  if (news.some(n => domain.includes(n))) return null;
  return `https://${domain}`;
}

function extractSectorGuess(text) {
  const sectorMap = [
    [/\b(AI|machine learning|LLM|GPT|generative)\b/i, 'AI/ML'],
    [/\b(fintech|payments?|banking|finance|crypto|DeFi)\b/i, 'Fintech'],
    [/\b(health|medical|biotech|pharma|clinical|drug)\b/i, 'Healthcare'],
    [/\b(climate|clean energy|renewable|solar|carbon)\b/i, 'Climate'],
    [/\b(saas|b2b|enterprise\s+software|productivity)\b/i, 'B2B SaaS'],
    [/\b(marketplace|platform|gig|on-demand)\b/i, 'Marketplace'],
    [/\b(developer|DevOps|API|infrastructure|cloud)\b/i, 'Developer Tools'],
    [/\b(gaming|game|esports|metaverse|VR|AR)\b/i, 'Gaming'],
    [/\b(edtech|education|learning|training)\b/i, 'EdTech'],
    [/\b(logistics|supply chain|delivery|shipping|freight)\b/i, 'Logistics'],
    [/\b(real estate|proptech|property)\b/i, 'PropTech'],
    [/\b(consumer|D2C|retail|e-?commerce)\b/i, 'Consumer'],
    [/\b(security|cybersecurity|privacy|threat)\b/i, 'Security'],
    [/\b(robotics|automation|manufacturing|hardware)\b/i, 'DeepTech/Hardware'],
    [/\b(biotech|genomics|gene|protein|drug discovery)\b/i, 'Biotech'],
  ];
  for (const [re, sector] of sectorMap) {
    if (re.test(text)) return sector;
  }
  return null;
}

function extractVcsMentioned(text) {
  const matches = [];
  const re = /\b(a16z|sequoia|andreessen horowitz|first round|yc|ycombinator|accel|benchmark|lightspeed|greylock|khosla|kleiner perkins|bessemer|general catalyst|tiger global|coatue|insight partners|softbank|founders fund|union square|usv|spark capital|index ventures|crv|felicis|battery ventures|general atlantic)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].toLowerCase().replace(/\s+/g, '_');
    if (!matches.includes(name)) matches.push(name);
  }
  return matches;
}

// ── Process one discovery source ─────────────────────────────────────────────
async function processSource(sourceConfig) {
  const { name, url, source, heat_base } = sourceConfig;
  const xml = await fetchText(url);
  if (!xml) { console.log(`  ${name}: no data`); return []; }

  const items = parseRssItems(xml, 25);
  const discoveries = [];

  for (const item of items) {
    const text = `${item.title} ${item.excerpt}`;
    if (!STARTUP_RE.test(text) && source !== 'producthunt') continue; // ProductHunt is all startups

    const signals = [];
    if (FUNDING_RE.test(text))          signals.push('funding');
    if (/launch|ship|release/i.test(text)) signals.push('launch');
    if (/hiring|join\s+us|team/i.test(text)) signals.push('hiring');
    if (/yc|ycombinator/i.test(text))   signals.push('yc_backed');
    if (/award|winner|top/i.test(text)) signals.push('recognition');

    const companyUrl = extractCompanyUrl(item.excerpt || '', item.title);
    const sector     = extractSectorGuess(text);
    const vcs        = extractVcsMentioned(text);
    const heat       = calcHeatScore(item, heat_base, text);

    discoveries.push({
      source,
      source_url:   item.url || url,
      company_name: null, // LLM could extract this later
      company_url:  companyUrl,
      headline:     item.title,
      summary:      item.excerpt?.slice(0, 600),
      signals,
      sector_guess: sector,
      heat_score:   heat,
      vc_mentioned: vcs,
      status:       'queued',
    });
  }

  console.log(`  ${name}: ${discoveries.length} discoveries (heat avg ${discoveries.length ? Math.round(discoveries.reduce((s,d)=>s+d.heat_score,0)/discoveries.length) : 0})`);
  return discoveries;
}

// ── Check existing DB for duplicates ─────────────────────────────────────────
async function dedupeDiscoveries(discoveries, client) {
  if (!discoveries.length) return [];

  // Check against hot_startup_discoveries (by headline hash)
  const headlines = discoveries.map(d => d.headline);
  const { data: existing } = await client.from('hot_startup_discoveries')
    .select('headline')
    .in('headline', headlines.slice(0, 100)); // PostgREST limit

  const existingSet = new Set((existing || []).map(e => e.headline));

  // Also check startup_uploads by URL
  const urls = discoveries.map(d => d.company_url).filter(Boolean);
  let existingUrls = new Set();
  if (urls.length) {
    const { data: startups } = await client.from('startup_uploads')
      .select('website')
      .in('website', urls);
    existingUrls = new Set((startups || []).map(s => s.website));
  }

  return discoveries.filter(d => !existingSet.has(d.headline) && !existingUrls.has(d.company_url));
}

async function main() {
  console.log('🔥 Hot Startup Discovery Agent');
  console.log('═'.repeat(50));
  console.log('Run at:', new Date().toISOString());
  if (DRY_RUN) console.log('⚠️  DRY-RUN mode — no DB writes');
  if (AUTO_SUBMIT) console.log('📬 Auto-submit enabled — will submit high-heat startups to API');
  console.log('');

  const client = sb();

  // ── Also fetch active RSS feeds from Pythh's own rss_sources table ─────────
  let rssRows = [];
  try {
    const { data: _rssRows } = await client.from('rss_sources')
      .select('name, url, category')
      .eq('is_active', true)
      .limit(50);
    rssRows = _rssRows || [];
  } catch (_) { /* rss_sources may be unavailable */ }

  const extraSources = (rssRows || []).map(r => ({
    name: r.name, url: r.url,
    source: r.category === 'vc_news' ? 'vc_rss' : 'rss',
    heat_base: r.category === 'vc_news' ? 75 : 55,
  }));

  const allSources = [...DISCOVERY_SOURCES, ...extraSources];
  console.log(`Sources: ${allSources.length} (${DISCOVERY_SOURCES.length} built-in + ${extraSources.length} from DB)\n`);

  // ── Scrape all sources in parallel batches ─────────────────────────────────
  const allDiscoveries = [];
  for (let i = 0; i < allSources.length; i += CONCURRENCY) {
    const batch = allSources.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(s => processSource(s)));
    for (const r of results) {
      if (r.status === 'fulfilled') allDiscoveries.push(...r.value);
    }
  }

  console.log(`\nTotal raw discoveries: ${allDiscoveries.length}`);

  // ── Dedupe ────────────────────────────────────────────────────────────────
  const fresh = DRY_RUN ? allDiscoveries : await dedupeDiscoveries(allDiscoveries, client);
  console.log(`After dedup: ${fresh.length} new discoveries`);

  // ── Sort by heat score ────────────────────────────────────────────────────
  fresh.sort((a, b) => b.heat_score - a.heat_score);

  // ── Print top 20 ─────────────────────────────────────────────────────────
  console.log('\n🔥 TOP DISCOVERIES:');
  fresh.slice(0, 20).forEach((d, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [heat=${d.heat_score}] [${d.source}] ${d.headline?.slice(0, 70)}`);
    if (d.company_url) console.log(`      → ${d.company_url}`);
    if (d.signals?.length) console.log(`      signals: ${d.signals.join(', ')}`);
  });

  // ── Write to DB ───────────────────────────────────────────────────────────
  if (!DRY_RUN && fresh.length > 0) {
    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < fresh.length; i += BATCH) {
      const { error } = await client.from('hot_startup_discoveries').insert(fresh.slice(i, i + BATCH));
      if (error) console.error('Insert error:', error.message);
      else inserted += Math.min(BATCH, fresh.length - i);
    }
    console.log(`\n✅ Inserted ${inserted} discoveries`);
  }

  // ── Auto-submit high-heat startups with URLs to the pipeline ─────────────
  if (AUTO_SUBMIT && !DRY_RUN) {
    const submitCandidates = fresh.filter(d => d.company_url && d.heat_score >= 75);
    console.log(`\n📬 Auto-submitting ${submitCandidates.length} high-heat startups...`);

    for (const candidate of submitCandidates.slice(0, 20)) {
      try {
        const resp = await fetch(`${API_BASE}/api/instant/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: candidate.company_url, source: `discovery:${candidate.source}` }),
        });
        const data = await resp.json();
        console.log(`  ${candidate.company_url}: ${data.status || data.error || 'ok'}`);
      } catch (e) {
        console.error(`  ✗ ${candidate.company_url}: ${e.message}`);
      }
    }
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const bySource = {};
  for (const d of fresh) bySource[d.source] = (bySource[d.source] || 0) + 1;
  console.log('\nBy source:', JSON.stringify(bySource));
  console.log('High heat (≥75):', fresh.filter(d => d.heat_score >= 75).length);
  console.log('With company URL:', fresh.filter(d => d.company_url).length);
  console.log('With funding signal:', fresh.filter(d => d.signals?.includes('funding')).length);

  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
