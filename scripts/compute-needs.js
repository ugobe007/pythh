#!/usr/bin/env node
/**
 * COMPUTE ENTITY NEEDS
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads pythh_trajectories (90-day window, most recent per entity), reads the
 * entity's signal events for the same window, runs inferNeeds(), and writes
 * canonical need objects to pythh_entity_needs.
 *
 * Run AFTER compute-trajectories.js.
 *
 * Usage:
 *   node scripts/compute-needs.js              # dry-run
 *   node scripts/compute-needs.js --apply
 *   node scripts/compute-needs.js --apply --limit 200
 *   node scripts/compute-needs.js --apply --min-confidence 0.40
 */

'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { inferNeeds, describeNeeds } = require('../lib/needsInference');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) { console.error(`❌ Missing ${k}`); process.exit(1); }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function argVal(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const DRY_RUN  = !process.argv.includes('--apply');
const LIMIT    = +(argVal('--limit',          '500'));
const BATCH_SZ = +(argVal('--batch',          '25'));
const MIN_CONF = +(argVal('--min-confidence', '0.38'));

async function main() {
  console.log('\n🎯 ENTITY NEEDS COMPUTATION');
  console.log('═'.repeat(60));
  console.log(`Mode:     ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Limit:    ${LIMIT} entities`);
  console.log(`Min conf: ${MIN_CONF}`);
  console.log('═'.repeat(60) + '\n');

  // ── Get the most recent 90-day trajectory per entity ─────────────────────
  const { data: trajectories, error: trajErr } = await supabase
    .from('pythh_trajectories')
    .select('*')
    .eq('time_window_days', 90)
    .order('computed_at', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (trajErr) { console.error('❌ Trajectory fetch failed:', trajErr.message); process.exit(1); }
  console.log(`📊 Trajectories to process: ${trajectories?.length ?? 0}\n`);
  if (!trajectories?.length) {
    console.log('No trajectories found. Run compute-trajectories.js --apply first.');
    return;
  }

  const stats = {
    entities: 0, needs_written: 0,
    skipped_no_signals: 0, errors: 0,
    by_need: {}, by_urgency: { high: 0, medium: 0, low: 0 },
  };

  const validUntil = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]; // 30 days
  const validFrom  = new Date().toISOString().split('T')[0];

  for (let i = 0; i < trajectories.length; i += BATCH_SZ) {
    const batch = trajectories.slice(i, i + BATCH_SZ);

    for (const traj of batch) {
      stats.entities++;
      const entityId = traj.entity_id;

      // Fetch signal events for this entity (90-day window)
      const since90 = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: events } = await supabase
        .from('pythh_signal_events')
        .select('detected_at, primary_signal, signal_type, signal_strength, confidence, evidence_quality, is_costly_action, signal_object')
        .eq('entity_id', entityId)
        .gte('detected_at', since90)
        .order('detected_at', { ascending: true });

      if (!events?.length) { stats.skipped_no_signals++; continue; }

      // Reconstruct signal history
      const signalHistory = events.map(ev => ({
        date:   ev.detected_at,
        signal: {
          primary_signal:  ev.primary_signal,
          signal_type:     ev.signal_type,
          signal_strength: ev.signal_strength,
          confidence:      ev.confidence,
          evidence_quality: ev.evidence_quality,
          costly_action:   ev.is_costly_action,
          ...(ev.signal_object || {}),
        },
      }));

      // Reconstruct trajectory report shape expected by inferNeeds
      const trajectoryReport = {
        dominant_trajectory:   traj.dominant_trajectory,
        trajectory_confidence: traj.trajectory_confidence,
        velocity_score:        traj.velocity_score,
        acceleration:          traj.acceleration,
        current_stage:         traj.current_stage,
        supporting_signals:    traj.supporting_signals || [],
        dominant_signal:       traj.dominant_signal,
        matched_patterns:      (traj.matched_patterns || []).map(m => ({
          pattern: { id: m.pattern_id, type: traj.dominant_trajectory },
          match_score: m.match_score,
        })),
      };

      try {
        const needs = inferNeeds(signalHistory, trajectoryReport, {
          window_days:    90,
          min_confidence: MIN_CONF,
        });

        if (DRY_RUN) {
          const { data: ent } = await supabase
            .from('pythh_entities')
            .select('name')
            .eq('id', entityId)
            .maybeSingle();
          const topNeeds = needs.slice(0, 3).map(n => `${n.label} [${n.urgency}]`).join(' | ');
          console.log(`  ${(ent?.name || entityId).padEnd(30)} → ${topNeeds || 'no needs'}`);
          stats.needs_written += needs.length;
          needs.forEach(n => {
            stats.by_need[n.need_class]  = (stats.by_need[n.need_class] || 0) + 1;
            stats.by_urgency[n.urgency]  = (stats.by_urgency[n.urgency] || 0) + 1;
          });
          continue;
        }

        // Delete stale needs for this entity, then insert fresh
        await supabase.from('pythh_entity_needs')
          .delete()
          .eq('entity_id', entityId)
          .lt('valid_until', validFrom);

        for (const need of needs) {
          const needRow = {
            entity_id:        entityId,
            trajectory_id:    traj.id,
            need_class:       need.need_class,
            label:            need.label,
            category:         need.category,
            description:      need.description,
            confidence:       need.confidence,
            urgency:          need.urgency,
            who_provides:     need.who_provides    || [],
            signal_sources:   need.signal_sources  || [],
            trajectory_boost: need.trajectory_boost || false,
            evidence_count:   need.evidence_count  || 1,
            valid_from:       validFrom,
            valid_until:      validUntil,
          };

          // Upsert: (entity_id, need_class, valid_from) is unique
          const { error: upsErr } = await supabase
            .from('pythh_entity_needs')
            .upsert(needRow, { onConflict: 'entity_id,need_class,valid_from' });

          if (upsErr) { stats.errors++; }
          else {
            stats.needs_written++;
            stats.by_need[need.need_class]  = (stats.by_need[need.need_class] || 0) + 1;
            stats.by_urgency[need.urgency]  = (stats.by_urgency[need.urgency] || 0) + 1;
          }
        }

      } catch (e) {
        stats.errors++;
      }
    }

    const pct = Math.round(((i + batch.length) / trajectories.length) * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${trajectories.length} entities (${pct}%)  `);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Entities processed:   ${stats.entities}`);
  console.log(`Skipped (no signals): ${stats.skipped_no_signals}`);
  console.log(`Needs written:        ${DRY_RUN ? '(dry-run)' : stats.needs_written}`);
  console.log(`Errors:               ${stats.errors}`);
  console.log(`\nUrgency split:`);
  console.log(`  High:   ${stats.by_urgency.high}`);
  console.log(`  Medium: ${stats.by_urgency.medium}`);
  console.log(`  Low:    ${stats.by_urgency.low}`);

  if (Object.keys(stats.by_need).length > 0) {
    console.log('\nTop inferred need classes:');
    Object.entries(stats.by_need)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
  }

  if (DRY_RUN) {
    console.log('\n💡 Run with --apply to write needs to the database.');
  } else {
    console.log('\n✅ Needs computed. pythh_entity_needs is now populated.');
    console.log('   Next: build candidate profiles in pythh_candidates and run match scoring.');
  }
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
