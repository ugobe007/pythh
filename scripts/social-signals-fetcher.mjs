/**
 * social-signals-fetcher.mjs
 * ──────────────────────────────────────────────────────────────────────────────
 * Enriches data-sparse startups (GOD score 40–55) with signals from public,
 * zero-auth APIs that cover virtually EVERY real startup:
 *
 *   1. Google News RSS   — article count  →  press coverage / traction signal
 *   2. GitHub Search API — stars, commit  →  product activity / team signal
 *   3. iTunes Search API — rating count   →  consumer traction / product live
 *
 * Results are stored in extracted_data.social_signals (JSONB, no migration
 * required). After a batch run, re-run recalculate-scores.ts to apply them.
 *
 * Usage:
 *   node scripts/social-signals-fetcher.mjs              # normal batch (200)
 *   node scripts/social-signals-fetcher.mjs --dry-run    # print without writing
 *   node scripts/social-signals-fetcher.mjs --limit 50   # smaller batch
 *   node scripts/social-signals-fetcher.mjs --all        # refresh all (slow)
 *
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN; // optional: bumps search to 30 req/min (vs 10 anon)
const FETCH_VERSION = 3; // increment when signal definitions change
const STALE_DAYS    = 30; // re-fetch after 30 days
const DEFAULT_LIMIT = 200;
const NEWS_DELAY_MS = 1500; // Google News: stay under rate limit
// GitHub Search API: 10 req/min unauthenticated, 30 req/min authenticated
// Set delay to respect the limit: 6s without token, 2s with token
const GITHUB_DELAY_MS = GITHUB_TOKEN ? 2000 : 6000;

// ─── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const FETCH_ALL = args.includes('--all');

// Parse --limit N  or --limit=N
let BATCH_LIMIT = DEFAULT_LIMIT;
const limitIdx = args.indexOf('--limit');
if (limitIdx !== -1 && args[limitIdx + 1]) {
  BATCH_LIMIT = parseInt(args[limitIdx + 1], 10) || DEFAULT_LIMIT;
} else {
  const eqArg = args.find(a => a.startsWith('--limit='));
  if (eqArg) BATCH_LIMIT = parseInt(eqArg.split('=')[1], 10) || DEFAULT_LIMIT;
}

// ─── Supabase ────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Utilities ───────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  b = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (a === b) return 1.0;
  // Jaccard on bigrams
  const bigrams = (s) => {
    const result = new Set();
    for (let i = 0; i < s.length - 1; i++) result.add(s.slice(i, i + 2));
    return result;
  };
  const A = bigrams(a), B = bigrams(b);
  const intersection = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : intersection / union;
}

function daysSince(isoString) {
  if (!isoString) return null;
  const delta = Date.now() - new Date(isoString).getTime();
  return Math.floor(delta / (1000 * 60 * 60 * 24));
}

async function safeFetch(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

// ─── 1. Google News RSS ───────────────────────────────────────────────────────
// Returns the count of news articles for the startup name (exact-match quoted).
// More articles = more press = real visibility + traction signal.

async function fetchNewsCount(name) {
  try {
    const q = encodeURIComponent(`"${name}"`);
    const url = `https://news.google.com/rss/search?q=${q}&hl=en&gl=US&ceid=US:en`;
    const res = await safeFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; hot-honey-enricher/1.0)' }
    }, 8000);
    if (!res || !res.ok) return { news_article_count: 0 };
    const text = await res.text();
    // Count <item> tags — each is one article
    const count = (text.match(/<item>/g) || []).length;
    return { news_article_count: count };
  } catch {
    return { news_article_count: 0 };
  }
}

// ─── 2. GitHub Search API ────────────────────────────────────────────────────
// Finds the best-matching public GitHub repo for the startup.
// Stars / commit recency / language are strong product-quality signals.

async function fetchGithubSignals(name, website) {
  try {
    const q = encodeURIComponent(name.replace(/[^\w\s]/g, '').substring(0, 50));
    const url = `https://api.github.com/search/repositories?q=${q}+in:name&sort=stars&per_page=5`;
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'hot-honey-enricher/1.0',
    };
    if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;

    const res = await safeFetch(url, { headers }, 8000);
    if (!res || !res.ok) return {};
    const data = await res.json();
    if (!data.items || !data.items.length) return {};

    // Pick best matching repo
    let best = null, bestScore = 0;
    for (const repo of data.items) {
      // Skip huge orgs (Microsoft, Google) unless name matches perfectly
      if (repo.stargazers_count > 500000) continue;
      let score = nameSimilarity(name, repo.name);
      // Bonus if repo homepage matches startup website
      if (website && repo.homepage) {
        const a = website.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
        const b = repo.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
        if (a === b || a.includes(b) || b.includes(a)) score += 0.5;
      }
      // Bonus if org/user name matches startup name
      score += nameSimilarity(name, repo.owner.login) * 0.3;
      if (score > bestScore) { bestScore = score; best = repo; }
    }

    // Reject weak matches (< 25% similarity)
    if (!best || bestScore < 0.25) return {};

    const commitDate = best.pushed_at || best.updated_at;
    return {
      github_repo_name:         best.full_name,
      github_stars:             best.stargazers_count,
      github_forks:             best.forks_count,
      github_last_commit_days:  daysSince(commitDate),
      github_language:          best.language || null,
      github_match_confidence:  Math.round(bestScore * 100),
    };
  } catch {
    return {};
  }
}

// ─── 3. iTunes / App Store Search API ────────────────────────────────────────
// Finds the best-matching iOS/macOS app for the startup.
// Rating count = real users; rating = quality signal.
// Completely free, no authentication required.

async function fetchAppStoreSignals(name) {
  try {
    const term = encodeURIComponent(name.substring(0, 60));
    const url = `https://itunes.apple.com/search?term=${term}&entity=software&limit=5&country=us`;
    const res = await safeFetch(url, {
      headers: { 'User-Agent': 'hot-honey-enricher/1.0' }
    }, 6000);
    if (!res || !res.ok) return {};
    const data = await res.json();
    if (!data.results || !data.results.length) return {};

    // Pick best-matching app
    let best = null, bestScore = 0;
    for (const app of data.results) {
      const sim = nameSimilarity(name, app.trackName || '');
      if (sim > bestScore) { bestScore = sim; best = app; }
    }

    // Reject weak matches (< 30% similarity)
    if (!best || bestScore < 0.30) return {};

    return {
      app_store_app_name:        best.trackName,
      app_store_rating:          best.averageUserRating || null,
      app_store_rating_count:    best.userRatingCount || 0,
      app_store_rating_version:  best.averageUserRatingForCurrentVersion || null,
      app_store_price:           best.formattedPrice || null,
      app_store_match_confidence: Math.round(bestScore * 100),
    };
  } catch {
    return {};
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  Social Signals Fetcher — v${FETCH_VERSION}`);
  console.log(`  Sources: Google News RSS · GitHub API · iTunes Search API`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'} · Batch: ${BATCH_LIMIT} · All: ${FETCH_ALL}`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  // Fetch target startups: approved, GOD score 40–60, not recently enriched
  const cutoffDate = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('startup_uploads')
    .select('id, name, website, total_god_score, extracted_data')
    .eq('status', 'approved')
    .gte('total_god_score', 40)
    .lte('total_god_score', 60)
    .order('total_god_score', { ascending: true })
    .limit(BATCH_LIMIT * 2); // over-fetch so we can filter already-fresh ones

  if (!FETCH_ALL) {
    // Only fetch startups without recent social signals
    // We can't filter on JSONB in a simple .eq, so we fetch and filter in-memory
    // (batching handles load)
  }

  const { data: startups, error } = await query;
  if (error) { console.error('DB fetch error:', error); process.exit(1); }

  // Filter to only stale / never-fetched
  const targets = startups.filter(s => {
    if (FETCH_ALL) return true;
    const sig = s.extracted_data?.social_signals;
    if (!sig) return true; // never fetched
    if (sig.fetch_version !== FETCH_VERSION) return true; // schema changed
    const fetchedDaysAgo = daysSince(sig.fetch_timestamp);
    return fetchedDaysAgo === null || fetchedDaysAgo >= STALE_DAYS;
  }).slice(0, BATCH_LIMIT);

  console.log(`Targets: ${targets.length} startups to enrich`);
  if (!targets.length) { console.log('Nothing to enrich. Done.'); return; }

  const stats = { enriched: 0, skipped: 0, news: 0, github: 0, appstore: 0, errors: 0 };

  for (let i = 0; i < targets.length; i++) {
    const startup = targets[i];
    const label = `[${i + 1}/${targets.length}] ${startup.name} (GOD: ${startup.total_god_score})`;

    try {
      // Run all three sources in parallel, but respect Google News rate limiting
      // by staggering — news last (slowest + strictest)
      const [github, appstore] = await Promise.all([
        fetchGithubSignals(startup.name, startup.website),
        fetchAppStoreSignals(startup.name),
      ]);

      // Delay before Google News to stay under rate limit
      await sleep(NEWS_DELAY_MS);
      const news = await fetchNewsCount(startup.name);

      const signals = {
        ...news,
        ...github,
        ...appstore,
        fetch_timestamp: new Date().toISOString(),
        fetch_version: FETCH_VERSION,
      };

      // Summarize findings
      const parts = [];
      if (news.news_article_count > 0)     parts.push(`news:${news.news_article_count}`);
      if (github.github_stars !== undefined) parts.push(`gh:${github.github_stars}⭐`);
      if (appstore.app_store_rating_count)   parts.push(`app:${appstore.app_store_rating_count}★`);

      if (parts.length)  { console.log(`  ✓ ${label} — ${parts.join('  ')}`); stats.enriched++; }
      else               { console.log(`  · ${label} — no signals found`); stats.skipped++; }
      if (news.news_article_count > 0)     stats.news++;
      if (github.github_stars !== undefined) stats.github++;
      if (appstore.app_store_rating_count)   stats.appstore++;

      if (DRY_RUN) continue;

      // Merge into existing extracted_data (don't overwrite other enriched fields)
      const existing = startup.extracted_data || {};
      const merged = { ...existing, social_signals: signals };

      const { error: uErr } = await supabase
        .from('startup_uploads')
        .update({ extracted_data: merged })
        .eq('id', startup.id);

      if (uErr) {
        console.error(`  ✗ DB update failed for ${startup.name}:`, uErr.message);
        stats.errors++;
      }

    } catch (e) {
      console.error(`  ✗ Error processing ${startup.name}:`, e.message);
      stats.errors++;
    }

    // Small delay between startups (GitHub rate limiting)
    if (i < targets.length - 1) await sleep(GITHUB_DELAY_MS);
  }

  console.log(`\n──────────────────────────────────────────────────────────`);
  console.log(`  Results:`);
  console.log(`    Enriched:   ${stats.enriched} startups`);
  console.log(`    Skipped:    ${stats.skipped} (no signals found)`);
  console.log(`    Errors:     ${stats.errors}`);
  console.log(`    News sigs:  ${stats.news}`);
  console.log(`    GitHub:     ${stats.github}`);
  console.log(`    App Store:  ${stats.appstore}`);
  if (DRY_RUN) console.log(`\n  DRY RUN — no DB writes made.`);
  else         console.log(`\n  Next: run 'npx tsx scripts/recalculate-scores.ts' to apply signals.`);
  console.log(`══════════════════════════════════════════════════════════\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
