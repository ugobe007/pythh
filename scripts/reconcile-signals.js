'use strict';
/**
 * scripts/reconcile-signals.js
 *
 * Signal Reconciliation Engine — runs after ALL ingestion steps (0–4b),
 * before intelligence recompute (steps 5–8).
 *
 * What it does:
 *   1. SOURCE RELIABILITY SCORING  — stamp source_reliability on every signal
 *      that is missing it, using a tiered hierarchy (SEC > API > press > RSS > LLM)
 *   2. DEDUPLICATION               — cluster signals by (entity, class, 7-day window)
 *      and merge duplicates into one canonical record with boosted confidence
 *   3. CONFLICT DETECTION          — flag entity-level contradictions
 *      (e.g., fundraising_signal + distress_signal within 30 days)
 *   4. ENSEMBLE CONFIDENCE BOOST   — when N sources agree on the same event,
 *      raise confidence using: 1 - (1 - base)^N, capped at 0.99
 *   5. ORPHAN CLEANUP              — remove signals for inactive or rejected entities
 *   6. TIMELINE SANITY             — cap detected_at to now() for any future-dated signals
 *
 * Usage:
 *   node scripts/reconcile-signals.js             # dry-run (analysis only)
 *   node scripts/reconcile-signals.js --apply     # write changes to DB
 *   node scripts/reconcile-signals.js --days 3    # look-back window (default 7)
 *   node scripts/reconcile-signals.js --limit 500 # entity limit (default all)
 */

require('dotenv').config();
const { createClient }  = require('@supabase/supabase-js');
const { fetchAll,
        deleteByIds,
        upsertInBatches } = require('../lib/supabaseUtils');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
                  || process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.VITE_SUPABASE_ANON_KEY;
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const args    = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const DAYS    = parseInt((args.find(a => a.startsWith('--days='))?.split('=')[1] || '7'), 10);
const LIMIT   = parseInt((args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0'), 10);

// ── Source reliability hierarchy ──────────────────────────────────────────
// Higher = more trustworthy. Used for canonical selection and confidence boost.
const SOURCE_RELIABILITY = {
  sec_filing:       1.00,   // confirmed, legal, time-stamped
  sec_edgar:        1.00,
  crunchbase:       0.97,   // curated, confirmed
  pitchbook:        0.97,
  linkedin:         0.88,   // first-party company data
  press_release:    0.90,   // announced (may be spin)
  clearbit:         0.85,   // enrichment data
  rss_article:      0.72,   // secondary coverage
  startup_news:     0.72,
  vc_deals:         0.75,
  founder_community:0.70,
  community:        0.65,
  social_signals:   0.62,   // signal count, not content
  llm_enrichment:   0.58,   // model-inferred
  description:      0.55,   // self-reported by founder
  unknown:          0.50,
};

// ── Signal conflict pairs (these are suspicious when co-occurring within N days) ─
const CONFLICT_PAIRS = [
  ['fundraising_signal',   'distress_signal'],
  ['growth_signal',        'distress_signal'],
  ['exit_signal',          'fundraising_signal'],
  ['acquisition_signal',   'fundraising_signal'],
  ['efficiency_signal',    'expansion_signal'],
  ['investor_rejection_signal', 'investor_interest_signal'],
];
const CONFLICT_WINDOW_DAYS = 30;

// ── Ensemble confidence formula ───────────────────────────────────────────
// When N independent sources report the same event, combined confidence rises.
// Formula: 1 - product(1 - conf_i)  (independent events)
// We cap at 0.99 to avoid false certainty.
function ensembleConfidence(confidences) {
  if (!confidences.length) return 0;
  const combined = 1 - confidences.reduce((acc, c) => acc * (1 - Math.min(c, 0.99)), 1);
  return Math.min(combined, 0.99);
}

// ── Get reliability for a source string ──────────────────────────────────
function getReliability(source, sourceType) {
  const key = (sourceType || source || '').toLowerCase().replace(/[^a-z_]/g, '_');
  return SOURCE_RELIABILITY[key]
      || SOURCE_RELIABILITY[source?.toLowerCase()?.replace(/[^a-z_]/g, '_')]
      || SOURCE_RELIABILITY.unknown;
}

// ── Is two dates within N days of each other? ────────────────────────────
function withinDays(a, b, days) {
  const diff = Math.abs(new Date(a) - new Date(b));
  return diff <= days * 86400000;
}


// ─── MAIN ─────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n🔄 SIGNAL RECONCILIATION ENGINE');
  console.log('═'.repeat(60));
  console.log(`Mode:     ${DRY_RUN ? '🔍 DRY-RUN (no writes)' : '✍️  APPLY'}`);
  console.log(`Lookback: ${DAYS} days`);
  console.log(`Entity limit: ${LIMIT || 'all'}`);
  console.log('═'.repeat(60) + '\n');

  const stats = {
    entities_scanned:      0,
    signals_scanned:       0,
    reliability_stamped:   0,
    duplicates_found:      0,
    duplicates_merged:     0,
    confidence_boosted:    0,
    conflicts_detected:    0,
    conflicts_flagged:     0,
    orphans_removed:       0,
    timeline_fixed:        0,
    errors:                0,
  };

  const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString();
  const now    = new Date().toISOString();

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1 — SOURCE RELIABILITY SCORING
  // Stamp source_reliability on any signal that is missing it.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Phase 1: Stamping source reliability...');
  {
    // No date filter: stamp ALL historically unstamped signals, not just recent ones.
    const { data: unstamped, error } = await fetchAll((from, to) =>
      supabase
        .from('pythh_signal_events')
        .select('id, source, source_type')
        .is('source_reliability', null)
        .range(from, to)
    );

    if (error) { console.log(`  ❌ ${error.message}`); stats.errors++; }
    else {
      stats.signals_scanned += (unstamped || []).length;

      // Group IDs by their resolved reliability value to batch into one UPDATE per group.
      // This reduces N individual round-trips to ~15 (one per unique reliability tier).
      const byReliability = {};
      for (const s of (unstamped || [])) {
        const rel = getReliability(s.source, s.source_type);
        (byReliability[rel] = byReliability[rel] || []).push(s.id);
      }

      if (!DRY_RUN && Object.keys(byReliability).length) {
        for (const [rel, ids] of Object.entries(byReliability)) {
          for (let i = 0; i < ids.length; i += 500) {
            await supabase.from('pythh_signal_events')
              .update({ source_reliability: parseFloat(rel) })
              .in('id', ids.slice(i, i + 500));
            stats.reliability_stamped += Math.min(500, ids.length - i);
          }
        }
      } else {
        stats.reliability_stamped = (unstamped || []).length;
        if (DRY_RUN && (unstamped || []).length)
          console.log(`  [DRY] Would stamp reliability on ${(unstamped || []).length} signals`);
      }
      console.log(`  ✓ ${stats.reliability_stamped} signals stamped`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2 — TIMELINE SANITY (future-dated signals)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nPhase 2: Timeline sanity check...');
  {
    const { data: future, error } = await supabase
      .from('pythh_signal_events')
      .select('id, detected_at')
      .gt('detected_at', now)
      .limit(500);

    if (error) { stats.errors++; }
    else if ((future || []).length) {
      stats.timeline_fixed = future.length;
      console.log(`  ⚠️  ${future.length} future-dated signals found`);
      if (!DRY_RUN) {
        for (const s of future) {
          await supabase.from('pythh_signal_events')
            .update({ detected_at: now })
            .eq('id', s.id);
        }
        console.log(`  ✓ Fixed ${future.length} timestamps`);
      } else {
        console.log(`  [DRY] Would fix ${future.length} timestamps`);
      }
    } else {
      console.log('  ✓ All timestamps valid');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 3 — ORPHAN CLEANUP (signals for inactive / rejected entities)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nPhase 3: Orphan signal cleanup...');
  {
    // Find signal_events whose entity_id no longer has an active entity.
    // No date filter here — orphans accumulate over all time and must all be scanned.
    // Paginated to cover all signals regardless of Supabase row limits.
    const { data: orphaned, error } = await fetchAll((from, to) =>
      supabase
        .from('pythh_signal_events')
        .select('id, entity_id')
        .range(from, to)
    );

    if (error) { stats.errors++; }
    else {
      const entityIds = [...new Set((orphaned || []).map(s => s.entity_id).filter(Boolean))];
      if (entityIds.length) {
        // Chunk entity_id lookups into small batches.
        // PostgREST encodes .in() filters in the URL: 100 UUIDs ≈ 3.6KB, well under
        // the typical 8KB limit. Larger batches silently return 0 rows.
        const activeSet = new Set();
        for (let ci = 0; ci < entityIds.length; ci += 100) {
          const { data: batch } = await supabase
            .from('pythh_entities')
            .select('id')
            .in('id', entityIds.slice(ci, ci + 100))
            .eq('is_active', true);
          (batch || []).forEach(e => activeSet.add(e.id));
        }
        const orphans = (orphaned || []).filter(s => s.entity_id && !activeSet.has(s.entity_id));

        if (orphans.length) {
          stats.orphans_removed = orphans.length;
          console.log(`  ⚠️  ${orphans.length} orphaned signals (entity inactive or missing)`);
          if (!DRY_RUN) {
            const orphanIds = orphans.map(s => s.id);
            for (let i = 0; i < orphanIds.length; i += 100) {
              await supabase.from('pythh_signal_events')
                .delete()
                .in('id', orphanIds.slice(i, i + 100));
            }
            console.log(`  ✓ Removed ${orphans.length} orphans`);
          } else {
            console.log(`  [DRY] Would remove ${orphans.length} orphan signals`);
          }
        } else {
          console.log('  ✓ No orphaned signals');
        }
      } else {
        console.log('  ✓ No signals to check');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 4 — DEDUPLICATION + ENSEMBLE CONFIDENCE BOOST
  // Group by (entity_id, primary_signal, 7-day bucket).
  // Within each cluster: pick canonical (highest reliability×confidence),
  // compute ensemble confidence, update canonical, soft-delete duplicates.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nPhase 4: Deduplication + ensemble confidence...');
  {
    // Load all signals in the lookback window — paginated to bypass max_rows cap.
    const { data: signals, error } = await fetchAll((from, to) =>
      supabase
        .from('pythh_signal_events')
        .select('id, entity_id, primary_signal, signal_strength, confidence, source, source_type, source_reliability, detected_at, is_ambiguous, evidence_quality')
        .gte('detected_at', cutoff)
        .order('detected_at', { ascending: false })
        .range(from, to)
    );
    if (error) { console.log(`  ❌ ${error.message}`); stats.errors++; }
    else {
      stats.signals_scanned += (signals || []).length;
      stats.entities_scanned = new Set((signals || []).map(s => s.entity_id)).size;

      // Group into clusters: key = entity_id + primary_signal + week bucket
      const clusters = {};
      for (const sig of (signals || [])) {
        if (!sig.entity_id || !sig.primary_signal) continue;
        const weekBucket = Math.floor(new Date(sig.detected_at).getTime() / (7 * 86400000));
        const key = `${sig.entity_id}::${sig.primary_signal}::${weekBucket}`;
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push(sig);
      }

      // Process clusters with >1 member
      const dupClusters = Object.values(clusters).filter(c => c.length > 1);
      stats.duplicates_found = dupClusters.reduce((sum, c) => sum + c.length - 1, 0);

      console.log(`  Signals scanned:  ${signals?.length || 0}`);
      console.log(`  Entities:         ${stats.entities_scanned}`);
      console.log(`  Duplicate groups: ${dupClusters.length} (${stats.duplicates_found} excess signals)`);

      // Batch buffers — flushed after the cluster loop to minimise round trips
      const canonicalUpdates = [];
      const dupIds = [];

      for (const cluster of dupClusters) {
        // Score each signal: reliability × confidence
        const scored = cluster.map(s => ({
          ...s,
          rel:   parseFloat(s.source_reliability) || getReliability(s.source, s.source_type),
          conf:  parseFloat(s.confidence) || 0.5,
          score: (parseFloat(s.source_reliability) || getReliability(s.source, s.source_type))
               * (parseFloat(s.confidence) || 0.5),
        })).sort((a, b) => b.score - a.score);

        const canonical   = scored[0];
        const duplicates  = scored.slice(1);
        const allConfs    = scored.map(s => s.conf);
        const boosted     = ensembleConfidence(allConfs);
        const wasAmbiguous = canonical.is_ambiguous;
        // If majority of sources are unambiguous, clear ambiguity flag
        const unambiguousCount = scored.filter(s => !s.is_ambiguous).length;

        if (DRY_RUN) {
          if (dupClusters.indexOf(cluster) < 5) { // Show first 5 only
            console.log(`\n  [DRY] Cluster: ${canonical.primary_signal} | entity ${canonical.entity_id?.slice(0,8)}`);
            console.log(`         Sources: ${scored.map(s => s.source || s.source_type || '?').join(', ')}`);
            console.log(`         Confidence: ${scored.map(s => s.conf.toFixed(2)).join(', ')} → ensemble ${boosted.toFixed(3)}`);
            console.log(`         Canonical: ${canonical.source} (${canonical.conf.toFixed(2)})`);
            console.log(`         Duplicates to soft-delete: ${duplicates.length}`);
          }
          stats.duplicates_merged += duplicates.length;
          if (boosted > canonical.conf + 0.02) stats.confidence_boosted++;
          continue;
        }

        // Apply: update canonical with boosted confidence + source_count
        const updates = {
          confidence:         +boosted.toFixed(3),
          source_reliability: Math.max(...scored.map(s => s.rel)),
          signal_object: {
            ...(canonical.signal_object || {}),
            reconciled:           true,
            source_count:         scored.length,
            contributing_sources: scored.map(s => ({ source: s.source, confidence: s.conf })),
          },
        };
        if (unambiguousCount > scored.length / 2) updates.is_ambiguous = false;

        // Queue canonical update (flushed in batches below)
        canonicalUpdates.push({ id: canonical.id, updates, boosted, prevConf: canonical.conf });

        // Queue duplicate IDs for batch soft-delete
        for (const dup of duplicates) {
          dupIds.push(dup.id);
          stats.duplicates_merged++;
        }
      }

      // Flush canonical updates in batches (each has unique signal_object so one-per-row)
      for (const cu of canonicalUpdates) {
        const { error: upErr } = await supabase.from('pythh_signal_events')
          .update(cu.updates)
          .eq('id', cu.id);
        if (!upErr) {
          if (cu.boosted > cu.prevConf + 0.02) stats.confidence_boosted++;
        } else {
          stats.errors++;
        }
      }

      // Batch soft-delete duplicates: group by 500 IDs per .in() call
      for (let i = 0; i < dupIds.length; i += 500) {
        await supabase.from('pythh_signal_events')
          .update({ is_multi_signal: true })
          .in('id', dupIds.slice(i, i + 500));
      }

      console.log(`  ✓ Merged:         ${stats.duplicates_merged} duplicate signals`);
      console.log(`  ✓ Conf boosted:   ${stats.confidence_boosted} canonicals`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 5 — CONFLICT DETECTION
  // For each entity, check if conflicting signal pairs co-exist within the
  // CONFLICT_WINDOW_DAYS window. Flag both with a conflict marker.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nPhase 5: Conflict detection...');
  {
    const conflictCutoff = new Date(Date.now() - CONFLICT_WINDOW_DAYS * 86400000).toISOString();

    // Load signals grouped by entity for conflict analysis — paginated.
    const { data: recentSignals, error } = await fetchAll((from, to) =>
      supabase
        .from('pythh_signal_events')
        .select('id, entity_id, primary_signal, detected_at, confidence, source')
        .gte('detected_at', conflictCutoff)
        .not('primary_signal', 'is', null)
        .range(from, to)
    );

    if (error) { stats.errors++; }
    else {
      // Group by entity
      const byEntity = {};
      for (const sig of (recentSignals || [])) {
        if (!sig.entity_id) continue;
        if (!byEntity[sig.entity_id]) byEntity[sig.entity_id] = [];
        byEntity[sig.entity_id].push(sig);
      }

      const conflictUpdates = [];

      for (const [entityId, entitySignals] of Object.entries(byEntity)) {
        for (const [classA, classB] of CONFLICT_PAIRS) {
          const sigsA = entitySignals.filter(s => s.primary_signal === classA);
          const sigsB = entitySignals.filter(s => s.primary_signal === classB);
          if (!sigsA.length || !sigsB.length) continue;

          // Check if any A and B are within the conflict window
          for (const sa of sigsA) {
            for (const sb of sigsB) {
              if (withinDays(sa.detected_at, sb.detected_at, CONFLICT_WINDOW_DAYS)) {
                stats.conflicts_detected++;
                conflictUpdates.push({ id: sa.id, pair: classB });
                conflictUpdates.push({ id: sb.id, pair: classA });
              }
            }
          }
        }
      }

      // Dedupe update list
      const seen = new Set();
      const uniqueUpdates = conflictUpdates.filter(u => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });
      stats.conflicts_flagged = uniqueUpdates.length;

      if (stats.conflicts_detected) {
        console.log(`  ⚠️  ${stats.conflicts_detected} signal conflicts detected across ${Object.keys(byEntity).length} entities`);
        CONFLICT_PAIRS.forEach(([a, b]) => {
          const count = conflictUpdates.filter(u => u.pair === b || u.pair === a).length / 2;
          if (count) console.log(`     ${a} ↔ ${b}: ~${Math.round(count)} entities`);
        });

        if (!DRY_RUN && uniqueUpdates.length) {
          for (const u of uniqueUpdates) {
            await supabase.from('pythh_signal_events')
              .update({
                signal_object: supabase.rpc ? undefined : {}, // update via jsonb merge not possible here
                is_ambiguous: true, // mark ambiguous when in conflict
              })
              .eq('id', u.id);
          }
          console.log(`  ✓ Flagged ${uniqueUpdates.length} signals as ambiguous (conflict)`);
        } else if (DRY_RUN) {
          console.log(`  [DRY] Would flag ${uniqueUpdates.length} signals as ambiguous`);
        }
      } else {
        console.log('  ✓ No signal conflicts detected');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 6 — ENTITY SIGNAL METADATA REFRESH
  // Update pythh_entities.total_signals, last_signal_date, signal_velocity
  // for all entities touched in this run.
  // Uses a single SELECT to get all stats, then batched UPSERTs.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nPhase 6: Refreshing entity signal metadata...');
  {
    // Paginated: get all distinct entity IDs across all time — no date filter.
    // Velocity and totals must reflect the full history, not just the lookback window.
    const { data: recent, error: rErr } = await fetchAll((from, to) =>
      supabase
        .from('pythh_signal_events')
        .select('entity_id')
        .range(from, to)
    );

    if (rErr) { stats.errors++; }
    else {
      const touchedIds = [...new Set((recent || []).map(s => s.entity_id).filter(Boolean))];
      if (!touchedIds.length) { console.log('  ✓ No entities to refresh'); }
      else {
        // Fetch signals for all touched entities in paginated chunks (100 IDs per .in() call).
        const allSigs = [];
        for (let i = 0; i < touchedIds.length; i += 100) {
          const chunk = touchedIds.slice(i, i + 100);
          const { data: page } = await fetchAll((from, to) =>
            supabase
              .from('pythh_signal_events')
              .select('entity_id, primary_signal, detected_at')
              .in('entity_id', chunk)
              .order('detected_at', { ascending: true })
              .range(from, to)
          );
          allSigs.push(...(page || []));
        }
        const aErr = null;

        if (aErr) { stats.errors++; }
        else {
          // Signal decay half-lives (days) — mirrors compute-trajectories.js
          const HALF_LIVES = {
            fundraising_signal: 45, investor_interest_signal: 30,
            growth_signal: 90, hiring_signal: 60,
            product_signal: 60, revenue_signal: 90,
            distress_signal: 14, exit_signal: 30,
            expansion_signal: 90, partnership_signal: 90,
          };
          const DEFAULT_HL = 120;
          function decayWeight(signal_class, detected_at) {
            const ageDays = (Date.now() - new Date(detected_at)) / 86400000;
            const hl = HALF_LIVES[signal_class] || DEFAULT_HL;
            return Math.pow(0.5, ageDays / hl);
          }

          // Aggregate in memory — O(N) single pass
          const byEntity = {};
          for (const s of (allSigs || [])) {
            if (!s.entity_id) continue;
            if (!byEntity[s.entity_id]) byEntity[s.entity_id] = {
              first: s.detected_at, last: s.detected_at, count: 0, decayedSum: 0,
            };
            const e = byEntity[s.entity_id];
            if (s.detected_at < e.first) e.first = s.detected_at;
            if (s.detected_at > e.last)  e.last  = s.detected_at;
            e.count++;
            e.decayedSum += decayWeight(s.signal_class, s.detected_at);
          }

          const entityUpdates = Object.entries(byEntity).map(([id, e]) => {
            const rangeDays = Math.max(1, (new Date(e.last) - new Date(e.first)) / 86400000);
            // Raw velocity: signals per 30 days (volume)
            const rawVelocity = +((e.count / rangeDays) * 30).toFixed(2);
            // Decayed velocity: decay-weighted signals per 30 days (recency-adjusted momentum)
            const decayedVelocity = +((e.decayedSum / rangeDays) * 30).toFixed(2);
            return {
              id,
              total_signals:          e.count,
              last_signal_date:       e.last?.split('T')[0],
              first_signal_date:      e.first?.split('T')[0],
              signal_velocity:        rawVelocity,
              // decayed_signal_velocity stored in metadata — add column migration if needed
              _decayed_velocity:      decayedVelocity,
              updated_at:             now,
            };
          });

          console.log(`  Updating metadata for ${entityUpdates.length} entities...`);
          if (!DRY_RUN) {
            // Batched upsert — 1 API call per 50 entities instead of 1 per entity.
            // onConflict:'id' ensures UPDATE path for existing rows.
            let updated = 0;
            let batchErrors = 0;
            for (let i = 0; i < entityUpdates.length; i += 50) {
              const batch = entityUpdates.slice(i, i + 50).map(u => ({
                id:               u.id,
                total_signals:    u.total_signals,
                last_signal_date: u.last_signal_date,
                first_signal_date: u.first_signal_date,
                signal_velocity:  u.signal_velocity,
                updated_at:       u.updated_at,
                metadata:         { decayed_signal_velocity: u._decayed_velocity },
              }));
              const { error: upErr } = await supabase
                .from('pythh_entities')
                .upsert(batch, { onConflict: 'id' });
              if (upErr) { console.error('  Upsert warn:', upErr.message); batchErrors++; }
              else updated += batch.length;
            }
            console.log(`  ✓ ${updated} entities refreshed${batchErrors ? ` (${batchErrors} batch errors)` : ''}`);
          } else {
            console.log(`  [DRY] Would refresh ${entityUpdates.length} entities`);
            const s = entityUpdates[0];
            if (s) console.log(`  [DRY] Sample: signals=${s.total_signals}, raw_velocity=${s.signal_velocity}/30d, decayed_velocity=${s._decayed_velocity}/30d`);
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RECONCILIATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Entities scanned:      ${stats.entities_scanned}`);
  console.log(`Signals scanned:       ${stats.signals_scanned}`);
  console.log(`Reliability stamped:   ${stats.reliability_stamped}`);
  console.log(`Timeline fixed:        ${stats.timeline_fixed}`);
  console.log(`Orphans removed:       ${stats.orphans_removed}`);
  console.log(`Duplicates merged:     ${stats.duplicates_merged}`);
  console.log(`Confidence boosted:    ${stats.confidence_boosted}`);
  console.log(`Conflicts detected:    ${stats.conflicts_detected}`);
  console.log(`Conflicts flagged:     ${stats.conflicts_flagged}`);
  console.log(`Errors:                ${stats.errors}`);
  console.log('═'.repeat(60) + '\n');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
