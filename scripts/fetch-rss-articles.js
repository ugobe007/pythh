#!/usr/bin/env node
/**
 * FETCH RSS ARTICLES
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads active RSS sources from the rss_sources table, parses each feed, and
 * saves article text to discovered_startups so the signal pipeline has rich
 * textual content to parse.
 *
 * Key difference from enhanced-startup-discovery.js:
 *   - Saves ALL articles (no MIN_SIGNALS gate)
 *   - Captures article_title, article_url, article_date, description (body)
 *   - Uses rss-parser to handle RSS 2.0 + Atom feeds natively
 *   - Strips HTML from article bodies to produce clean parseable text
 *   - Skips items that fail lib/source-quality-filter.js (same as ssot-rss-scraper)
 *   - Also activates high-priority RSS sources if none are active
 *
 * Usage:
 *   node scripts/fetch-rss-articles.js              # dry-run
 *   node scripts/fetch-rss-articles.js --apply
 *   node scripts/fetch-rss-articles.js --apply --limit 20   # max 20 sources
 *   node scripts/fetch-rss-articles.js --apply --sources 50 # same as --limit (alias)
 *   node scripts/fetch-rss-articles.js --activate          # activate top sources
 */

'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const RSSParser        = require('rss-parser');
const { shouldProcessEvent } = require('../lib/source-quality-filter');
const { isVcNewsDailyHomepageUrl, fetchVcNewsDailyHomepageItems } = require('../lib/vcNewsDailyHomepage');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) { console.error(`❌ Missing ${k}`); process.exit(1); }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── CLI flags ──────────────────────────────────────────────────────────────
function argVal(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const DRY_RUN        = !process.argv.includes('--apply');
const ACTIVATE_MODE  =  process.argv.includes('--activate');
// `--sources` is an alias for `--limit` (max RSS sources per run)
const SOURCE_LIMIT   = +(argVal('--limit', argVal('--sources', '30')));
const ARTICLE_LIMIT  = +(argVal('--articles',     '20'));   // max articles per source
const MIN_TEXT_LEN   = +(argVal('--min-text',     '80'));   // min chars for body

// ── HTML stripping ──────────────────────────────────────────────────────────
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Extract best body text from RSS item ───────────────────────────────────
function extractBody(item) {
  const candidates = [
    item['content:encoded'],
    item.content,
    item.summary,
    item.description,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const clean = stripHtml(c);
    if (clean.length >= MIN_TEXT_LEN) return clean.slice(0, 3000);
  }
  return null;
}

// ── Extract startup name hint from headline ────────────────────────────────
// Very light heuristic — just keep the title as-is; the signal parser will handle it
function titleToName(title) {
  if (!title) return null;
  // Try "Startup raises $Xm" → "Startup"
  const m = title.match(/^([A-Z][A-Za-z0-9 .&']{2,40})\s+(raises?|secures?|closes?|launches?|acquires?|announces?)/i);
  if (m) return m[1].trim();
  return null;
}

/** Matches idx_discovered_startups_unique: (LOWER(name), COALESCE(LOWER(website), '')) */
function nameWebsiteKey(name, website) {
  const n = String(name || '').trim().toLowerCase();
  const w = String(website || '').trim().toLowerCase();
  return `${n}|${w}`;
}

/** Stable short tag from URL so two articles with the same extracted name don't collide. */
function shortDedupeSuffix(url) {
  const s = String(url || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

/**
 * Ensure `name` + null website is unique for idx_discovered_startups_unique.
 * RSS rows often omit website; many headlines map to the same hint → batch INSERT fails entirely.
 */
function disambiguateNameForUniqueIndex(baseName, articleUrl, usedKeys) {
  const base = (baseName || 'Article').trim().slice(0, 220) || 'Article';
  let candidate = base;
  let key = nameWebsiteKey(candidate, null);
  if (!usedKeys.has(key)) {
    usedKeys.add(key);
    return candidate;
  }
  const tag = shortDedupeSuffix(articleUrl);
  candidate = `${base} ·${tag}`;
  key = nameWebsiteKey(candidate, null);
  let n = 0;
  while (usedKeys.has(key) && n < 20) {
    n++;
    candidate = `${base} ·${tag}${n}`;
    key = nameWebsiteKey(candidate, null);
  }
  usedKeys.add(key);
  return candidate;
}

/**
 * Build insert row for discovered_startups — only columns present on every project.
 * Do not send `latest_funding_amount` (or other startup_uploads-only metrics): many
 * `discovered_startups` tables / PostgREST schema caches have no such column, and
 * projects that added it with wrong defaults caused type errors. Omit entirely; add via migration + backfill if needed.
 */
function buildDiscoveredRssRow({ nameHint, item, url, articleDate, body, source }) {
  return {
    name: nameHint,
    article_title: item.title?.slice(0, 500) || null,
    article_url: url,
    article_date: articleDate,
    description: body,
    rss_source: source.name,
    sectors: [],
    metadata: {
      feed_category: source.category,
      feed_id: source.id,
      article_source: 'rss',
    },
    imported_to_startups: false,
  };
}

// ── Activate top-priority inactive sources ─────────────────────────────────
async function activateTopSources() {
  console.log('\n⚡ ACTIVATE MODE: enabling top RSS sources');
  const { data: sources } = await supabase
    .from('rss_sources')
    .select('id, name, category, priority')
    .eq('active', false)
    .order('priority', { ascending: false })
    .limit(60);

  if (!sources?.length) { console.log('   No inactive sources found.'); return; }

  // Prefer startup/funding/VC categories
  const PRIORITY_CATS = ['Startup News', 'Funding News', 'VC News', 'Tech News'];
  const toActivate = sources
    .sort((a, b) => {
      const aScore = PRIORITY_CATS.indexOf(a.category) >= 0 ? 1 : 0;
      const bScore = PRIORITY_CATS.indexOf(b.category) >= 0 ? 1 : 0;
      return bScore - aScore || (b.priority || 0) - (a.priority || 0);
    })
    .slice(0, 50)
    .map(s => s.id);

  const { error } = await supabase
    .from('rss_sources')
    .update({ active: true })
    .in('id', toActivate);

  if (error) { console.error('   Error activating:', error.message); }
  else {
    console.log(`   ✅ Activated ${toActivate.length} RSS sources.`);
    console.log('   Now run: node scripts/fetch-rss-articles.js --apply');
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  if (ACTIVATE_MODE) { await activateTopSources(); return; }

  console.log('\n📡 RSS ARTICLE FETCHER');
  console.log('═'.repeat(60));
  console.log(`Mode:            ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Max sources:     ${SOURCE_LIMIT}`);
  console.log(`Articles/source: ${ARTICLE_LIMIT}`);
  console.log(`Min body chars:  ${MIN_TEXT_LEN}`);
  console.log('═'.repeat(60) + '\n');

  // Load active sources (fall back to all if none active)
  let { data: sources } = await supabase
    .from('rss_sources')
    .select('id, name, url, category')
    .eq('active', true)
    .order('priority', { ascending: false })
    .limit(SOURCE_LIMIT);

  if (!sources?.length) {
    console.log('⚠️  No active RSS sources. Run --activate first, or using all sources...');
    const { data: allSrc } = await supabase
      .from('rss_sources')
      .select('id, name, url, category')
      .order('priority', { ascending: false })
      .limit(SOURCE_LIMIT);
    sources = allSrc || [];
  }

  console.log(`📋 Sources to scrape: ${sources.length}\n`);

  // Pre-load existing article_urls to skip duplicates
  console.log('🔎 Loading existing article URLs for dedup...');
  const existingUrls = new Set();
  const { data: existingRows } = await supabase
    .from('discovered_startups')
    .select('article_url')
    .not('article_url', 'is', null)
    .limit(30000);
  for (const r of (existingRows || [])) if (r.article_url) existingUrls.add(r.article_url);
  console.log(`   Existing URLs loaded: ${existingUrls.size}`);

  // Preload (name, website) keys so we can disambiguate before INSERT — avoids failing whole batches
  // on idx_discovered_startups_unique (LOWER(name), COALESCE(LOWER(website), '')).
  const usedNameWebsiteKeys = new Set();
  {
    const PAGE = 1000;
    let off = 0;
    for (;;) {
      const { data: nkRows, error: nkErr } = await supabase
        .from('discovered_startups')
        .select('name, website')
        .order('discovered_at', { ascending: false })
        .range(off, off + PAGE - 1);
      if (nkErr) {
        console.warn('   (warn) could not preload name/website keys:', nkErr.message);
        break;
      }
      const chunk = nkRows || [];
      for (const r of chunk) usedNameWebsiteKeys.add(nameWebsiteKey(r.name, r.website));
      if (chunk.length < PAGE) break;
      off += PAGE;
      if (off >= 100000) break;
    }
  }
  console.log(`   Existing (name,website) keys: ${usedNameWebsiteKeys.size}\n`);

  const parser = new RSSParser({
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PythhBot/1.0)' },
    customFields: {
      item: ['content:encoded', 'content', 'summary'],
    },
  });

  const stats = {
    sources_ok: 0, sources_err: 0,
    articles_found: 0, articles_saved: 0,
    articles_skipped_dup: 0, articles_skipped_short: 0,
    articles_skipped_quality: 0,
    errors: 0,
  };
  const rowErrorSamples = new Set();
  const logRowInsertError = (msg) => {
    const key = (msg || '').slice(0, 90);
    if (rowErrorSamples.has(key)) return;
    rowErrorSamples.add(key);
    console.error('   row insert:', key);
  };

  const toInsert = [];
  const FLUSH_SIZE = 50;

  async function flush(force = false) {
    if (!DRY_RUN && (force || toInsert.length >= FLUSH_SIZE)) {
      const batch = toInsert.splice(0, toInsert.length);
      if (!batch.length) return;
      const { error } = await supabase.from('discovered_startups').insert(batch);
      if (!error) {
        stats.articles_saved += batch.length;
        return;
      }
      console.error('\n   DB insert error (batch):', error.message.slice(0, 160));
      stats.errors++;
      for (const row of batch) {
        const { error: e2 } = await supabase.from('discovered_startups').insert([row]);
        if (!e2) {
          stats.articles_saved++;
          continue;
        }
        if (e2.code === '23505' || /duplicate key/i.test(e2.message || '')) {
          stats.articles_skipped_dup++;
        } else {
          stats.errors++;
          logRowInsertError(e2.message || '');
        }
      }
    }
  }

  for (const source of sources) {
    process.stdout.write(`\n📰 ${source.name.padEnd(40)} `);

    let feed;
    try {
      if (isVcNewsDailyHomepageUrl(source.url)) {
        const items = await fetchVcNewsDailyHomepageItems({
          userAgent: 'Mozilla/5.0 (compatible; PythhBot/1.0)',
        });
        feed = { items };
      } else {
        feed = await parser.parseURL(source.url);
      }
      stats.sources_ok++;
      process.stdout.write(`✓  (${feed.items?.length || 0} items)`);
    } catch (err) {
      stats.sources_err++;
      process.stdout.write(`✗  ${err.message.slice(0, 50)}`);
      try {
        await supabase.from('rss_sources').update({ last_error: err.message.slice(0, 200) }).eq('id', source.id);
      } catch { /* ignore */ }
      continue;
    }

    const items = (feed.items || []).slice(0, ARTICLE_LIMIT);
    let added = 0;

    for (const item of items) {
      stats.articles_found++;
      const url = item.link || item.guid;
      if (!url) continue;

      if (!shouldProcessEvent(item.title || '', source.name).keep) {
        stats.articles_skipped_quality++;
        continue;
      }

      // Dedup
      if (existingUrls.has(url)) { stats.articles_skipped_dup++; continue; }
      existingUrls.add(url);

      // Extract body
      const body = extractBody(item);
      if (!body || body.length < MIN_TEXT_LEN) {
        stats.articles_skipped_short++;
        continue;
      }

      // Article date
      const rawDate = item.pubDate || item.isoDate || item.date;
      const articleDate = rawDate ? new Date(rawDate).toISOString() : null;

      // Startup name hint from headline (disambiguate for DB unique index on name + website)
      const rawHint = titleToName(item.title) || item.title?.slice(0, 80) || 'Unknown';
      const nameHint = disambiguateNameForUniqueIndex(rawHint, url, usedNameWebsiteKeys);

      const record = buildDiscoveredRssRow({
        nameHint,
        item,
        url,
        articleDate,
        body,
        source,
      });

      if (DRY_RUN) {
        console.log(`\n   [DRY] "${item.title?.slice(0,60)}" → ${body.length} chars`);
        stats.articles_saved++;
      } else {
        toInsert.push(record);
        added++;
      }
    }

    if (added > 0) process.stdout.write(`  → +${added} new`);

    // Update last_scraped on source
    if (!DRY_RUN) {
      try {
        await supabase.from('rss_sources').update({ last_scraped: new Date().toISOString() }).eq('id', source.id);
      } catch { /* ignore */ }
    }

    await flush();
    await new Promise(r => setTimeout(r, 300)); // polite delay
  }

  await flush(true);

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Sources OK:           ${stats.sources_ok}`);
  console.log(`Sources failed:       ${stats.sources_err}`);
  console.log(`Articles found:       ${stats.articles_found}`);
  console.log(`Saved to DB:          ${DRY_RUN ? '(dry-run)' : stats.articles_saved}`);
  console.log(`Skipped (duplicate):  ${stats.articles_skipped_dup}`);
  console.log(`Skipped (too short):  ${stats.articles_skipped_short}`);
  console.log(`Skipped (source Q):   ${stats.articles_skipped_quality}`);
  console.log(`Errors:               ${stats.errors}`);

  if (DRY_RUN) {
    console.log('\n💡 Run with --apply to write to discovered_startups.');
    console.log('   Then run: node scripts/ingest-discovered-signals.js --apply --skip-existing');
  } else {
    console.log('\n✅ Articles fetched. Next:');
    console.log('   node scripts/ingest-discovered-signals.js --apply --skip-existing --limit 10000');
  }
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
