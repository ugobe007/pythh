#!/usr/bin/env node
/**
 * Market Signals Tracker
 * 
 * Tracks behavioral & market signals for portfolio companies:
 *   - Funding events (from RSS events + Google News)
 *   - Hiring velocity (career page job count)
 *   - Product launches (GitHub, ProductHunt, press)
 *   - Press mention velocity (tier-weighted coverage)
 *   - Partnerships & market expansion (NLP on headlines)
 *   - GitHub activity (commit velocity, star growth)
 *
 * Writes to: startup_signals, startup_momentum_snapshots
 * Updates:   startup_uploads.market_momentum
 *
 * Usage:
 *   node scripts/track-market-signals.js               # full run (all approved)
 *   node scripts/track-market-signals.js --limit=50    # first N startups
 *   node scripts/track-market-signals.js --id=<uuid>   # single startup
 *   node scripts/track-market-signals.js --dry-run     # no DB writes
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── CLI args ──────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);
const DRY_RUN    = !!args['dry-run'];
const LIMIT      = args.limit ? parseInt(args.limit) : null;
const SINGLE_ID  = args.id || null;
const BATCH_SIZE = 20;
const REQUEST_TIMEOUT_MS = 8000;

// ── Signal type definitions ───────────────────────────────────────
const SIGNAL_PATTERNS = {
  funding: {
    keywords: /\b(raises?|raised|secures?|secured|closes?|closed|announces?\s+\$|seed\s+round|series\s+[a-e]|pre[- ]?seed|funding\s+round|venture\s+capital|vc\s+backed|valuation|unicorn|billion|million.*round|investment.*round|round.*investment)\b/i,
    strength: 0.9,
    sentiment: 'positive',
  },
  hiring: {
    keywords: /\b(hiring|we['']?re\s+hiring|join\s+our\s+team|open\s+positions?|job\s+openings?|careers?\s+at|now\s+recruiting|growing\s+team|headcount|expands?\s+team|new\s+hires?)\b/i,
    strength: 0.6,
    sentiment: 'positive',
  },
  product_launch: {
    keywords: /\b(launches?|launched|releases?|released|ships?|shipped|announces?\s+(new|its?\s+new)|unveils?|unveiled|beta|general\s+availability|ga\b|v\d+\.\d+|version\s+\d|new\s+feature|product\s+update|now\s+available)\b/i,
    strength: 0.75,
    sentiment: 'positive',
  },
  partnership: {
    keywords: /\b(partners?\s+with|partnership|integration\s+with|integrates?\s+with|teams?\s+up|strategic\s+(alliance|deal|agreement)|collaborates?\s+with|joint\s+(venture|agreement)|licensing\s+deal|Enterprise\s+agreement)\b/i,
    strength: 0.7,
    sentiment: 'positive',
  },
  market_expansion: {
    keywords: /\b(expands?\s+to|expansion\s+into|enters?\s+(the\s+)?market|international\s+expansion|new\s+(market|geography|region|country|vertical|segment)|launches?\s+in|available\s+in)\b/i,
    strength: 0.65,
    sentiment: 'positive',
  },
  executive_hire: {
    keywords: /\b(appoints?|appointed|names?\s+(new|a\s+new)|hires?\s+(new\s+)?ceo|hires?\s+(new\s+)?cto|hires?\s+(new\s+)?cfo|hires?\s+(new\s+)?coo|new\s+(ceo|cto|cfo|coo|cro|cmo|vp\s+of)|joins?\s+as\s+(ceo|cto|president|vp)|c[- ]?suite)\b/i,
    strength: 0.7,
    sentiment: 'positive',
  },
  award: {
    keywords: /\b(wins?|won|award|recognized\s+(as|by)|named\s+(one\s+of|a|the)|ranked\s+(#?\d+|among)|Forbes\s+\d+|Fast\s+Company|best\s+startup|top\s+\d+)\b/i,
    strength: 0.5,
    sentiment: 'positive',
  },
  regulatory: {
    keywords: /\b(fda\s+approval|ema\s+approval|cleared|510k|patent\s+(granted|issued|filed)|license\s+(granted|approved)|regulatory\s+approval|compliance|certified|iso\s+\d+)\b/i,
    strength: 0.8,
    sentiment: 'positive',
  },
};

// Source tier weights for press mention strength
const PRESS_TIER_WEIGHTS = { tier1: 0.95, tier2: 0.7, tier3: 0.4 };

// ── HTTP helpers ──────────────────────────────────────────────────
function fetchUrl(urlStr, { timeout = REQUEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HotHoneyBot/1.0; market-signals-tracker)',
          'Accept': 'text/html,application/xhtml+xml,*/*',
        },
        timeout,
      }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: chunks.join('') }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    } catch (e) {
      reject(e);
    }
  });
}

function googleNewsRssUrl(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' startup')}&hl=en-US&gl=US&ceid=US:en`;
}

// ── Signal extraction from text ───────────────────────────────────
function extractSignalTypes(text) {
  if (!text) return [];
  const found = [];
  for (const [type, { keywords, strength, sentiment }] of Object.entries(SIGNAL_PATTERNS)) {
    if (keywords.test(text)) {
      found.push({ type, strength, sentiment });
    }
  }
  return found;
}

// ── Parse Google News RSS for a startup ──────────────────────────
async function fetchNewsSignals(startup) {
  const signals = [];
  const query = startup.name + (startup.website ? ` ${startup.website.replace(/https?:\/\//,'')}` : '');
  const rssUrl = googleNewsRssUrl(query);

  try {
    const { body } = await fetchUrl(rssUrl, { timeout: 7000 });
    
    // Parse RSS items manually (lightweight — no xml parser needed)
    const itemMatches = [...body.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
    
    for (const match of itemMatches) {
      const item = match[1];
      const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
      const linkMatch  = item.match(/<link>(.*?)<\/link>/i);
      const pubDate    = item.match(/<pubDate>(.*?)<\/pubDate>/i);
      const snippet    = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i);

      const title = titleMatch?.[1]?.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim() || '';
      const url   = linkMatch?.[1]?.trim() || '';
      const date  = pubDate?.[1] ? new Date(pubDate[1]) : null;
      const text  = `${title} ${snippet?.[1] || ''}`;

      // Determine press tier from domain
      let pressTier = 'tier3';
      try {
        const domain = new URL(url.includes('google.com') ? `https://placeholder.com${url}` : url).hostname;
        if (/\b(reuters|bloomberg|wsj|ft\.com|nytimes|techcrunch|wired|economist|bbc|cnbc|forbes)\b/i.test(domain)) pressTier = 'tier1';
        else if (/\b(techcrunch|venturebeat|sifted|theinformation|axios|the-information|protocol|business.*insider|crunchbase)\b/i.test(domain)) pressTier = 'tier1';
        else if (/\b(yahoo|apnews|businesswire|prnewswire|globe.*newswire|marketwatch)\b/i.test(domain)) pressTier = 'tier2';
      } catch {}

      // Always store as press_mention
      signals.push({
        signal_type: 'press_mention',
        signal_date: date?.toISOString(),
        signal_title: title.slice(0, 500),
        signal_url: url,
        signal_source: 'google_news_rss',
        strength: PRESS_TIER_WEIGHTS[pressTier],
        sentiment: 'neutral',
        raw_data: { press_tier: pressTier, snippet: (snippet?.[1] || '').slice(0, 300) },
      });

      // Also extract typed signals (funding, hiring, etc.) from headline
      const typed = extractSignalTypes(text);
      for (const { type, strength, sentiment } of typed) {
        if (type !== 'press_mention') { // avoid double-counting
          signals.push({
            signal_type: type,
            signal_date: date?.toISOString(),
            signal_title: title.slice(0, 500),
            signal_url: url,
            signal_source: 'google_news_rss',
            strength,
            sentiment,
            raw_data: { detected_from: 'headline', press_tier: pressTier },
          });
        }
      }
    }
  } catch (e) {
    // Non-fatal: skip if news fetch fails
  }

  return signals;
}

// ── Check GitHub activity via public API ─────────────────────────
async function fetchGitHubSignals(startup) {
  const signals = [];

  // Try to extract GitHub org/user from website or extracted_data
  let githubHandle = null;
  const extracted = startup.extracted_data || {};

  if (extracted.github_url) {
    const m = extracted.github_url.match(/github\.com\/([^/\s]+)/i);
    if (m) githubHandle = m[1];
  }
  if (!githubHandle && startup.website) {
    // Sometimes GitHub is linked from the company site — but we can't reliably infer it
    // Only use if website IS a github.io domain
    const m = startup.website.match(/^(?:https?:\/\/)?([^.]+)\.github\.io/i);
    if (m) githubHandle = m[1];
  }

  if (!githubHandle) return signals;

  try {
    const { body, status } = await fetchUrl(
      `https://api.github.com/users/${githubHandle}/repos?sort=pushed&per_page=10`,
      { timeout: 6000 }
    );
    if (status !== 200) return signals;

    const repos = JSON.parse(body);
    if (!Array.isArray(repos) || repos.length === 0) return signals;

    const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const recentPushes = repos.filter(r => {
      const pushed = new Date(r.pushed_at);
      const daysAgo = (Date.now() - pushed) / 86400000;
      return daysAgo <= 30;
    });

    if (recentPushes.length > 0) {
      signals.push({
        signal_type: 'github_activity',
        signal_date: new Date().toISOString(),
        signal_title: `${recentPushes.length} repo(s) pushed in last 30 days. Total stars: ${totalStars}`,
        signal_url: `https://github.com/${githubHandle}`,
        signal_source: 'github_api',
        strength: Math.min(1, recentPushes.length / 10 * 0.6 + Math.min(totalStars, 1000) / 1000 * 0.4),
        sentiment: 'positive',
        raw_data: {
          github_handle: githubHandle,
          total_stars: totalStars,
          repos_pushed_30d: recentPushes.length,
          top_repos: recentPushes.slice(0, 3).map(r => ({ name: r.name, stars: r.stargazers_count, pushed: r.pushed_at })),
        },
      });
    }
  } catch {}

  return signals;
}

// ── Check hiring signals from career page ────────────────────────
async function fetchHiringSignals(startup) {
  const signals = [];
  if (!startup.website) return signals;

  const base = startup.website.replace(/\/$/, '');
  const careerPaths = ['/careers', '/jobs', '/join', '/join-us', '/work-with-us'];

  for (const path of careerPaths) {
    try {
      const { body, status } = await fetchUrl(`${base}${path}`, { timeout: 5000 });
      if (status !== 200) continue;

      // Count job listing patterns  
      const jobMatches = (body.match(/<(li|div|article)[^>]*class="[^"]*job[^"]*"/gi) || []).length
        + (body.match(/\bapply\s+now\b/gi) || []).length
        + (body.match(/\bopen\s+roles?\b|\bopen\s+positions?\b/gi) || []).length;

      if (jobMatches >= 2) {
        signals.push({
          signal_type: 'hiring',
          signal_date: new Date().toISOString(),
          signal_title: `Active careers page detected (${jobMatches} signals)`,
          signal_url: `${base}${path}`,
          signal_source: 'web_scrape',
          strength: Math.min(1, 0.3 + jobMatches * 0.07),
          sentiment: 'positive',
          raw_data: { career_url: `${base}${path}`, job_signals_count: jobMatches },
        });
        break; // Found careers page, stop checking other paths
      }
    } catch {}
  }

  return signals;
}

// ── Compute momentum score from rolling 30-day signals ───────────
function computeMomentumScore(signals30d) {
  if (signals30d.length === 0) return { momentum_score: 0, velocity_score: 0 };

  // Weight by signal type priority
  const typeWeights = {
    funding: 25, executive_hire: 15, product_launch: 12,
    partnership: 10, hiring: 8, market_expansion: 8,
    press_mention: 3, github_activity: 5, award: 6, regulatory: 12,
  };

  let raw = 0;
  let signalTypes = new Set();
  for (const sig of signals30d) {
    const w = typeWeights[sig.signal_type] || 3;
    raw += w * (sig.strength || 0.5);
    signalTypes.add(sig.signal_type);
  }

  // Normalize: 100 = exceptional (funding + 3+ other types in 30d)
  const momentum = Math.min(100, Math.round(raw / 1.5));
  const diversity = signalTypes.size;

  return { momentum_score: momentum, velocity_score: Math.min(1, raw / 150), signal_diversity: diversity };
}

// ── Core: process a single startup ───────────────────────────────
async function processStartup(startup) {
  const { id, name, website } = startup;
  const result = { startup_id: id, name, signals_found: 0, errors: [] };

  // Fetch signals from all sources in parallel  
  const [newsSignals, githubSignals, hiringSignals] = await Promise.allSettled([
    fetchNewsSignals(startup),
    fetchGitHubSignals(startup),
    fetchHiringSignals(startup),
  ]);

  const allSignals = [
    ...(newsSignals.status === 'fulfilled' ? newsSignals.value : []),
    ...(githubSignals.status === 'fulfilled' ? githubSignals.value : []),
    ...(hiringSignals.status === 'fulfilled' ? hiringSignals.value : []),
  ];

  if (newsSignals.status === 'rejected') result.errors.push(`news: ${newsSignals.reason?.message}`);
  if (githubSignals.status === 'rejected') result.errors.push(`github: ${githubSignals.reason?.message}`);
  if (hiringSignals.status === 'rejected') result.errors.push(`hiring: ${hiringSignals.reason?.message}`);

  result.signals_found = allSignals.length;

  if (DRY_RUN || allSignals.length === 0) {
    return result;
  }

  // Deduplicate: skip signals with identical (startup_id + signal_type + signal_url)
  const existing = await supabase
    .from('startup_signals')
    .select('signal_url, signal_type')
    .eq('startup_id', id)
    .gte('created_at', new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()); // last 3 days

  const existingKeys = new Set(
    (existing.data || []).map(s => `${s.signal_type}::${s.signal_url}`)
  );

  const newSignals = allSignals
    .filter(s => s.signal_url && !existingKeys.has(`${s.signal_type}::${s.signal_url}`))
    .map(s => ({ ...s, startup_id: id }));

  if (newSignals.length > 0) {
    const { error } = await supabase.from('startup_signals').insert(newSignals);
    if (error) result.errors.push(`insert: ${error.message}`);
  }

  // Compute and store momentum snapshot
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('startup_signals')
    .select('signal_type, strength, signal_date')
    .eq('startup_id', id)
    .gte('signal_date', thirtyDaysAgo);

  const recentSignals = recent || [];
  const { momentum_score, velocity_score, signal_diversity } = computeMomentumScore(recentSignals);

  const signalTypesSet = new Set(recentSignals.map(s => s.signal_type));
  const snapshot = {
    startup_id: id,
    funding_signals_30d:     recentSignals.filter(s => s.signal_type === 'funding').length,
    hiring_signals_30d:      recentSignals.filter(s => s.signal_type === 'hiring').length,
    product_signals_30d:     recentSignals.filter(s => s.signal_type === 'product_launch').length,
    press_signals_30d:       recentSignals.filter(s => s.signal_type === 'press_mention').length,
    partnership_signals_30d: recentSignals.filter(s => s.signal_type === 'partnership').length,
    github_signals_30d:      recentSignals.filter(s => s.signal_type === 'github_activity').length,
    momentum_score,
    velocity_score,
    signal_diversity,
    is_trending:  momentum_score >= 50,
    is_raising:   signalTypesSet.has('funding'),
    is_hiring:    signalTypesSet.has('hiring'),
    is_launching: signalTypesSet.has('product_launch'),
    last_signal_at: recentSignals.length > 0
      ? recentSignals.sort((a,b) => new Date(b.signal_date) - new Date(a.signal_date))[0].signal_date
      : null,
    snapshot_updated_at: new Date().toISOString(),
  };

  await supabase
    .from('startup_momentum_snapshots')
    .upsert(snapshot, { onConflict: 'startup_id' });

  // Denormalize momentum score back to startup_uploads for fast queries
  const trendingTypes = [...signalTypesSet].filter(t => ['funding','hiring','product_launch','partnership'].includes(t));
  await supabase
    .from('startup_uploads')
    .update({
      market_momentum: momentum_score,
      momentum_updated_at: new Date().toISOString(),
      trending_signals: trendingTypes.length > 0 ? trendingTypes : null,
    })
    .eq('id', id);

  return result;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n📡 MARKET SIGNALS TRACKER');
  console.log('═'.repeat(60));
  if (DRY_RUN) console.log('🔍 DRY RUN — no DB writes\n');

  // Fetch startups to process
  let query = supabase
    .from('startup_uploads')
    .select('id, name, website, sectors, extracted_data')
    .eq('status', 'approved')
    .order('momentum_updated_at', { ascending: true, nullsFirst: true });

  if (SINGLE_ID) {
    query = supabase
      .from('startup_uploads')
      .select('id, name, website, sectors, extracted_data')
      .eq('id', SINGLE_ID);
  } else if (LIMIT) {
    query = query.limit(LIMIT);
  } else {
    // Process max 200 per run (daily PM2 job — cycles through all over time)
    query = query.limit(200);
  }

  const { data: startups, error } = await query;
  if (error) {
    console.error('❌ Failed to fetch startups:', error.message);
    process.exit(1);
  }

  console.log(`📊 Processing ${startups.length} startups for market signals\n`);

  const stats = { processed: 0, signals_total: 0, errors: 0, trending: 0 };

  // Process in batches
  for (let i = 0; i < startups.length; i += BATCH_SIZE) {
    const batch = startups.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(s => processStartup(s))
    );

    for (const res of results) {
      if (res.status === 'fulfilled') {
        const r = res.value;
        stats.processed++;
        stats.signals_total += r.signals_found;
        if (r.errors.length > 0) stats.errors++;
        if (r.signals_found > 0) {
          process.stdout.write(`  ✓ ${r.name}: ${r.signals_found} signals\n`);
        }
      } else {
        stats.errors++;
      }
    }

    const pct = Math.round(((i + batch.length) / startups.length) * 100);
    console.log(`  Progress: ${i + batch.length}/${startups.length} (${pct}%)`);

    // Brief cooldown between batches to avoid hammering sources
    if (i + BATCH_SIZE < startups.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Summary
  if (!DRY_RUN) {
    const { count: trending } = await supabase
      .from('startup_momentum_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('is_trending', true);

    const { count: raising } = await supabase
      .from('startup_momentum_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('is_raising', true);

    const { count: hiring } = await supabase
      .from('startup_momentum_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('is_hiring', true);

    console.log('\n═'.repeat(60));
    console.log('📊 MARKET SIGNALS SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  Startups processed:  ${stats.processed}`);
    console.log(`  Total signals found: ${stats.signals_total}`);
    console.log(`  Processing errors:   ${stats.errors}`);
    console.log(`\n  🔥 Trending now:     ${trending || 0}`);
    console.log(`  💰 Actively raising: ${raising || 0}`);
    console.log(`  👥 Actively hiring:  ${hiring || 0}`);
    console.log();
  } else {
    console.log(`\n  [DRY RUN] Would have stored signals for ${stats.processed} startups`);
    console.log(`  [DRY RUN] Total signals detected: ${stats.signals_total}`);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
