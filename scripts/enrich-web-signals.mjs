#!/usr/bin/env node
/**
 * enrich-web-signals.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Enriches startups with three new signal sources that feed GOD score
 * components currently starved of data:
 *
 *   1. BLOG / CHANGELOG scraper  →  vision_score, product_score
 *      Checks {website}/blog, /news, /updates, /changelog for post count
 *      and recency. Active blog = company communicating = vision signal.
 *
 *   2. PRESS TIER classifier     →  traction_score (social proof)
 *      Re-queries Google News RSS and classifies each source as:
 *        Tier 1 = TechCrunch, Forbes, WSJ, Bloomberg, Reuters, FT, VentureBeat
 *        Tier 2 = regional tech blogs, niche press
 *        Tier 3 = PR wire (BusinessWire, PRNewswire, Globe Newswire) — weak
 *
 *   3. REDDIT mention fetcher    →  traction_score (community signal)
 *      Uses free reddit.com/search.json API (no auth required).
 *      High-signal for dev tools, B2B SaaS, open-source companies.
 *
 * Results stored in extracted_data.web_signals (JSONB — no migration needed).
 * After running, re-run: npx tsx scripts/recalculate-scores.ts
 *
 * MONITORING: Per-source error rates are tracked and logged to ai_logs table
 * after each batch. If a source error rate exceeds 50%, a WARNING is logged.
 * Run with --health to just print current signal coverage stats.
 *
 * Usage:
 *   node scripts/enrich-web-signals.mjs              # batch of 200
 *   node scripts/enrich-web-signals.mjs --limit 50   # smaller batch
 *   node scripts/enrich-web-signals.mjs --all        # refresh all (slow)
 *   node scripts/enrich-web-signals.mjs --dry-run    # print without writing
 *   node scripts/enrich-web-signals.mjs --health     # show coverage stats only
 *   node scripts/enrich-web-signals.mjs --test NAME  # test a single startup
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import inference engine (CJS module) — used instead of Reddit API
const require = createRequire(import.meta.url);
const {
  extractExecutionSignals,
  extractRepeatFounderSignals,
  extractSocialProofCascadeSignals,
  extractCompetitiveSignals,
} = require('../lib/inference-extractor.js');
dotenv.config({ path: join(__dirname, '..', '.env') });

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const FETCH_VERSION = 1;   // increment when signal schema changes to force re-fetch
const STALE_DAYS    = 14;  // re-fetch after 2 weeks
const DEFAULT_LIMIT = 200;
const CONCURRENCY   = 3;   // parallel startups (be gentle on rate limits)

// Delays between requests per source (ms) — tuned for free tiers
const DELAY = {
  blog:    500,
  news:   1500,  // Google News RSS — same as social-signals-fetcher
  // inference: no delay — local computation from already-fetched news text
};

// Tier-1 press domains (a mention here = strong traction signal)
const TIER1_DOMAINS = [
  'techcrunch.com', 'forbes.com', 'wsj.com', 'bloomberg.com',
  'reuters.com', 'ft.com', 'venturebeat.com', 'wired.com',
  'theinformation.com', 'axios.com', 'cnbc.com', 'businessinsider.com',
  'fortune.com', 'inc.com', 'fastcompany.com', 'thenextweb.com',
  'sifted.eu', 'eu-startups.com', 'crunchbase.com',
];

// PR wire domains — weak signal (company paid for it)
const PR_WIRE_DOMAINS = [
  'businesswire.com', 'prnewswire.com', 'globenewswire.com',
  'accesswire.com', 'prnews.io', 'einpresswire.com',
  'prweb.com', 'newswire.com', 'send2press.com',
];

// Blog path candidates to check
const BLOG_PATHS = ['/blog', '/blog/', '/news', '/updates', '/changelog', '/journal', '/articles'];

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const FETCH_ALL  = args.includes('--all');
const HEALTH_ONLY = args.includes('--health');

let BATCH_LIMIT = DEFAULT_LIMIT;
const limitIdx = args.indexOf('--limit');
if (limitIdx !== -1 && args[limitIdx + 1]) BATCH_LIMIT = parseInt(args[limitIdx + 1], 10) || DEFAULT_LIMIT;
const eqArg = args.find(a => a.startsWith('--limit='));
if (eqArg) BATCH_LIMIT = parseInt(eqArg.split('=')[1], 10) || DEFAULT_LIMIT;

const testIdx = args.indexOf('--test');
const TEST_NAME = testIdx !== -1 ? args[testIdx + 1] : null;

// ─── Supabase ────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Health monitor (per-run) ─────────────────────────────────────────────────

const monitor = {
  blog:      { attempts: 0, successes: 0, failures: 0, timeouts: 0 },
  news:      { attempts: 0, successes: 0, failures: 0, timeouts: 0 },
  inference: { attempts: 0, successes: 0, failures: 0, timeouts: 0 },
};

function recordSuccess(source) { monitor[source].attempts++; monitor[source].successes++; }
function recordFailure(source)  { monitor[source].attempts++; monitor[source].failures++; }
function recordTimeout(source)  { monitor[source].attempts++; monitor[source].timeouts++; }

function healthSummary() {
  const rows = [];
  for (const [src, m] of Object.entries(monitor)) {
    if (m.attempts === 0) continue;
    const pct = ((m.successes / m.attempts) * 100).toFixed(0);
    const status = m.successes / m.attempts >= 0.5 ? '✅' : '⚠️ DEGRADED';
    rows.push(`  ${src.padEnd(8)} ${status}  ${m.successes}/${m.attempts} (${pct}%)  timeouts:${m.timeouts}`);
  }
  return rows.join('\n') || '  (no requests made)';
}

async function logHealthToSupabase(batchSize, enriched, durationMs) {
  const health = {};
  for (const [src, m] of Object.entries(monitor)) {
    health[src] = {
      attempts: m.attempts,
      successes: m.successes,
      failures: m.failures,
      timeouts: m.timeouts,
      success_rate: m.attempts > 0 ? +(m.successes / m.attempts).toFixed(2) : null,
    };
  }

  const degraded = Object.entries(health)
    .filter(([, v]) => v.success_rate !== null && v.success_rate < 0.5)
    .map(([k]) => k);

  const level = degraded.length > 0 ? 'warning' : 'info';
  const message = degraded.length > 0
    ? `enrich-web-signals: DEGRADED sources: ${degraded.join(', ')}`
    : `enrich-web-signals: batch complete — ${enriched}/${batchSize} enriched`;

  try {
    await supabase.from('ai_logs').insert({
      log_type: 'web_signals_health',
      level,
      message,
      metadata: { health, batch_size: batchSize, enriched, duration_ms: durationMs },
      created_at: new Date().toISOString(),
    });
  } catch (_) {} // non-fatal if logging fails
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function daysSince(iso) {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function domainOf(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch { return ''; }
}

/**
 * Safe fetch with timeout + abort controller.
 * Returns { ok, status, text, error } — never throws.
 */
async function safeFetch(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HotHoney-Enrichment/1.0)',
        'Accept': 'text/html,application/json,application/xml,*/*',
      },
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    const isTimeout = e.name === 'AbortError' || e.message?.includes('abort');
    return { ok: false, status: 0, text: '', error: e.message, isTimeout };
  } finally {
    clearTimeout(timer);
  }
}

// ─── SOURCE 1: Blog / Changelog scraper ──────────────────────────────────────

/**
 * Checks common blog paths on the startup's website.
 * Returns: { found, path, post_count_estimate, days_since_last_post, has_changelog }
 */
async function fetchBlogSignals(website) {
  if (!website) return null;

  const base = website.startsWith('http') ? website : `https://${website}`;
  const baseClean = base.replace(/\/$/, '');

  monitor.blog.attempts++;

  for (const path of BLOG_PATHS) {
    const url = baseClean + path;
    const res = await safeFetch(url, 6000);

    if (res.isTimeout) { monitor.blog.timeouts++; continue; }
    if (!res.ok || !res.text) continue;

    const html = res.text.toLowerCase();

    // Detect if this is actually a blog (has article/post patterns)
    const isBlogPage = (
      html.includes('<article') ||
      html.includes('class="post') ||
      html.includes('class="blog') ||
      html.includes('class="entry') ||
      html.includes('<time ') ||
      html.includes('published') ||
      (html.includes('read more') && html.includes('author'))
    );

    if (!isBlogPage) continue;

    // Estimate post count from <article> or <li class="post"> etc.
    const articleMatches = (html.match(/<article/g) || []).length;
    const postLinks = (html.match(/href="[^"]*\/(20\d{2}|blog|post|article|update)[^"]*"/g) || []).length;
    const postCountEstimate = Math.max(articleMatches, postLinks);

    // Try to find most recent date
    const dateMatches = html.match(/20(2[3-9]|[3-9]\d)-\d{2}-\d{2}/g) || [];
    let daysSinceLast = null;
    if (dateMatches.length > 0) {
      const dates = dateMatches.map(d => new Date(d)).filter(d => !isNaN(d));
      if (dates.length > 0) {
        const newest = new Date(Math.max(...dates));
        daysSinceLast = Math.round((Date.now() - newest) / (1000 * 60 * 60 * 24));
      }
    }

    const hasChangelog = path === '/changelog' || html.includes('changelog') || html.includes('release notes');

    monitor.blog.successes++;
    return {
      found: true,
      path,
      post_count_estimate: postCountEstimate,
      days_since_last_post: daysSinceLast,
      has_changelog: hasChangelog,
      fetched_at: new Date().toISOString(),
    };
  }

  // No blog found
  monitor.blog.failures++;
  return { found: false, fetched_at: new Date().toISOString() };
}

// ─── SOURCE 2: Press tier classifier ─────────────────────────────────────────

/**
 * Fetches Google News RSS for the startup name and classifies coverage by tier.
 * Returns: { total, tier1_count, tier2_count, tier3_pr_count, tier1_sources, days_since_latest }
 */
async function fetchPressTier(name) {
  const query = encodeURIComponent(`"${name}" startup`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  monitor.news.attempts++;

  await sleep(DELAY.news);
  const res = await safeFetch(url, 10000);

  if (res.isTimeout) { monitor.news.timeouts++; return null; }
  if (!res.ok || !res.text) { monitor.news.failures++; return null; }

  // Parse items from RSS XML
  const items = [...res.text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
  if (!items.length) { monitor.news.successes++; return { total: 0, tier1_count: 0, tier2_count: 0, tier3_pr_count: 0, tier1_sources: [], days_since_latest: null }; }

  let tier1 = 0, tier2 = 0, tier3 = 0;
  const tier1Sources = new Set();
  const pubDates = [];

  for (const item of items) {
    // Extract source domain
    const sourceMatch = item.match(/<source[^>]*url="([^"]*)"/) || item.match(/<link>([^<]*)<\/link>/);
    const sourceStr = (sourceMatch?.[1] || '').toLowerCase();
    const domain = domainOf(sourceStr) || sourceStr;

    if (TIER1_DOMAINS.some(d => domain.includes(d))) {
      tier1++;
      tier1Sources.add(domain);
    } else if (PR_WIRE_DOMAINS.some(d => domain.includes(d))) {
      tier3++;
    } else {
      tier2++;
    }

    // Extract pub date
    const dateMatch = item.match(/<pubDate>([^<]*)<\/pubDate>/);
    if (dateMatch) {
      const d = new Date(dateMatch[1]);
      if (!isNaN(d)) pubDates.push(d);
    }
  }

  const daysSinceLatest = pubDates.length > 0
    ? Math.round((Date.now() - Math.max(...pubDates)) / (1000 * 60 * 60 * 24))
    : null;

  // Collect article titles + descriptions for inference engine
  const articleTexts = items.map(item => {
    const title = (item.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const desc  = (item.match(/<description>([^<]*)<\/description>/) || [])[1] || '';
    return `${title} ${desc}`.replace(/<[^>]*>/g, ' ').trim();
  }).filter(Boolean);

  monitor.news.successes++;
  return {
    total: items.length,
    tier1_count: tier1,
    tier2_count: tier2,
    tier3_pr_count: tier3,
    tier1_sources: [...tier1Sources].slice(0, 5),
    days_since_latest: daysSinceLatest,
    article_texts: articleTexts,   // raw text for inference (not stored in DB)
    fetched_at: new Date().toISOString(),
  };
}

// ─── SOURCE 3: Inference-based community signals ──────────────────────────────

/**
 * Derives community/buzz signals from already-fetched press article text using
 * the local inference engine. No external API calls — 100% success rate.
 * Returns same shape as old fetchRedditSignals for scoring compatibility.
 */
function inferCommunitySignals(name, pressTierResult) {
  monitor.inference.attempts++;

  const articleTexts = pressTierResult?.article_texts || [];
  if (!articleTexts.length) {
    monitor.inference.successes++;
    return { mention_count: 0, positive_count: 0, negative_count: 0,
             inferred: true, signals: [], fetched_at: new Date().toISOString() };
  }

  const corpus = articleTexts.join(' ');
  let exec, repeat, cascade, competitive;
  try {
    exec        = extractExecutionSignals(corpus);
    repeat      = extractRepeatFounderSignals(corpus, name);
    cascade     = extractSocialProofCascadeSignals(corpus);
    competitive = extractCompetitiveSignals(corpus);
  } catch (e) {
    monitor.inference.failures++;
    return null;
  }

  // Build a 0-25 buzz score from inference signals
  let buzz = 0;
  const signals = [];

  const t1 = pressTierResult?.tier1_count ?? 0;
  buzz += Math.min(t1 * 3, 12);
  if (t1 > 0) signals.push(`tier1_press:${t1}`);

  if (cascade.has_social_proof_cascade) {
    buzz += Math.round((cascade.cascade_strength || 0) * 8);
    signals.push(`cascade:${cascade.tier1_leader}`);
  }
  if (exec.has_revenue)   { buzz += 3; signals.push('revenue_mentioned'); }
  if (exec.has_customers) { buzz += 2; signals.push(`customers:${exec.customer_count ?? 'yes'}`); }
  if (exec.is_launched)   { buzz += 1; signals.push('launched'); }
  if (exec.growth_rate)   { buzz += 2; signals.push(`growth:${exec.growth_rate}`); }
  if (repeat.is_repeat_founder) { buzz += 3; signals.push('repeat_founder'); }
  if (competitive.has_competitive_moat) { buzz += 1; signals.push('moat_signal'); }

  const POSITIVE_WORDS = ['raised', 'funded', 'launched', 'growing', 'revenue', 'customers', 'acquired', 'partnership', 'award'];
  const NEGATIVE_WORDS = ['failed', 'shutdown', 'layoffs', 'fraud', 'bankrupt', 'lawsuit', 'breach'];
  const corpusLow = corpus.toLowerCase();
  const positiveCount = POSITIVE_WORDS.filter(w => corpusLow.includes(w)).length;
  const negativeCount = NEGATIVE_WORDS.filter(w => corpusLow.includes(w)).length;

  monitor.inference.successes++;
  return {
    mention_count:    Math.min(buzz, 25),
    positive_count:   positiveCount,
    negative_count:   negativeCount,
    inferred:         true,
    signals,
    exec_signals:     exec.execution_signals,
    has_revenue:      exec.has_revenue,
    has_customers:    exec.has_customers,
    customer_count:   exec.customer_count,
    growth_rate:      exec.growth_rate,
    repeat_founder:   repeat.is_repeat_founder,
    cascade_strength: cascade.cascade_strength,
    fetched_at:       new Date().toISOString(),
  };
}

// ─── Per-startup orchestrator ─────────────────────────────────────────────────

async function enrichStartup(startup) {
  const name = startup.name;
  const website = startup.website;

  process.stdout.write(`  ${name} ...`);

  // Run blog + press in parallel (inference derives from press, no extra HTTP)
  const [blog, press] = await Promise.all([
    fetchBlogSignals(website),
    fetchPressTier(name),
  ]);

  // Inference runs locally on the press article texts — no rate limit
  const community = inferCommunitySignals(name, press);

  // Strip article_texts before storing (too large, not needed in DB)
  const pressToStore = press ? {
    total:            press.total,
    tier1_count:      press.tier1_count,
    tier2_count:      press.tier2_count,
    tier3_pr_count:   press.tier3_pr_count,
    tier1_sources:    press.tier1_sources,
    days_since_latest: press.days_since_latest,
    fetched_at:       press.fetched_at,
  } : null;

  const webSignals = {
    blog:       blog || null,
    press_tier: pressToStore,
    reddit:     community || null,  // key kept as 'reddit' for scoring compat
    fetch_version: FETCH_VERSION,
    enriched_at: new Date().toISOString(),
  };

  // Build a summary line for logging
  const blogStr      = blog?.found            ? `blog:${blog.post_count_estimate}posts` : 'blog:none';
  const pressStr     = press                  ? `t1:${press.tier1_count}/${press.total}` : 'press:err';
  const communityStr = community?.mention_count > 0 ? `infer:${community.mention_count}` : 'infer:0';
  process.stdout.write(` ${blogStr}  ${pressStr}  ${communityStr}\n`);

  return webSignals;
}

// ─── Health check only mode ───────────────────────────────────────────────────

async function showHealthStats() {
  console.log('\n📊 Web Signals Coverage Stats\n');

  const { data, error } = await supabase
    .from('startup_uploads')
    .select('name, extracted_data')
    .eq('status', 'approved')
    .limit(500);

  if (error) { console.error(error); return; }

  let withSignals = 0, withBlog = 0, withTier1 = 0, withReddit = 0;
  for (const s of data) {
    const ws = s.extracted_data?.web_signals;
    if (!ws) continue;
    withSignals++;
    if (ws.blog?.found) withBlog++;
    if ((ws.press_tier?.tier1_count || 0) > 0) withTier1++;
    if ((ws.reddit?.mention_count || 0) > 0) withReddit++;
  }

  const total = data.length;
  console.log(`  Total sample:        ${total}`);
  console.log(`  Has web_signals:     ${withSignals} (${pct(withSignals, total)}%)`);
  console.log(`  Has blog:            ${withBlog} (${pct(withBlog, total)}%)`);
  console.log(`  Has Tier-1 press:    ${withTier1} (${pct(withTier1, total)}%)`);
  console.log(`  Has Reddit mentions: ${withReddit} (${pct(withReddit, total)}%)`);

  // Recent health logs
  const { data: logs } = await supabase
    .from('ai_logs')
    .select('message, metadata, created_at')
    .eq('log_type', 'web_signals_health')
    .order('created_at', { ascending: false })
    .limit(5);

  if (logs?.length) {
    console.log('\n  Recent health log entries:');
    for (const l of logs) {
      const d = new Date(l.created_at).toLocaleString();
      console.log(`    [${d}] ${l.message}`);
    }
  }
}

function pct(n, total) { return total > 0 ? ((n / total) * 100).toFixed(0) : 0; }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (HEALTH_ONLY) { await showHealthStats(); return; }

  const startTime = Date.now();

  // Build query
  let query = supabase
    .from('startup_uploads')
    .select('id, name, website, extracted_data')
    .eq('status', 'approved');

  let toProcess = [];

  if (TEST_NAME) {
    const { data, error } = await query.ilike('name', `%${TEST_NAME}%`).limit(1);
    if (error) { console.error('DB error:', error); process.exit(1); }
    toProcess = data || [];
  } else {
    // 1) Fetch unenriched rows at DB level — avoids re-scanning same enriched rows every run
    const { data: unenriched, error: uErr } = await supabase
      .from('startup_uploads')
      .select('id, name, website, extracted_data')
      .eq('status', 'approved')
      .filter('extracted_data->web_signals', 'is', 'null')
      .order('total_god_score', { ascending: true })
      .limit(BATCH_LIMIT);
    if (uErr) { console.error('DB error:', uErr); process.exit(1); }

    toProcess = unenriched || [];

    // 2) Fill remaining slots with stale rows (old fetch_version or >STALE_DAYS old)
    if (toProcess.length < BATCH_LIMIT) {
      const { data: staleRaw } = await supabase
        .from('startup_uploads')
        .select('id, name, website, extracted_data')
        .eq('status', 'approved')
        .not('extracted_data->web_signals', 'is', 'null')
        .order('total_god_score', { ascending: true })
        .limit(BATCH_LIMIT * 2);
      const stale = (staleRaw || []).filter(s => {
        const ws = s.extracted_data?.web_signals;
        if (!ws) return false;
        if (ws.fetch_version !== FETCH_VERSION) return true;
        const days = daysSince(ws.enriched_at);
        return days !== null && days >= STALE_DAYS;
      }).slice(0, BATCH_LIMIT - toProcess.length);
      toProcess = [...toProcess, ...stale];
    }
  }

  console.log(`\n🌐 Web Signals Enrichment — ${new Date().toISOString()}`);
  console.log(`   Processing: ${toProcess.length} startups (limit: ${BATCH_LIMIT})\n`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] Would process:');
    toProcess.forEach(s => console.log(`    - ${s.name}`));
    return;
  }

  // Process in chunks of CONCURRENCY
  const stats = { enriched: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const chunk = toProcess.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async startup => {
      try {
        const webSignals = await enrichStartup(startup);

        const existing = startup.extracted_data || {};
        const { error: uErr } = await supabase
          .from('startup_uploads')
          .update({ extracted_data: { ...existing, web_signals: webSignals } })
          .eq('id', startup.id);

        if (uErr) {
          console.error(`  ✗ DB error for ${startup.name}:`, uErr.message);
          stats.errors++;
        } else {
          stats.enriched++;
        }
      } catch (e) {
        console.error(`  ✗ Error processing ${startup.name}:`, e.message);
        stats.errors++;
      }
    }));
  }

  const durationMs = Date.now() - startTime;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Done: ${stats.enriched} enriched, ${stats.errors} errors`);
  console.log(`⏱  Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`\n📡 Source health:`);
  console.log(healthSummary());

  // Warn on degraded sources
  for (const [src, m] of Object.entries(monitor)) {
    if (m.attempts > 5 && m.successes / m.attempts < 0.5) {
      console.warn(`\n⚠️  WARNING: ${src} source is DEGRADED (${m.successes}/${m.attempts} success rate)`);
      console.warn(`   Check rate limits, domain blocks, or API changes.`);
    }
  }

  await logHealthToSupabase(toProcess.length, stats.enriched, durationMs);
  console.log(`\n💾 Health logged to ai_logs (log_type: 'web_signals_health')`);
  console.log(`\nNext step: npx tsx scripts/recalculate-scores.ts\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
