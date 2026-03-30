#!/usr/bin/env node
/**
 * COMPUTE PYTHH MATCHES
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads pythh_entities + pythh_trajectories + pythh_entity_needs + pythh_candidates
 * → Runs match engine for each entity
 * → Writes ranked matches to pythh_matches
 *
 * Usage:
 *   node scripts/compute-matches.js              # dry-run
 *   node scripts/compute-matches.js --apply
 *   node scripts/compute-matches.js --apply --limit 100
 *   node scripts/compute-matches.js --apply --entity-id <uuid>
 *   node scripts/compute-matches.js --apply --top 10  # top N matches per entity
 */
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { rankMatches } = require('../lib/matchEngine');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) { console.error(`❌ Missing ${k}`); process.exit(1); }
}
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function argVal(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const DRY_RUN    = !process.argv.includes('--apply');
const LIMIT      = +(argVal('--limit', '200'));
const TOP_N      = +(argVal('--top', '20'));
const ENTITY_ID  = argVal('--entity-id', null);
const BATCH_SZ   = 50;

async function main() {
  console.log('\n🎯 COMPUTE PYTHH MATCHES');
  console.log('═'.repeat(60));
  console.log(`Mode:    ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Limit:   ${ENTITY_ID ? '1 entity (by ID)' : `${LIMIT} entities`}`);
  console.log(`Top N:   ${TOP_N} matches per entity`);
  console.log('═'.repeat(60) + '\n');

  const stats = { entities: 0, matches_written: 0, skipped: 0, errors: 0 };

  // ── 1. Load candidates ──────────────────────────────────────────────────────
  console.log('📦 Loading candidates pool…');
  const { data: rawCandidates, error: candErr } = await supabase
    .from('pythh_candidates')
    .select('*')
    .eq('is_active', true);
  // matchEngine expects candidate.candidate_id (not .id)
  const candidates = (rawCandidates || []).map(c => ({ ...c, candidate_id: c.id }));

  if (candErr) { console.error('❌ Candidate fetch failed:', candErr.message); process.exit(1); }
  if (!rawCandidates?.length) {
    console.error('❌ No candidates found. Run seed-pythh-candidates.js --apply first.');
    process.exit(1);
  }
  console.log(`   Loaded ${candidates.length} candidates.\n`);

  // ── 2. Load entities ────────────────────────────────────────────────────────
  console.log('🏢 Loading entities…');
  let entityQuery = supabase
    .from('pythh_entities')
    .select('id, name, entity_type, sectors, stage, geographies, total_signals, signal_velocity')
    .eq('is_active', true)
    .gt('total_signals', 0);

  if (ENTITY_ID) entityQuery = entityQuery.eq('id', ENTITY_ID);
  else entityQuery = entityQuery.order('signal_velocity', { ascending: false }).limit(LIMIT);

  const { data: entities, error: entErr } = await entityQuery;
  if (entErr) { console.error('❌ Entity fetch failed:', entErr.message); process.exit(1); }
  console.log(`   Loaded ${entities?.length ?? 0} entities.\n`);

  // ── 3. Load trajectories (most recent 90-day window per entity) ─────────────
  console.log('📈 Loading trajectories…');
  const entityIds = (entities || []).map(e => e.id);
  const { data: trajs, error: trajErr } = await supabase
    .from('pythh_trajectories')
    .select('*')
    .in('entity_id', entityIds)
    .eq('time_window_days', 90)
    .order('computed_at', { ascending: false });

  if (trajErr) { console.error('⚠️  Trajectory fetch warn:', trajErr.message); }

  const trajByEntity = {};
  for (const t of (trajs || [])) {
    if (!trajByEntity[t.entity_id]) trajByEntity[t.entity_id] = t;
  }
  console.log(`   Loaded ${Object.keys(trajByEntity).length} trajectory snapshots.\n`);

  // ── 4. Load needs ───────────────────────────────────────────────────────────
  console.log('🧠 Loading inferred needs…');
  const { data: needsRows, error: needsErr } = await supabase
    .from('pythh_entity_needs')
    .select('*')
    .in('entity_id', entityIds)
    .gt('confidence', 0.3);

  if (needsErr) { console.error('⚠️  Needs fetch warn:', needsErr.message); }

  const needsByEntity = {};
  for (const n of (needsRows || [])) {
    if (!needsByEntity[n.entity_id]) needsByEntity[n.entity_id] = [];
    needsByEntity[n.entity_id].push(n);
  }
  console.log(`   Loaded needs for ${Object.keys(needsByEntity).length} entities.\n`);

  // ── 5. Delete stale matches if applying ─────────────────────────────────────
  if (!DRY_RUN && entityIds.length) {
    console.log('🗑️  Clearing stale matches for these entities…');
    const { error: delErr } = await supabase
      .from('pythh_matches')
      .delete()
      .in('entity_id', entityIds);
    if (delErr) console.error('  Delete warn:', delErr.message);
    else console.log('  Cleared.\n');
  }

  // ── 6. Process each entity ──────────────────────────────────────────────────
  console.log('🔄 Computing matches…\n');

  const matchBuffer = [];

  for (const entity of (entities || [])) {
    const trajectory = trajByEntity[entity.id] || null;
    const needs      = needsByEntity[entity.id] || [];

    if (!trajectory && needs.length === 0) {
      stats.skipped++;
      continue;
    }

    // Build entity profile for matchEngine (uses entity_id, not id)
    const entityProfile = {
      entity_id:       entity.id,
      id:              entity.id,
      name:            entity.name,
      type:            entity.entity_type || 'startup',
      sectors:         entity.sectors || [],
      stage:           trajectory?.current_stage || entity.stage || 'unknown',
      geography:       (entity.geographies || [])[0] || 'global',
      trajectory_type: trajectory?.trajectory_type || 'unknown',
    };

    // Build trajectory report shape expected by matchEngine
    const trajectoryReport = trajectory ? {
      trajectory_type:      trajectory.trajectory_type,
      dominant_trajectory:  trajectory.dominant_trajectory || trajectory.trajectory_type,
      confidence:           trajectory.trajectory_confidence,
      velocity_score:       trajectory.velocity_score,
      consistency_score:    trajectory.consistency_score,
      detected_stage:       trajectory.current_stage,
      stage_transition:     trajectory.stage_transition_detected
                              ? { from: trajectory.stage_from, to: trajectory.stage_to }
                              : null,
      predicted_next_moves: trajectory.predicted_next_moves || [],
      anomalies:            trajectory.anomalies || [],
      dominant_signals:     trajectory.supporting_signals || [],
    } : null;

    let ranked;
    try {
      // rankMatches(entity, trajectory, needs, candidatePool, options)
      ranked = rankMatches(entityProfile, trajectoryReport, needs, candidates, { max_results: TOP_N, min_score: 0.25 });
    } catch (err) {
      console.error(`  ❌ Match error for ${entity.name}:`, err.message);
      stats.errors++;
      continue;
    }

    // Take top N
    const topMatches = ranked.slice(0, TOP_N);

    for (const m of topMatches) {
      matchBuffer.push({
        entity_id:          entity.id,
        candidate_id:       m.candidate_id,
        match_type:         m.match_type,
        match_score:        Math.min(1, Math.max(0, +(m.match_score || 0).toFixed(2))),
        timing_score:       Math.min(1, Math.max(0, +(m.timing_score || 0).toFixed(2))),
        confidence:         Math.min(1, Math.max(0, +(m.confidence || 0).toFixed(2))),
        predicted_need:     m.predicted_need || [],
        trajectory_used:    m.trajectory_used || trajectory?.trajectory_type || null,
        dominant_signal:    m.dominant_signal || null,
        supporting_signals: m.supporting_signals || [],
        explanation:        m.explanation || [],
        recommended_action: m.recommended_action || null,
        urgency:            m.urgency || 'low',
        dimension_scores:   m.dimension_scores || {},
        status:             'active',
      });
    }

    stats.entities++;
    process.stdout.write(`\r  Entities: ${stats.entities}  Matches queued: ${matchBuffer.length}  `);

    // Flush batch
    if (!DRY_RUN && matchBuffer.length >= BATCH_SZ) {
      const batch = matchBuffer.splice(0, BATCH_SZ);
      const { error: insErr } = await supabase.from('pythh_matches').insert(batch);
      if (insErr) { console.error('\n  Insert error:', insErr.message); stats.errors++; }
      else stats.matches_written += batch.length;
    }
  }

  // Flush remainder
  if (!DRY_RUN && matchBuffer.length > 0) {
    const { error: insErr } = await supabase.from('pythh_matches').insert(matchBuffer);
    if (insErr) { console.error('\n  Insert error:', insErr.message); stats.errors++; }
    else stats.matches_written += matchBuffer.length;
  }

  if (DRY_RUN) {
    stats.matches_written = matchBuffer.length;
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Entities processed: ${stats.entities}`);
  console.log(`Entities skipped:   ${stats.skipped} (no trajectory / needs)`);
  console.log(`Matches ${DRY_RUN ? 'would write' : 'written'}:  ${stats.matches_written}`);
  console.log(`Errors:             ${stats.errors}`);
  if (DRY_RUN) console.log('\n💡 Run with --apply to write to pythh_matches.');
  else console.log('\n✅ Matches computed. Query pythh_top_matches view to explore results.');
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
