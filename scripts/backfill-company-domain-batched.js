#!/usr/bin/env node
/**
 * backfill-company-domain-batched.js
 * ================================
 * Batch backfill for startup_uploads.company_domain and related columns.
 *
 * Usage:
 *   node scripts/backfill-company-domain-batched.js --dry
 *   node scripts/backfill-company-domain-batched.js --apply
 *   node scripts/backfill-company-domain-batched.js --apply --limit=500
 *
 * Notes:
 *   - Requires columns (see migration 20260215_add_domain_normalizer_columns.sql).
 *   - Uses deterministic normalizer; safe to re-run.
 */

const { normalizeCompanyDomain } = require('./startup-domain-normalizer');

async function main() {
  require('dotenv').config();
  const { createClient } = require('@supabase/supabase-js');

  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const dry = args.includes('--dry') || !doApply;
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1000;

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  BACKFILL COMPANY DOMAIN (BATCHED)           ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(dry ? '🔍 DRY RUN\n' : '✍️  APPLY MODE\n');

  let offset = 0;
  let total = 0;
  let assigned = 0;
  let nulled = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('DB Error:', error.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      total++;
      const out = normalizeCompanyDomain(row);

      if (out.company_domain) assigned++;
      else nulled++;

      if (!dry) {
        const patch = {
          company_domain: out.company_domain,
          company_domain_confidence: out.company_domain_confidence,
          domain_source: out.domain_source,
          discovery_source_url: out.discovery_source_url,
          domain_candidates: out.domain_candidates,
        };

        const { error: upErr } = await supabase
          .from('startup_uploads')
          .update(patch)
          .eq('id', row.id);

        if (upErr) console.error(`Update failed ${row.id}:`, upErr.message);
      }
    }

    offset += rows.length;
    console.log(`Processed ${offset} rows… assigned=${assigned} null=${nulled}`);
  }

  console.log('\nDone.');
  console.log(`Total: ${total}`);
  console.log(`Assigned: ${assigned} (${total ? (assigned / total * 100).toFixed(1) : '0.0'}%)`);
  console.log(`NULL: ${nulled} (${total ? (nulled / total * 100).toFixed(1) : '0.0'}%)`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
