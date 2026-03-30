#!/usr/bin/env node
/**
 * SECTOR NORMALIZATION
 *
 * Consolidates sector variants (Fintech/FinTech, Climate/Climate Tech, etc.)
 * using server/lib/sectorTaxonomy.js.
 *
 * Usage:
 *   node scripts/normalize-sectors.js --dry-run   # Preview changes, no DB writes
 *   node scripts/normalize-sectors.js             # Apply to startup_uploads
 *   node scripts/normalize-sectors.js --investors # Also normalize investors
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { normalizeSectors } = require('../server/lib/sectorTaxonomy');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const dryRun = process.argv.includes('--dry-run');
const includeInvestors = process.argv.includes('--investors');

function sectorsEqual(a, b) {
  if (!Array.isArray(a)) a = [];
  if (!Array.isArray(b)) b = [];
  const sa = [...a].sort().join('|');
  const sb = [...b].sort().join('|');
  return sa === sb;
}

const BATCH_SIZE = 50; // parallel updates per batch

async function normalizeTable(table, idField, sectorsField) {
  console.log(`\n${table} (${sectorsField})`);
  console.log('─'.repeat(50));

  process.stdout.write('  Fetching rows');
  let all = [];
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(`${idField}, name, ${sectorsField}`)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) {
      console.error('\nSupabase error:', error.message);
      return { updated: 0, skipped: 0 };
    }
    all = all.concat(data || []);
    process.stdout.write(` ${all.length}`);
    if (!data || data.length < PAGE) break;
    page++;
  }
  console.log(`\n  Loaded ${all.length.toLocaleString()} rows. Analyzing...`);

  let updated = 0;
  let skipped = 0;
  const changes = [];

  for (const row of all) {
    const current = row[sectorsField] || [];
    if (!Array.isArray(current) || current.length === 0) {
      skipped++;
      continue;
    }

    const normalized = normalizeSectors(current);
    if (sectorsEqual(current, normalized)) {
      skipped++;
      continue;
    }

    changes.push({
      id: row[idField],
      name: row.name || '(unnamed)',
      before: current,
      after: normalized,
    });
    updated++;
  }

  // Show sample changes
  changes.slice(0, 15).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name.substring(0, 35).padEnd(36)}`);
    console.log(`     Before: ${c.before.join(', ')}`);
    console.log(`     After:  ${c.after.join(', ')}`);
  });
  if (changes.length > 15) {
    console.log(`  ... and ${changes.length - 15} more`);
  }

  // Apply updates in parallel batches
  if (!dryRun && changes.length > 0) {
    console.log(`\n  Applying ${changes.length} updates (batches of ${BATCH_SIZE})...`);
    for (let i = 0; i < changes.length; i += BATCH_SIZE) {
      const batch = changes.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((c) =>
          supabase.from(table).update({ [sectorsField]: c.after }).eq(idField, c.id)
        )
      );
      const failed = results.filter((r) => r.error).length;
      if (failed > 0) {
        results.forEach((r, j) => {
          if (r.error) console.error(`  Failed ${batch[j].name}:`, r.error.message);
        });
        updated -= failed;
      }
      process.stdout.write(` ${i + batch.length}/${changes.length}`);
    }
    console.log(' done.');
  }

  console.log(`\n  Total rows: ${all.length}`);
  console.log(`  ${dryRun ? 'Would update' : 'Updated'}: ${updated}`);
  console.log(`  Unchanged: ${skipped}`);
  return { updated, skipped };
}

async function main() {
  console.log('\n📐 SECTOR NORMALIZATION');
  console.log('═'.repeat(50));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'APPLY'}`);
  console.log('');

  const startupResult = await normalizeTable('startup_uploads', 'id', 'sectors');

  if (includeInvestors) {
    const investorResult = await normalizeTable('investors', 'id', 'sectors');
    console.log('\n  Investors updated:', investorResult.updated);
  }

  console.log('\n' + '═'.repeat(50));
  if (dryRun && startupResult.updated > 0) {
    console.log('Run without --dry-run to apply these changes.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
