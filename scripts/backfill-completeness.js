#!/usr/bin/env node
/**
 * BACKFILL DATA COMPLETENESS
 * 
 * Calculates and stores data_completeness for all approved startups.
 * Previously 0 for all 1,000 records - this fixes that.
 * 
 * Run: node scripts/backfill-completeness.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateCompleteness } = require('../server/services/dataCompletenessService');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const BATCH_SIZE = 50;

async function backfillCompleteness() {
  console.log('=== DATA COMPLETENESS BACKFILL ===\n');

  // Fetch all approved startups with fields needed for completeness calculation
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, description, pitch, customer_count, mrr, arr, team_size, growth_rate_monthly, extracted_data')
    .eq('status', 'approved');

  if (error) {
    console.error('Failed to load startups:', error.message);
    process.exit(1);
  }

  console.log(`Loaded ${startups.length} approved startups\n`);

  const tiers = { excellent: 0, good: 0, fair: 0, sparse: 0 };
  const updates = startups.map(s => {
    // Flatten extracted_data into the startup object so completeness service
    // can find fields like problem, solution, team, founders etc.
    const flattened = { ...s, ...(s.extracted_data || {}) };
    const { percentage, tier } = calculateCompleteness(flattened);
    tiers[tier]++;
    return { id: s.id, data_completeness: percentage };
  });

  // Compute stats before writing
  const pcts = updates.map(u => u.data_completeness);
  const avg = (pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1);
  const min = Math.min(...pcts);
  const max = Math.max(...pcts);
  const low = pcts.filter(p => p < 40).length;

  console.log(`Completeness stats: avg=${avg}% | min=${min}% | max=${max}%`);
  console.log(`Tiers: excellent(80+)=${tiers.excellent} | good(60-79)=${tiers.good} | fair(40-59)=${tiers.fair} | sparse(<40)=${tiers.sparse}`);
  console.log(`Low Data (<40%) badges will show for: ${low} startups\n`);

  // Batch-update the database
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\rUpdating... ${i}/${updates.length}`);

    // Upsert in parallel within batch
    const results = await Promise.allSettled(
      batch.map(({ id, data_completeness }) =>
        supabase
          .from('startup_uploads')
          .update({ data_completeness })
          .eq('id', id)
      )
    );

    results.forEach(r => {
      if (r.status === 'fulfilled' && !r.value.error) updated++;
      else failed++;
    });
  }

  console.log(`\n\nDone! Updated: ${updated} | Failed: ${failed}`);

  // Spot-check a few
  console.log('\nSpot-check (10 random):');
  const sample = startups.slice(0, 10);
  sample.forEach(s => {
    const flattened = { ...s, ...(s.extracted_data || {}) };
    const { percentage, tier } = calculateCompleteness(flattened);
    console.log(`  [${percentage}% ${tier}] ${(s.name || '?').padEnd(28)}`);
  });

  if (low > 0) {
    console.log(`\n${low} startups qualify for "Low Data" badge - founders can claim via /enrich/:token`);
  }
}

backfillCompleteness().catch(console.error);
