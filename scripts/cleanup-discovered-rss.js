#!/usr/bin/env node
/**
 * Remove RSS-sourced rows from discovered_startups (fetch-rss-articles.js sets metadata.article_source = 'rss').
 * Uses VITE_SUPABASE_URL + SUPABASE_SERVICE_KEY — no DATABASE_URL / psql required.
 *
 * Usage:
 *   node scripts/cleanup-discovered-rss.js                    # preview counts (no deletes)
 *   node scripts/cleanup-discovered-rss.js --apply --short-body
 *   node scripts/cleanup-discovered-rss.js --apply --purge-unimported
 *   node scripts/cleanup-discovered-rss.js … --include-legacy-rss
 *       # also treat rows with article_url + rss_source as RSS (older rows without metadata)
 *
 * pythh_entities.discovered_startup_id is ON DELETE SET NULL — deleting discovered rows unlinks entities.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const REQUIRED = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
}

const APPLY = process.argv.includes('--apply');
const SHORT_BODY = process.argv.includes('--short-body');
const PURGE = process.argv.includes('--purge-unimported');
const LEGACY_RSS = process.argv.includes('--include-legacy-rss');

const PAGE = 500;
const MIN_DESC = 80;
const DELETE_CHUNK = 200;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function isRssRow(row) {
  let meta = row?.metadata;
  if (meta == null) return false;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      return false;
    }
  }
  return meta && typeof meta === 'object' && meta.article_source === 'rss';
}

/** Older RSS ingest rows may lack metadata.article_source but have article + feed name. */
function isLegacyRssArticle(row) {
  return !!(String(row.article_url || '').trim() && String(row.rss_source || '').trim());
}

function matchesRssIngest(row, legacyRss) {
  return isRssRow(row) || (legacyRss && isLegacyRssArticle(row));
}

/**
 * Pending row — supports forks missing some columns (PostgREST omits unknown keys on select *).
 * Order: explicit imported flag → startup link → imported_at timestamp.
 */
function isUnimported(row) {
  if (row.imported_to_startups === true) return false;
  if (row.startup_id != null && String(row.startup_id).trim() !== '') return false;
  if (row.imported_at != null && String(row.imported_at).trim() !== '') return false;
  return true;
}

function shortBody(row) {
  const d = (row.description || '').trim();
  return d.length < MIN_DESC;
}

async function collectCandidates(mode, legacyRss) {
  const ids = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('discovered_startups')
      .select('*')
      .order('discovered_at', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error('Fetch error:', error.message);
      process.exit(1);
    }
    const rows = data || [];
    for (const row of rows) {
      if (!matchesRssIngest(row, legacyRss) || !isUnimported(row)) continue;
      if (mode === 'short' && !shortBody(row)) continue;
      ids.push(row.id);
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
    if (offset > 500000) {
      console.warn('Stopped scanning at 500k rows (safety cap). Re-run if needed.');
      break;
    }
  }
  return ids;
}

async function deleteByIds(ids) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    const { error } = await supabase.from('discovered_startups').delete().in('id', chunk);
    if (error) {
      console.error('Delete error:', error.message);
      process.exit(1);
    }
    deleted += chunk.length;
    process.stdout.write(`\r  Deleted ${deleted}/${ids.length}`);
  }
  if (ids.length) console.log();
}

async function main() {
  if (APPLY && !SHORT_BODY && !PURGE) {
    console.error('When using --apply, pass exactly one of: --short-body | --purge-unimported');
    process.exit(1);
  }
  if (SHORT_BODY && PURGE) {
    console.error('Pass only one of --short-body or --purge-unimported');
    process.exit(1);
  }

  const mode = PURGE ? 'purge' : SHORT_BODY ? 'short' : 'preview';

  console.log('\n🧹 discovered_startups RSS cleanup');
  console.log('═'.repeat(56));
  console.log(`Mode: ${APPLY ? 'APPLY' : 'PREVIEW (no --apply)'}`);
  if (LEGACY_RSS) console.log('Legacy heuristic: ON (article_url + rss_source counts as RSS)');
  if (mode === 'short') {
    console.log(`Target: RSS ingest row, not imported, description < ${MIN_DESC} chars`);
  } else if (mode === 'purge') {
    console.log('Target: RSS ingest row AND still pending (import flag / startup_id / imported_at if present)');
  } else {
    console.log('Preview: strict vs legacy counts (no deletes).');
  }
  console.log('═'.repeat(56) + '\n');

  if (!APPLY && mode === 'preview') {
    const idsPurgeStrict = await collectCandidates('purge', false);
    const idsShortStrict = await collectCandidates('short', false);
    const idsPurgeLegacy = await collectCandidates('purge', true);
    const idsShortLegacy = await collectCandidates('short', true);
    console.log('Strict (metadata.article_source = \'rss\' only):');
    console.log(`  Purge pool:  ${idsPurgeStrict.length}`);
    console.log(`  Short-body:  ${idsShortStrict.length}`);
    console.log('With legacy (article_url + rss_source, unimported):');
    console.log(`  Purge pool:  ${idsPurgeLegacy.length}`);
    console.log(`  Short-body:  ${idsShortLegacy.length}`);
    console.log('\n💡 To delete short-body junk:  node scripts/cleanup-discovered-rss.js --apply --short-body [--include-legacy-rss]');
    console.log('💡 To delete ALL unimported RSS: node scripts/cleanup-discovered-rss.js --apply --purge-unimported [--include-legacy-rss]');
    return;
  }

  if (!APPLY) {
    const idsPurge = await collectCandidates('purge', LEGACY_RSS);
    const idsShort = await collectCandidates('short', LEGACY_RSS);
    console.log(`Unimported RSS rows (would purge-all): ${idsPurge.length}`);
    console.log(`Unimported RSS + short/empty description:     ${idsShort.length}`);
    console.log('\n💡 To delete short-body junk:  node scripts/cleanup-discovered-rss.js --apply --short-body [--include-legacy-rss]');
    console.log('💡 To delete ALL unimported RSS: node scripts/cleanup-discovered-rss.js --apply --purge-unimported [--include-legacy-rss]');
    return;
  }

  const subMode = mode === 'short' ? 'short' : 'purge';
  const toDelete = await collectCandidates(subMode, LEGACY_RSS);
  if (!toDelete.length) {
    console.log('\nNothing to delete.');
    return;
  }
  console.log(`\nDeleting ${toDelete.length} row(s)…`);
  await deleteByIds(toDelete);
  console.log('Done.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
