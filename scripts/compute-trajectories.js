#!/usr/bin/env node
/**
 * COMPUTE TRAJECTORIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads pythh_signal_events grouped by entity_id, builds signal history arrays,
 * runs buildTrajectory() at four time windows (30/90/180/365 days), and writes
 * the results to pythh_trajectories.
 *
 * Run AFTER ingest-pythh-signals.js.
 *
 * Usage:
 *   node scripts/compute-trajectories.js              # dry-run
 *   node scripts/compute-trajectories.js --apply
 *   node scripts/compute-trajectories.js --apply --limit 200   # max entities
 *   node scripts/compute-trajectories.js --apply --window 90   # single window
 */

'use strict';
require('dotenv').config();

const { createClient }  = require('@supabase/supabase-js');
const { buildTrajectory } = require('../lib/trajectoryEngine');

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
const DRY_RUN     = !process.argv.includes('--apply');
const LIMIT       = +(argVal('--limit',  '500'));
const BATCH_SZ    = +(argVal('--batch',  '25'));
const SINGLE_WIN  = argVal('--window') ? [+argVal('--window')] : [30, 90, 180, 365];

async function main() {
  console.log('\n📈 TRAJECTORY COMPUTATION');
  console.log('═'.repeat(60));
  console.log(`Mode:     ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Windows:  ${SINGLE_WIN.join(', ')} days`);
  console.log(`Limit:    ${LIMIT} entities`);
  console.log('═'.repeat(60) + '\n');

  // ── Get all distinct entity IDs that have signal events ──────────────────
  const { data: entities, error: entErr } = await supabase
    .from('pythh_entities')
    .select('id, name, sectors, stage, website')
    .eq('is_active', true)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (entErr) { console.error('❌ Entity fetch failed:', entErr.message); process.exit(1); }
  console.log(`📊 Entities to process: ${entities?.length ?? 0}\n`);
  if (!entities?.length) {
    console.log('No entities found. Run ingest-pythh-signals.js --apply first.');
    return;
  }

  const stats = {
    entities: 0, trajectories_written: 0,
    skipped_no_signals: 0, errors: 0,
    by_trajectory: {},
  };

  for (let i = 0; i < entities.length; i += BATCH_SZ) {
    const batch = entities.slice(i, i + BATCH_SZ);

    for (const entity of batch) {
      stats.entities++;

      // Fetch all signal events for this entity
      const { data: events, error: evErr } = await supabase
        .from('pythh_signal_events')
        .select('detected_at, primary_signal, signal_type, signal_strength, confidence, evidence_quality, is_costly_action, signal_object')
        .eq('entity_id', entity.id)
        .order('detected_at', { ascending: true });

      if (evErr || !events?.length) {
        stats.skipped_no_signals++;
        continue;
      }

      // Build signal history array in the format buildTrajectory expects
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

      // Compute trajectories at each time window
      for (const windowDays of SINGLE_WIN) {
        try {
          const report = buildTrajectory(signalHistory, {
            entity_id:   entity.id,
            window_days: windowDays,
          });

          if (DRY_RUN) {
            if (windowDays === 90) {
              console.log(`  ${entity.name?.padEnd(30)} | ${report.dominant_trajectory?.padEnd(24)} | vel=${report.velocity_score} | conf=${report.trajectory_confidence}`);
            }
            stats.trajectories_written++;
            continue;
          }

          const now       = new Date().toISOString().split('T')[0];
          const windowEnd = now;
          const windowStart = new Date(Date.now() - windowDays * 86400000).toISOString().split('T')[0];

          const trajRow = {
            entity_id:                entity.id,
            time_window_days:         windowDays,
            window_start:             windowStart,
            window_end:               windowEnd,
            computed_at:              new Date().toISOString(),
            dominant_trajectory:      report.dominant_trajectory,
            trajectory_label:         report.trajectory_label,
            trajectory_type:          report.dominant_trajectory,
            trajectory_confidence:    report.trajectory_confidence,
            velocity_score:           report.velocity_score,
            momentum:                 report.momentum,
            acceleration:             report.acceleration,
            consistency_score:        report.consistency_score,
            current_stage:            report.current_stage,
            stage_from:               report.stage_transition?.from || null,
            stage_to:                 report.stage_transition?.to   || null,
            stage_transition_detected: report.stage_transition?.transition_detected || false,
            dominant_signal:          report.dominant_signal,
            supporting_signals:       report.supporting_signals   || [],
            contradictory_signals:    report.contradictory_signals || [],
            signal_class_counts:      report.signal_class_counts  || {},
            predicted_next_moves:     report.predicted_next_moves || [],
            prediction:               report.prediction,
            who_cares:                report.who_cares            || {},
            anomalies:                report.anomalies            || [],
            matched_patterns:         (report.matched_patterns || []).map(m => ({
              pattern_id:   m.pattern?.id,
              match_score:  m.match_score,
              matched_dates: m.matched_dates,
            })),
            primary_pattern_id:       report.primary_pattern?.pattern?.id || null,
            rolling_windows:          report.rolling_windows || {},
            total_signals:            report.total_signals,
            first_signal_date:        report.first_signal_date
                                        ? new Date(report.first_signal_date).toISOString().split('T')[0]
                                        : null,
            last_signal_date:         report.last_signal_date
                                        ? new Date(report.last_signal_date).toISOString().split('T')[0]
                                        : null,
          };

          // Upsert (entity_id, time_window_days, window_end) is unique
          const { error: upsErr } = await supabase
            .from('pythh_trajectories')
            .upsert(trajRow, { onConflict: 'entity_id,time_window_days,window_end' });

          if (upsErr) { stats.errors++; }
          else {
            stats.trajectories_written++;
            const dt = report.dominant_trajectory || 'unknown';
            stats.by_trajectory[dt] = (stats.by_trajectory[dt] || 0) + 1;
          }

          // Update total_signals on entity
          await supabase.from('pythh_entities')
            .update({
              total_signals:    report.total_signals,
              signal_velocity:  report.velocity_score,
              last_signal_date: report.last_signal_date
                                  ? new Date(report.last_signal_date).toISOString().split('T')[0]
                                  : null,
            })
            .eq('id', entity.id);

        } catch (e) {
          stats.errors++;
        }
      }
    }

    const pct = Math.round(((i + batch.length) / entities.length) * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${entities.length} entities (${pct}%)  `);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Entities processed:       ${stats.entities}`);
  console.log(`Skipped (no signals):     ${stats.skipped_no_signals}`);
  console.log(`Trajectories written:     ${DRY_RUN ? '(dry-run)' : stats.trajectories_written}`);
  console.log(`Errors:                   ${stats.errors}`);

  if (Object.keys(stats.by_trajectory).length > 0) {
    console.log('\nTrajectory distribution (90d):');
    Object.entries(stats.by_trajectory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
  }

  if (DRY_RUN) {
    console.log('\n💡 Run with --apply to write trajectories to the database.');
  } else {
    console.log('\n✅ Trajectories computed. Run compute-needs.js next.');
  }
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
