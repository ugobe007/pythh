/**
 * BACKFILL-SIGNAL-EVENTS
 * ======================
 * Populates signal_events (Layer 1 raw evidence) from existing startup_signal_scores
 * (Layer 2 aggregated scores). Each startup with a non-trivial signal score gets
 * one synthetic 'enrichment' event per active signal dimension.
 *
 * Run once after deploying the signal_events schema.
 * Usage: node scripts/backfill-signal-events.js [--limit=N] [--dry-run]
 */

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const LIMIT = parseInt((args.find(a => a.startsWith('--limit=')) || '--limit=1000').split('=')[1]);
const DRY_RUN = args.includes('--dry-run');

async function backfill() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  BACKFILL SIGNAL EVENTS');
  console.log(`  Limit: ${LIMIT} | Dry-run: ${DRY_RUN}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Check how many already exist
  const { count: existingCount } = await supabase
    .from('signal_events')
    .select('*', { count: 'exact', head: true });
  console.log(`Signal events already in DB: ${existingCount}`);

  // 2. Get set of approved startup IDs
  const approvedMap = {};
  let approvedPage = 0;
  while (true) {
    const { data: batch } = await supabase
      .from('startup_uploads')
      .select('id, website, total_god_score')
      .eq('status', 'approved')
      .range(approvedPage * 1000, approvedPage * 1000 + 999);
    if (!batch || batch.length === 0) break;
    batch.forEach(s => { approvedMap[s.id] = s; });
    if (batch.length < 1000) break;
    approvedPage++;
  }
  console.log(`Approved startups: ${Object.keys(approvedMap).length}`);

  // 3. Fetch signal scores paginated
  let scores = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (scores.length < LIMIT) {
    const remaining = LIMIT - scores.length;
    const fetchSize = Math.min(remaining, PAGE_SIZE);
    const { data: batch, error } = await supabase
      .from('startup_signal_scores')
      .select('startup_id, signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity, as_of')
      .gt('signals_total', 3.0)
      .order('signals_total', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + fetchSize - 1);

    if (error) {
      console.error('Failed to fetch signal scores:', error.message);
      process.exit(1);
    }
    if (!batch || batch.length === 0) break;
    // Only keep approved startups
    const filtered = batch.filter(s => approvedMap[s.startup_id]);
    scores = scores.concat(filtered);
    if (batch.length < fetchSize) break;
    page++;
  }
  scores = scores.slice(0, LIMIT);

  console.log(`Signal score rows to process: ${scores.length}`);

  // 4. Check which startups already have signal_events (avoid dupes)
  const startupIds = scores.map(s => s.startup_id);
  const alreadyHasEvents = new Set();
  // Query in chunks of 500 (Supabase .in() limit)
  for (let i = 0; i < startupIds.length; i += 500) {
    const chunk = startupIds.slice(i, i + 500);
    const { data: existingEvents } = await supabase
      .from('signal_events')
      .select('startup_id')
      .in('startup_id', chunk);
    (existingEvents || []).forEach(e => alreadyHasEvents.add(e.startup_id));
  }
  console.log(`Already have events: ${alreadyHasEvents.size}`);

  const toProcess = scores.filter(s => !alreadyHasEvents.has(s.startup_id));
  console.log(`New startups to backfill: ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log('✅ All eligible startups already have signal events!');
    return;
  }

  // 4. Build signal_events batch
  const SIGNAL_DIMENSIONS = [
    { column: 'execution_velocity',  event_type: 'execution_velocity',  threshold: 0.5 },
    { column: 'news_momentum',        event_type: 'news_momentum',        threshold: 0.5 },
    { column: 'capital_convergence',  event_type: 'capital_convergence',  threshold: 0.5 },
    { column: 'investor_receptivity', event_type: 'investor_receptivity', threshold: 0.6 },
    { column: 'founder_language_shift', event_type: 'founder_language_shift', threshold: 0.5 },
  ];

  const eventBatch = [];
  let processedCount = 0;

  for (const row of toProcess) {
    const startupInfo = approvedMap[row.startup_id] || {};
    const godScore = startupInfo.total_god_score || 50;
    const normalized = Math.max(0, Math.min(1, (godScore - 40) / 60));
    const baseConfidence = Math.min(0.45 + normalized * 0.40, 0.90);
    const asOf = row.as_of ? new Date(row.as_of) : new Date();

    for (const dim of SIGNAL_DIMENSIONS) {
      const magnitude = row[dim.column] || 0;
      if (magnitude >= dim.threshold) {
        eventBatch.push({
          startup_id: row.startup_id,
          event_type: dim.event_type,
          source_type: 'enrichment',
          source_url: startupInfo.website || null,
          observed_at: asOf.toISOString(),
          occurred_at: asOf.toISOString(),
          confidence: parseFloat(baseConfidence.toFixed(2)),
          magnitude: parseFloat(magnitude.toFixed(2)),
          payload: {
            trigger: 'backfill_from_signal_scores',
            signals_total: row.signals_total,
            god_score: godScore,
            backfill_batch: true
          }
        });
      }
    }
    processedCount++;
  }

  console.log(`Events to create: ${eventBatch.length} (from ${processedCount} startups)`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] First 3 events:');
    eventBatch.slice(0, 3).forEach((e, i) => {
      console.log(`  [${i+1}] ${e.event_type} | startup: ${e.startup_id.slice(0,8)}... | confidence: ${e.confidence} | magnitude: ${e.magnitude}`);
    });
    console.log('\n✅ Dry run complete. Run without --dry-run to apply.');
    return;
  }

  // 5. Insert in batches of 200
  const BATCH_SIZE = 200;
  let inserted = 0;
  for (let i = 0; i < eventBatch.length; i += BATCH_SIZE) {
    const batch = eventBatch.slice(i, i + BATCH_SIZE);
    const { error: insertErr } = await supabase
      .from('signal_events')
      .insert(batch);
    
    if (insertErr) {
      console.error(`❌ Batch ${Math.floor(i/BATCH_SIZE)+1} failed: ${insertErr.message}`);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Inserted: ${inserted}/${eventBatch.length}`);
    }
  }

  console.log(`\n\n✅ Backfill complete: ${inserted} signal events created`);

  // 6. Final count
  const { count: finalCount } = await supabase
    .from('signal_events')
    .select('*', { count: 'exact', head: true });
  console.log(`Total signal_events in DB: ${finalCount}`);
}

backfill().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
