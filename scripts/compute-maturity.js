#!/usr/bin/env node
/**
 * COMPUTE STARTUP MATURITY LEVELS
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads startup_uploads + pythh_trajectories + pythh_signal_events, runs
 * classifyMaturity() for each entity, and writes:
 *   maturity_level  — degree label (freshman → phd)
 *   maturity_score  — composite 0–100 score
 *   maturity_gaps   — array of gap strings explaining what would advance level
 *
 * Run AFTER compute-needs.js (trajectories + signals must exist).
 *
 * Usage:
 *   node scripts/compute-maturity.js              # dry-run
 *   node scripts/compute-maturity.js --apply
 *   node scripts/compute-maturity.js --apply --limit 500
 *   node scripts/compute-maturity.js --apply --force   # re-classify already-classified
 */
'use strict';
require('dotenv').config();

const { createClient }        = require('@supabase/supabase-js');
const { classifyMaturity }    = require('../lib/maturityClassifier');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) { console.error(`❌ Missing ${k}`); process.exit(1); }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function argVal(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const DRY_RUN = !process.argv.includes('--apply');
const FORCE   =  process.argv.includes('--force');
const LIMIT   = +(argVal('--limit', '500'));
const BATCH   = 50;

async function run() {
  console.log(`\n🎓 Maturity Classifier — ${DRY_RUN ? 'DRY-RUN' : 'APPLY'} | limit=${LIMIT} | force=${FORCE}\n`);

  // 1. Fetch startups to classify
  let query = supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, website, description, mrr, customer_count, latest_funding_amount')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(LIMIT);

  if (!FORCE) {
    query = query.is('maturity_level', null);
  }

  const { data: startups, error: sErr } = await query;
  if (sErr) { console.error('❌ Failed to fetch startups:', sErr.message); process.exit(1); }
  if (!startups?.length) { console.log('✅ No startups to classify.'); return; }
  console.log(`Found ${startups.length} startups to classify.`);

  // 2. Fetch trajectories for these startups in bulk
  const startupIds = startups.map(s => s.id);
  const { data: entities } = await supabase
    .from('pythh_entities')
    .select('id, startup_id')
    .in('startup_id', startupIds);

  const entityByStartup = {};
  for (const e of (entities || [])) entityByStartup[e.startup_id] = e.id;

  const entityIds = Object.values(entityByStartup);
  let trajByEntity = {};
  if (entityIds.length > 0) {
    const { data: trajs } = await supabase
      .from('pythh_trajectories')
      .select('entity_id, dominant_trajectory, trajectory_confidence, velocity_score, acceleration')
      .in('entity_id', entityIds)
      .eq('time_window_days', 90);
    for (const t of (trajs || [])) trajByEntity[t.entity_id] = t;
  }

  // 3. Fetch recent signal events for these entities
  let signalsByEntity = {};
  if (entityIds.length > 0) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signals } = await supabase
      .from('pythh_signal_events')
      .select('entity_id, primary_signal, confidence, signal_strength, detected_at')
      .in('entity_id', entityIds)
      .gte('detected_at', cutoff);
    for (const s of (signals || [])) {
      if (!signalsByEntity[s.entity_id]) signalsByEntity[s.entity_id] = [];
      signalsByEntity[s.entity_id].push({
        date: s.detected_at,
        signal: { primary_signal: s.primary_signal, confidence: s.confidence, signal_strength: s.signal_strength }
      });
    }
  }

  // 4. Classify + write in batches
  const stats = { freshman: 0, sophomore: 0, junior: 0, senior: 0, graduate: 0, phd: 0, errors: 0 };
  let updated = 0;

  for (let i = 0; i < startups.length; i += BATCH) {
    const batch = startups.slice(i, i + BATCH);
    const updates = [];

    for (const startup of batch) {
      try {
        const entityId  = entityByStartup[startup.id];
        const trajectory = entityId ? trajByEntity[entityId] : null;
        const history    = entityId ? (signalsByEntity[entityId] || []) : [];

        const result = classifyMaturity(startup, trajectory, history);
        stats[result.level] = (stats[result.level] || 0) + 1;

        updates.push({
          id:            startup.id,
          maturity_level: result.level,
          maturity_score: result.score,
          maturity_gaps:  result.gaps,
        });
      } catch (err) {
        stats.errors++;
        console.warn(`  ⚠️  ${startup.name}: ${err.message}`);
      }
    }

    if (!DRY_RUN && updates.length > 0) {
      const { error: uErr } = await supabase
        .from('startup_uploads')
        .upsert(updates, { onConflict: 'id' });
      if (uErr) console.error(`  ❌ Batch upsert error: ${uErr.message}`);
      else updated += updates.length;
    }

    const pct = Math.round(((i + batch.length) / startups.length) * 100);
    process.stdout.write(`\r  Progress: ${pct}% (${i + batch.length}/${startups.length})`);
  }

  console.log('\n\n📊 Results:');
  for (const [level, count] of Object.entries(stats)) {
    if (level !== 'errors') console.log(`  ${level.padEnd(10)} ${count}`);
  }
  if (stats.errors) console.log(`  errors     ${stats.errors}`);
  console.log(`\n  Written: ${DRY_RUN ? '0 (dry-run)' : updated}`);
  if (DRY_RUN) console.log('\n💡 Run with --apply to write maturity levels to the database.');
  // One-line summary for Fly / pipeline logs (last lines are echoed by server)
  console.log(
    `[maturity] summary rows_written=${DRY_RUN ? 0 : updated} processed=${startups.length} errors=${stats.errors || 0}`
  );
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
