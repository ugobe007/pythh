#!/usr/bin/env node
/**
 * RSS feed health — find stale, dead, and noisy sources.
 *
 * Usage:
 *   node scripts/diagnostics/rss-feed-health.js
 *   node scripts/diagnostics/rss-feed-health.js --test          # probe each active feed
 *   node scripts/diagnostics/rss-feed-health.js --test --deactivate  # probe + disable dead/stale feeds
 */
'use strict';

require('dotenv').config();
const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const { isArticleFresh, maxArticleAgeDays } = require('../../lib/rssArticleFreshness');

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PythhHealthCheck/1.0)' },
});

const args = process.argv.slice(2);
const doTest = args.includes('--test');
const doDeactivate = args.includes('--deactivate');
const limitArg = args.find((a) => a.startsWith('--limit='));
const testLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

const FUNDING_CATEGORIES = /funding|startup|venture|vc|deal|seed|series/i;

async function main() {
  const { data: sources, error } = await sb.from('rss_sources').select('*').order('name');
  if (error) throw error;

  const now = Date.now();
  const active = sources.filter((s) => s.active);
  const inactive = sources.filter((s) => !s.active);
  const never = active.filter((s) => !s.last_scraped);
  const stale48h = active.filter((s) => {
    if (!s.last_scraped) return true;
    return now - new Date(s.last_scraped).getTime() > 48 * 3600 * 1000;
  });
  const fundingFocused = active.filter((s) => FUNDING_CATEGORIES.test(s.category || ''));

  console.log('\n' + '='.repeat(72));
  console.log('  RSS FEED HEALTH');
  console.log('='.repeat(72));
  console.log(`  Total sources:     ${sources.length}`);
  console.log(`  Active:            ${active.length}`);
  console.log(`  Inactive:          ${inactive.length}`);
  console.log(`  Never scraped:     ${never.length}`);
  console.log(`  Stale (>48h):      ${stale48h.length}`);
  console.log(`  Funding/VC tagged: ${fundingFocused.length}`);
  console.log(`  Freshness window:  ${maxArticleAgeDays()} days (MAX_ARTICLE_AGE_DAYS)`);

  const tables = [
    ['startup_events', 'created_at'],
    ['pythh_signal_events', 'created_at'],
    ['discovered_startups', 'discovered_at'],
  ];
  console.log('\n── Ingestion volume ──');
  for (const [table, col] of tables) {
    const day1 = new Date(now - 24 * 3600 * 1000).toISOString();
    const day7 = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const { count: c24 } = await sb.from(table).select('*', { count: 'exact', head: true }).gte(col, day1);
    const { count: c7 } = await sb.from(table).select('*', { count: 'exact', head: true }).gte(col, day7);
    console.log(`  ${table.padEnd(22)} 24h: ${String(c24 ?? 0).padStart(5)}   7d: ${c7 ?? 0}`);
  }

  if (stale48h.length) {
    console.log('\n── Stale active sources (sample) ──');
    stale48h.slice(0, 12).forEach((s) => {
      const ago = s.last_scraped
        ? `${Math.round((now - new Date(s.last_scraped).getTime()) / 3600000)}h ago`
        : 'never';
      console.log(`  ${s.name.padEnd(32)} ${ago}`);
    });
    if (stale48h.length > 12) console.log(`  … and ${stale48h.length - 12} more`);
  }

  if (!doTest) {
    console.log('\n── Recommended actions ──');
    console.log('  1. Probe feeds:       node scripts/diagnostics/rss-feed-health.js --test');
    console.log('  2. Repair/deactivate: npx tsx scripts/fix-rss-sources.ts');
    console.log('  3. Purge RSS junk:    npm run startup:tighten -- --run-entity-gate --rss-gate-exclude-junk');
    console.log('  4. Freshness is now enforced in scrapers (MAX_ARTICLE_AGE_DAYS=14 default)\n');
    return;
  }

  const toTest = testLimit ? active.slice(0, testLimit) : active;
  console.log(`\n── Probing ${toTest.length} active feeds ──\n`);

  let ok = 0;
  let dead = 0;
  let staleItems = 0;
  const problems = [];

  for (const source of toTest) {
    process.stdout.write(`  ${source.name.slice(0, 36).padEnd(36)} `);
    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items || [];
      const fresh = items.filter((i) => isArticleFresh(i.pubDate || i.isoDate).fresh);
      const newest = items.reduce((best, i) => {
        const d = new Date(i.pubDate || i.isoDate || 0);
        return d > best ? d : best;
      }, new Date(0));
      ok++;
      staleItems += items.length - fresh.length;
      const newestStr = newest.getTime() > 0 ? newest.toISOString().slice(0, 10) : '?';
      console.log(`OK  ${items.length} items, ${fresh.length} fresh, newest ${newestStr}`);
      if (items.length === 0) {
        problems.push({ source, issue: 'empty_feed' });
      } else if (fresh.length === 0) {
        problems.push({ source, issue: 'all_items_stale', newest: newestStr });
      }
    } catch (e) {
      dead++;
      console.log(`FAIL  ${(e.message || e).slice(0, 60)}`);
      problems.push({ source, issue: 'fetch_failed', error: e.message });
    }
  }

  console.log('\n── Probe summary ──');
  console.log(`  OK: ${ok}   Dead: ${dead}   Stale items skipped (if scraped): ${staleItems}`);
  if (problems.length) {
    console.log('\n── Problem feeds ──');
    problems.forEach((p) => {
      console.log(`  ${p.source.name}: ${p.issue}${p.error ? ` (${p.error.slice(0, 50)})` : ''}${p.newest ? ` newest ${p.newest}` : ''}`);
    });
  }

  if (doDeactivate && problems.length) {
    console.log(`\n── Deactivating ${problems.length} problem feeds ──`);
    let deactivated = 0;
    for (const p of problems) {
      const { error: updErr } = await sb
        .from('rss_sources')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', p.source.id);
      if (!updErr) {
        deactivated++;
        console.log(`  ✓ off  ${p.source.name} (${p.issue})`);
      } else {
        console.log(`  ✗ fail ${p.source.name}: ${updErr.message}`);
      }
    }
    const { count: activeAfter } = await sb
      .from('rss_sources')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);
    console.log(`\n  Deactivated: ${deactivated}   Active remaining: ${activeAfter ?? '?'}`);
  } else if (doDeactivate) {
    console.log('\n  No problem feeds to deactivate.');
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
