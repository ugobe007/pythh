#!/usr/bin/env node
/**
 * JUNK URL CLEANUP
 *
 * Finds approved startups whose website field contains a junk URL
 * (news article, social media, job board, etc. — see lib/junk-url-config.js)
 * and NULLs out the website field so enrichment can re-discover the real URL.
 *
 * Usage:
 *   node scripts/cleanup-junk-urls.js          # dry run (no changes)
 *   node scripts/cleanup-junk-urls.js --apply  # actually update the DB
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isJunkUrl } = require('../lib/junk-url-config');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const DRY_RUN = !process.argv.includes('--apply');

async function run() {
  console.log(DRY_RUN ? '\n[DRY RUN] No changes will be made. Pass --apply to execute.\n' : '\n[LIVE] Applying changes to DB...\n');

  // Fetch ALL approved startups with a non-null website (paginate past 1000-row limit)
  let data = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: batch, error } = await supabase
      .from('startup_uploads')
      .select('id, name, website')
      .eq('status', 'approved')
      .not('website', 'is', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!batch || batch.length === 0) break;
    data = data.concat(batch);
    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  const junk = data.filter(s => isJunkUrl(s.website));
  const clean = data.filter(s => !isJunkUrl(s.website));

  console.log(`Total approved with website : ${data.length}`);
  console.log(`Clean URLs                  : ${clean.length}`);
  console.log(`Junk URLs to clear          : ${junk.length} (${Math.round(junk.length / data.length * 100)}%)`);

  // Domain breakdown
  const domainCount = {};
  junk.forEach(s => {
    try {
      const d = new URL(s.website).hostname.replace('www.', '');
      domainCount[d] = (domainCount[d] || 0) + 1;
    } catch (_) {}
  });

  console.log('\nTop junk domains:');
  Object.entries(domainCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([d, n]) => console.log(`  ${String(n).padStart(4)}  ${d}`));

  console.log('\nSample junk entries (first 15):');
  junk.slice(0, 15).forEach(s =>
    console.log(`  ${(s.name || 'unnamed').substring(0, 32).padEnd(32)}  ${s.website.substring(0, 80)}`)
  );

  if (DRY_RUN) {
    console.log(`\n→ Would null website for ${junk.length} startups.`);
    console.log('  Run with --apply to execute.\n');
    return;
  }

  // Apply in batches of 50 to avoid request size limits
  const BATCH = 50;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < junk.length; i += BATCH) {
    const batch = junk.slice(i, i + BATCH);
    const ids = batch.map(s => s.id);

    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update({ website: null, enrichment_status: 'waiting' })
      .in('id', ids);

    if (updateError) {
      console.error(`  Batch ${i}-${i + BATCH} error:`, updateError.message);
      failed += batch.length;
    } else {
      updated += batch.length;
      process.stdout.write(`  Updated ${updated}/${junk.length}...\r`);
    }
  }

  console.log(`\n\n✅ Done. Cleared ${updated} junk URLs, ${failed} failed.`);
  if (updated > 0) {
    console.log('   Startups reset to enrichment_status=waiting so backfill will re-discover real websites.\n');
  }
}

run().catch(err => {
  console.error('Script error:', err.message);
  process.exit(1);
});
