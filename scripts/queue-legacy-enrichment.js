#!/usr/bin/env node
/**
 * QUEUE LEGACY ENRICHMENT
 * =======================
 * Resets enrichment_status → NULL for approved rows that have no data_tier
 * so that enrich-sparse-startups.js picks them up in --html-only mode.
 *
 * Targets:
 *   status = 'approved'
 *   AND (extracted_data->>'data_tier' IS NULL OR extracted_data IS NULL)
 *
 * Safe to re-run: rows already enriched (with a data_tier) are untouched.
 *
 * Usage:
 *   node scripts/queue-legacy-enrichment.js [--dry-run] [--limit=5000]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN  = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5000;
const BATCH    = 500;

async function main() {
  console.log('═'.repeat(70));
  console.log('  QUEUE LEGACY ENRICHMENT — reset enrichment_status for no-tier rows');
  console.log('═'.repeat(70));
  console.log(`  Mode:  ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`  Limit: ${LIMIT} rows per run\n`);

  let offset = 0;
  let totalQueued = 0;

  while (offset < LIMIT) {
    const fetchLimit = Math.min(BATCH, LIMIT - offset);

    // Fetch rows with no data_tier
    const { data: rows, error } = await supabase
      .from('startup_uploads')
      .select('id, name, enrichment_status, extracted_data')
      .eq('status', 'approved')
      .or('extracted_data.is.null,extracted_data->>data_tier.is.null')
      .range(offset, offset + fetchLimit - 1);

    if (error) {
      console.error('Query error:', error.message);
      break;
    }

    if (!rows || rows.length === 0) break;

    // Filter to those that truly lack data_tier (extra safety check in JS)
    const candidates = rows.filter(r => {
      const tier = r.extracted_data?.data_tier;
      return !tier;
    });

    console.log(`Batch ${Math.floor(offset / BATCH) + 1}: fetched ${rows.length}, candidates ${candidates.length}`);

    if (candidates.length > 0 && !DRY_RUN) {
      const ids = candidates.map(r => r.id);
      const { error: updateErr } = await supabase
        .from('startup_uploads')
        .update({ enrichment_status: null, enrichment_attempts: 0 })
        .in('id', ids);

      if (updateErr) {
        console.error('Update error:', updateErr.message);
      } else {
        totalQueued += candidates.length;
        console.log(`  ✓ Reset ${candidates.length} rows → enrichment_status=NULL`);
      }
    } else if (DRY_RUN) {
      totalQueued += candidates.length;
      console.log(`  [dry-run] Would reset ${candidates.length} rows`);
      candidates.slice(0, 5).forEach(r =>
        console.log(`    • ${r.name || r.id} (status: ${r.enrichment_status ?? 'null'})`)
      );
    }

    offset += rows.length;
    if (rows.length < fetchLimit) break; // no more rows
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`  Total queued: ${totalQueued} rows`);
  if (!DRY_RUN && totalQueued > 0) {
    console.log('\n  Next step:');
    console.log('    node scripts/enrich-sparse-startups.js --html-only --run-all --god-score-below=100 --limit=200');
  }
  console.log('═'.repeat(70));
}

main().catch(e => { console.error(e); process.exit(1); });
