#!/usr/bin/env node
/**
 * BACKFILL PYTHH SIGNALS
 * ──────────────────────────────────────────────────────────────────────────
 * Runs parseSignal() against all discovered_startups records that have an
 * article_title but no signal data stored in metadata.signals.
 *
 * Writes the compact signal block back to metadata.signals (JSONB merge-patch).
 *
 * Usage:
 *   node scripts/backfill-pythh-signals.js              # dry-run (print stats)
 *   node scripts/backfill-pythh-signals.js --apply      # write to DB
 *   node scripts/backfill-pythh-signals.js --apply --limit 500
 *   node scripts/backfill-pythh-signals.js --apply --batch 50  # records per batch
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { parseSignal }  = require('../lib/signalParser');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) { console.error(`❌ FATAL: Missing ${key}`); process.exit(1); }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const DRY_RUN   = !process.argv.includes('--apply');
const LIMIT     = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 5000;
})();
const BATCH_SZ  = (() => {
  const idx = process.argv.indexOf('--batch');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 100;
})();

// Evidence quality → numeric urgency for quick sorting
const EQ_RANK = { confirmed: 4, inferred: 3, speculative: 2, negated: 1, 'low-information': 0 };

async function main() {
  console.log('\n🔄 PYTHH SIGNAL BACKFILL');
  console.log('═'.repeat(60));
  console.log(`Mode:      ${DRY_RUN ? '🔍 DRY-RUN (no writes)' : '✍️  APPLY'}`);
  console.log(`Limit:     ${LIMIT} records`);
  console.log(`Batch:     ${BATCH_SZ} per round`);
  console.log('═'.repeat(60));

  // Fetch records missing signals — prioritise by newest article_date
  // Uses the Postgres JSONB operator to check for absence of metadata->signals
  const { data: rows, error } = await supabase
    .from('discovered_startups')
    .select('id, name, article_title, description, metadata')
    .not('article_title', 'is', null)
    .or('metadata.is.null,metadata->signals.is.null')
    .order('article_date', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (error) {
    console.error('❌ Fetch failed:', error.message);
    process.exit(1);
  }

  console.log(`\n📊 Records to process: ${rows?.length ?? 0}\n`);
  if (!rows?.length) { console.log('✅ Nothing to backfill — all records already have signals.'); return; }

  const stats = { total: rows.length, parsed: 0, skipped: 0, errors: 0,
    by_evidence: { confirmed: 0, inferred: 0, speculative: 0, negated: 0, 'low-information': 0 } };

  // Process in batches to avoid memory spikes
  for (let i = 0; i < rows.length; i += BATCH_SZ) {
    const batch = rows.slice(i, i + BATCH_SZ);
    const updates = [];

    for (const row of batch) {
      try {
        const text = `${row.article_title || ''} ${row.description || ''}`.slice(0, 2000);
        const sig  = parseSignal(text);

        if (!sig) { stats.skipped++; continue; }

        const signalBlock = {
          primary:    sig.primary_signal,
          classes:    sig.signal_classes,
          confidence: sig.confidence,
          evidence:   sig.evidence_quality,
          strength:   sig.signal_strength,
          ambiguity:  sig.ambiguity_flags,
          who_cares:  sig.who_cares,
          inference:  sig.inference,
        };

        stats.parsed++;
        stats.by_evidence[sig.evidence_quality] = (stats.by_evidence[sig.evidence_quality] || 0) + 1;

        if (!DRY_RUN) {
          updates.push({
            id:       row.id,
            metadata: { ...(row.metadata || {}), signals: signalBlock },
          });
        } else {
          // Dry-run: print a sample every 50 rows
          if (stats.parsed % 50 === 1) {
            console.log(`  [${row.id}] ${row.name || '(no name)'}`);
            console.log(`         → ${sig.primary_signal} | ${sig.evidence_quality} | conf=${sig.confidence.toFixed(2)}`);
          }
        }
      } catch (e) {
        stats.errors++;
      }
    }

    // Write batch
    if (!DRY_RUN && updates.length > 0) {
      for (const upd of updates) {
        const { error: upErr } = await supabase
          .from('discovered_startups')
          .update({ metadata: upd.metadata })
          .eq('id', upd.id);
        if (upErr) stats.errors++;
      }
      process.stdout.write(`\r   Written: ${Math.min(i + BATCH_SZ, rows.length)}/${rows.length}`);
    } else if (DRY_RUN) {
      process.stdout.write(`\r   Parsed:  ${Math.min(i + BATCH_SZ, rows.length)}/${rows.length}`);
    }
  }

  // Final report
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Total records:    ${stats.total}`);
  console.log(`Signals parsed:   ${stats.parsed}`);
  console.log(`Skipped (empty):  ${stats.skipped}`);
  console.log(`Errors:           ${stats.errors}`);
  console.log('');
  console.log('Evidence quality breakdown:');
  for (const [eq, count] of Object.entries(stats.by_evidence).sort((a, b) => EQ_RANK[b[0]] - EQ_RANK[a[0]])) {
    const bar = '█'.repeat(Math.round(count / Math.max(stats.parsed, 1) * 30));
    console.log(`  ${eq.padEnd(16)} ${String(count).padStart(5)}  ${bar}`);
  }
  if (DRY_RUN) {
    console.log('\n💡 Run with --apply to write signals to the database.');
  } else {
    console.log('\n✅ Backfill complete. Signal Feed will now show data for all records.');
  }
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err); process.exit(1); });
