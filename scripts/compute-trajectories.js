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

// ── Signal decay half-lives (days until 50% signal strength) ─────────────────
// Ported from server/services/signalDetector.js SIGNAL_HALF_LIVES.
// Formula: decayed_strength = strength × 0.5^(age_days / half_life)
const SIGNAL_HALF_LIVES = {
  fundraising_signal:       45,   // round dynamics — stale fast, market moves
  investor_interest_signal: 30,   // hype/FOMO — very short shelf life
  investor_rejection_signal:30,
  growth_signal:            90,   // growth metrics — durable
  revenue_signal:           90,
  product_signal:           60,   // product launches — relevant for a cycle
  market_signal:            60,
  hiring_signal:            45,   // headcount signals — refresh quarterly
  distress_signal:          60,   // distress — resolves or worsens within 2 months
  acquisition_signal:       90,   // M&A — long tail
  exit_signal:              90,
  expansion_signal:         90,
  partnership_signal:       90,
  enterprise_signal:        90,
  efficiency_signal:        90,
  buyer_signal:             45,
  buyer_pain_signal:        45,
  exploratory_signal:       60,
  market_position_signal:   60,
  // Long-lived signals that never meaningfully decay
  patent_signal:            999,
  grant_signal:             730,
  university_signal:        999,
};
const DEFAULT_HALF_LIFE = 120;

function applyDecay(strength, primarySignal, detectedAt) {
  if (!detectedAt || strength == null) return strength;
  const ageDays = Math.max(0, (Date.now() - new Date(detectedAt).getTime()) / 86400000);
  const halfLife = SIGNAL_HALF_LIVES[primarySignal] || DEFAULT_HALF_LIFE;
  return strength * Math.pow(0.5, ageDays / halfLife);
}

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

  // ── Paginated fetch of all entities ──────────────────────────────────────
  console.log('📥 Loading entities (paginated)…');
  const PAGE_FETCH = 500;
  let entities = [];
  let offset = 0;
  while (entities.length < LIMIT) {
    const { data: page, error: entErr } = await supabase
      .from('pythh_entities')
      .select('id, name, sectors, stage, website')
      .eq('is_active', true)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_FETCH - 1);
    if (entErr) { console.error('❌ Entity fetch failed:', entErr.message); process.exit(1); }
    if (!page || page.length === 0) break;
    entities.push(...page);
    process.stdout.write(`\r   Loaded: ${entities.length}…`);
    if (page.length < PAGE_FETCH) break;
    offset += PAGE_FETCH;
  }
  entities = entities.slice(0, LIMIT);
  console.log(`\r   Loaded: ${entities.length} entities.\n`);

  if (!entities?.length) {
    console.log('No entities found. Run ingest-pythh-signals.js --apply first.');
    return;
  }
  console.log(`📊 Entities to process: ${entities.length}\n`);

  const stats = {
    entities: 0, trajectories_written: 0,
    skipped_no_signals: 0, errors: 0,
    by_trajectory: {},
  };

  // ── Pre-load ALL signal events into memory (much faster than per-entity queries)
  console.log('⚡ Loading all signal events into memory…');
  const allSignals = [];
  const SIG_PAGE = 1000;
  let sigOffset = 0;
  while (true) {
    const { data: sigPage, error: sigErr } = await supabase
      .from('pythh_signal_events')
      .select('entity_id, detected_at, primary_signal, signal_type, signal_strength, confidence, evidence_quality, is_costly_action, signal_object')
      .order('detected_at', { ascending: true })
      .range(sigOffset, sigOffset + SIG_PAGE - 1);
    if (sigErr) { console.error('Signal fetch error:', sigErr.message); break; }
    if (!sigPage || sigPage.length === 0) break;
    allSignals.push(...sigPage);
    process.stdout.write(`\r   Signal events loaded: ${allSignals.length}…`);
    if (sigPage.length < SIG_PAGE) break;
    sigOffset += SIG_PAGE;
  }
  console.log(`\r   Signal events loaded: ${allSignals.length} total.\n`);

  // Group signals by entity_id
  const signalsByEntity = {};
  for (const ev of allSignals) {
    if (!signalsByEntity[ev.entity_id]) signalsByEntity[ev.entity_id] = [];
    signalsByEntity[ev.entity_id].push(ev);
  }
  const entitiesWithSignals = entities.filter(e => signalsByEntity[e.id]?.length > 0);
  console.log(`   Entities with signals: ${entitiesWithSignals.length} / ${entities.length}\n`);

  // Accumulate trajectory rows and entity updates for batch flushing
  const trajBuffer   = [];
  const entityBuffer = []; // { id, total_signals, signal_velocity, last_signal_date }
  const FLUSH_SIZE   = 100;

  async function flushBuffers(force = false) {
    if (!DRY_RUN && (force || trajBuffer.length >= FLUSH_SIZE)) {
      if (trajBuffer.length) {
        const { error: upsErr } = await supabase
          .from('pythh_trajectories')
          .upsert(trajBuffer.splice(0, trajBuffer.length), { onConflict: 'entity_id,time_window_days,window_end' });
        if (upsErr) { stats.errors++; }
      }
    }
    if (!DRY_RUN && (force || entityBuffer.length >= 50)) {
      // Batch entity updates: do them as individual updates since there's no upsert
      // key other than id — do in parallel groups of 20
      const slice = entityBuffer.splice(0, entityBuffer.length);
      const PARA = 20;
      for (let p = 0; p < slice.length; p += PARA) {
        await Promise.all(slice.slice(p, p + PARA).map(eu =>
          supabase.from('pythh_entities').update({
            total_signals:    eu.total_signals,
            signal_velocity:  eu.signal_velocity,
            last_signal_date: eu.last_signal_date,
          }).eq('id', eu.id)
        ));
      }
    }
  }

  for (let i = 0; i < entitiesWithSignals.length; i += BATCH_SZ) {
    const batch = entitiesWithSignals.slice(i, i + BATCH_SZ);

    for (const entity of batch) {
      stats.entities++;

      const events = signalsByEntity[entity.id] || [];
      if (!events.length) {
        stats.skipped_no_signals++;
        continue;
      }

      // Build signal history array — apply time decay so old signals contribute less.
      // A fundraising signal from 6 months ago (3× its 45-day half-life) carries
      // only 12.5% of its original strength. Recent signals dominate.
      const signalHistory = events.map(ev => {
        const rawStrength = ev.signal_strength ?? 0.5;
        const decayedStrength = applyDecay(rawStrength, ev.primary_signal, ev.detected_at);
        return {
          date:   ev.detected_at,
          signal: {
            primary_signal:   ev.primary_signal,
            signal_type:      ev.signal_type,
            signal_strength:  decayedStrength,
            raw_strength:     rawStrength,
            decay_factor:     rawStrength > 0 ? +(decayedStrength / rawStrength).toFixed(3) : 1,
            confidence:       ev.confidence,
            evidence_quality: ev.evidence_quality,
            costly_action:    ev.is_costly_action,
            ...(ev.signal_object || {}),
          },
        };
      });

      // Compute trajectories at each time window
      let report90 = null;
      for (const windowDays of SINGLE_WIN) {
        try {
          const report = buildTrajectory(signalHistory, {
            entity_id:   entity.id,
            window_days: windowDays,
          });
          if (windowDays === 90) report90 = report;

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

          // Buffer instead of individual upsert
          trajBuffer.push(trajRow);
          stats.trajectories_written++;
          const dt = report.dominant_trajectory || 'unknown';
          stats.by_trajectory[dt] = (stats.by_trajectory[dt] || 0) + 1;

        } catch (e) {
          stats.errors++;
        }
      }

      // Buffer entity stats update using 90-day report
      if (report90 && !DRY_RUN) {
        entityBuffer.push({
          id:               entity.id,
          total_signals:    report90.total_signals,
          signal_velocity:  report90.velocity_score,
          last_signal_date: report90.last_signal_date
                              ? new Date(report90.last_signal_date).toISOString().split('T')[0]
                              : null,
        });
      }
    }

    await flushBuffers();
    const pct = Math.round(((i + batch.length) / entitiesWithSignals.length) * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${entitiesWithSignals.length} entities (${pct}%)  `);
  }
  await flushBuffers(true); // flush remainder

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
