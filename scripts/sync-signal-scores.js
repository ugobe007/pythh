#!/usr/bin/env node
'use strict';

/**
 * sync-signal-scores.js
 *
 * Bridges pythh_signal_events → startup_signal_scores.
 *
 * CONTEXT:
 *   get_startup_context RPC reads startup_signal_scores for the 5 signal dimensions
 *   shown on SignalHealthHexagon (founder_language_shift, investor_receptivity,
 *   news_momentum, capital_convergence, execution_velocity).
 *
 *   The new pipeline writes to pythh_signal_events, but NEVER updated startup_signal_scores.
 *   Result: every founder sees 0 on their Signal Health chart.
 *
 *   This script is the bridge. It aggregates pythh_signal_events by entity,
 *   computes the 5 dimension scores, blends with GOD (same rules as
 *   server/lib/recomputeStartupSignalScoresFromPythh.js), and upserts startup_signal_scores.
 *
 * DIMENSION MAPPING (matches startup_signal_scores schema constraints):
 *   founder_language_shift  max 2.0  — exploratory, product, market_position, gtm signals
 *   investor_receptivity    max 2.5  — fundraising, revenue, growth, acquisition, enterprise
 *   news_momentum           max 1.5  — all rss_scrape + sec_edgar sourced signals (recency-weighted)
 *   capital_convergence     max 2.0  — fundraising, acquisition, exit, revenue (capital-flow aligned)
 *   execution_velocity      max 2.0  — product, hiring, expansion, partnership, growth (recency bonus)
 *
 * Usage:
 *   node scripts/sync-signal-scores.js              # dry run — shows what would be written
 *   node scripts/sync-signal-scores.js --apply      # writes to startup_signal_scores
 *   node scripts/sync-signal-scores.js --apply --limit=500
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { fetchAll, upsertInBatches } = require('../lib/supabaseUtils');
const { clamp, applyGodBlendToSignalDimensions } = require('../lib/signalScoreGodBlend');

/** Same default as instantSubmit (`scores.total_god_score || 50`) when GOD is missing in DB. */
const DEFAULT_GOD_SCORE_BLEND = 50;

function resolveGodScoreForBlend(raw) {
  if (raw != null && raw !== '' && Number.isFinite(Number(raw))) return Number(raw);
  return DEFAULT_GOD_SCORE_BLEND;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const DRY  = !args.includes('--apply');
const LIMIT_ARG = (() => { const l = args.find(a => a.startsWith('--limit=')); return l ? parseInt(l.split('=')[1]) : null; })();

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION WEIGHTS
// Each signal_class contributes to one or more dimensions.
// Weight = how strongly a single detection contributes to that dimension.
// Final score = Σ(confidence × signal_strength × class_weight) — capped at dimension max.
// ─────────────────────────────────────────────────────────────────────────────

const FOUNDER_LANGUAGE_CLASSES = {
  exploratory_signal:    1.0,
  product_signal:        0.9,
  market_position_signal:0.8,
  gtm_signal:            0.8,
  expansion_signal:      0.6,
  buyer_signal:          0.5,
  exit_signal:           0.5,  // founders actively communicating exit narrative
};

const INVESTOR_RECEPTIVITY_CLASSES = {
  fundraising_signal:    1.0,
  revenue_signal:        0.9,
  growth_signal:         0.85,
  acquisition_signal:    0.8,
  enterprise_signal:     0.75,
  demand_signal:         0.7,
  efficiency_signal:     0.65,
  distress_signal:       0.3,  // negative, but creates urgency
};

const CAPITAL_CONVERGENCE_CLASSES = {
  fundraising_signal:    1.0,
  acquisition_signal:    0.9,
  exit_signal:           0.85,
  revenue_signal:        0.75,
  growth_signal:         0.65,
  distress_signal:       0.4,
};

const EXECUTION_VELOCITY_CLASSES = {
  product_signal:        1.0,
  hiring_signal:         0.9,
  growth_signal:         0.85,
  expansion_signal:      0.8,
  partnership_signal:    0.75,
  gtm_signal:            0.7,
  demand_signal:         0.6,
};

// News momentum: source-type-based (class-agnostic — any signal from press/web counts)
//
// Source type values come from ingest-pythh-signals.js, which uses extracted_data field
// names as source types. execution_signals and web_signals originate from RSS scrapers.
const NEWS_SOURCE_WEIGHTS = {
  // RSS / web-scraped external sources
  execution_signals: 0.85,  // from ssot-rss-scraper / simple-rss-scraper (external RSS)
  web_signals:       0.65,  // web-scraped content
  rss_scrape:        1.0,   // explicit RSS, future-proofed
  sec_edgar:         0.85,  // SEC filings — high-credibility external

  // Partially external sources
  llm_enrichment:    0.35,  // LLM-inferred, not direct press
  social_signal:     0.45,  // social media mentions

  // Internal/founder-authored — don't count as press
  description:       0.0,
  pitch:             0.0,
  problem:           0.0,
  solution:          0.0,
  value_proposition: 0.0,
  tagline:           0.0,
  market:            0.0,
  founder_upload:    0.0,
  structured_metrics:0.0,
};

// Dimension caps (from startup_signal_scores schema CHECK constraints)
const CAP = {
  founder_language_shift: 2.0,
  investor_receptivity:   2.5,
  news_momentum:          1.5,
  capital_convergence:    2.0,
  execution_velocity:     2.0,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Milliseconds since detected_at, clamped to 0. */
function ageMs(detectedAt) {
  return Math.max(0, Date.now() - new Date(detectedAt).getTime());
}

const DAY_MS = 86_400_000;

/**
 * Recency multiplier: signals that are very fresh get a boost.
 *   < 7 days  → 1.5×
 *   < 30 days → 1.0×
 *   < 90 days → 0.7×
 *   older     → 0.4×
 */
function recencyMult(detectedAt) {
  const ageDays = ageMs(detectedAt) / DAY_MS;
  if (ageDays <  7) return 1.5;
  if (ageDays < 30) return 1.0;
  if (ageDays < 90) return 0.7;
  return 0.4;
}

/** Sum contributions from a list of signals for a given class-weight map. */
function sumDimension(signals, classWeights, recency = false) {
  let score = 0;
  for (const s of signals) {
    const w = classWeights[s.primary_signal];
    if (!w) continue;
    const conf     = s.confidence      ?? 0.5;
    const strength = s.signal_strength ?? 0.5;
    const rec      = recency ? recencyMult(s.detected_at) : 1.0;
    score += conf * strength * w * rec;
  }
  return score;
}

/** Compute news_momentum from source-type weights (ignores signal class). */
function computeNewsMomentum(signals) {
  let score = 0;
  for (const s of signals) {
    const w = NEWS_SOURCE_WEIGHTS[s.source_type] ?? 0;
    if (!w) continue;
    const conf = s.confidence ?? 0.5;
    const rec  = recencyMult(s.detected_at);
    score += conf * w * rec * 0.15; // divisor keeps it calibrated to 0-1.5 range
  }
  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄  sync-signal-scores  ${DRY ? '(DRY RUN)' : '(APPLY)'}\n`);

  // 1. Load all entities linked to startup_uploads
  console.log('  Loading pythh_entities with startup_upload_id…');
  const { data: entities, error: entErr } = await fetchAll((from, to) =>
    supabase
      .from('pythh_entities')
      .select('id, startup_upload_id, name')
      .not('startup_upload_id', 'is', null)
      .range(from, to)
  );
  if (entErr) { console.error('  Entity load error:', entErr.message); process.exit(1); }

  let entityList = entities || [];
  if (LIMIT_ARG) entityList = entityList.slice(0, LIMIT_ARG);
  console.log(`  Found ${entityList.length} entities with startup_upload_id\n`);

  const uploadIds = [...new Set(entityList.map(e => e.startup_upload_id).filter(Boolean))];
  const godByUploadId = {};
  if (uploadIds.length > 0) {
    // PostgREST URL/query limits: a single .in() with tens of thousands of UUIDs returns 0 rows silently.
    const GOD_ID_CHUNK = 150;
    for (let i = 0; i < uploadIds.length; i += GOD_ID_CHUNK) {
      const idChunk = uploadIds.slice(i, i + GOD_ID_CHUNK);
      const { data: godRows, error: godErr } = await supabase
        .from('startup_uploads')
        .select('id, total_god_score')
        .in('id', idChunk);
      if (godErr) {
        console.warn(`  total_god_score chunk ${i} warning:`, godErr.message);
        continue;
      }
      for (const r of godRows || []) {
        godByUploadId[r.id] = r.total_god_score;
      }
    }
    console.log(
      `  Loaded total_god_score for ${Object.keys(godByUploadId).length} / ${uploadIds.length} startup_uploads (chunked)\n`
    );
  }

  const entityIds = entityList.map(e => e.id);
  const uploadIdByEntity = {};
  for (const e of entityList) uploadIdByEntity[e.id] = e.startup_upload_id;

  // 2. Load all signal events for these entities (in chunks of 100)
  console.log('  Loading pythh_signal_events…');
  const allSignals = [];
  const CHUNK = 100;
  for (let i = 0; i < entityIds.length; i += CHUNK) {
    const chunk = entityIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('pythh_signal_events')
      .select('entity_id, primary_signal, confidence, signal_strength, source_type, detected_at')
      .in('entity_id', chunk);
    if (error) { console.error(`  Chunk ${i} error:`, error.message); continue; }
    allSignals.push(...(data || []));
  }
  console.log(`  Loaded ${allSignals.length} signal events\n`);

  // 3. Group signals by entity_id
  const byEntity = {};
  for (const s of allSignals) {
    if (!byEntity[s.entity_id]) byEntity[s.entity_id] = [];
    byEntity[s.entity_id].push(s);
  }

  // 4. Compute dimension scores per entity
  const rows = [];
  let withSignals = 0;
  let noSignals   = 0;

  const dimTotals = { founder_language_shift: 0, investor_receptivity: 0, news_momentum: 0, capital_convergence: 0, execution_velocity: 0 };
  const classCounts = {};
  let godScoreDefaulted = 0;

  for (const entity of entityList) {
    const uploadId = uploadIdByEntity[entity.id];
    if (!uploadId) continue;

    const signals = byEntity[entity.id] || [];
    if (signals.length === 0) { noSignals++; continue; }
    withSignals++;

    // Track class distribution for reporting
    for (const s of signals) {
      classCounts[s.primary_signal] = (classCounts[s.primary_signal] || 0) + 1;
    }

    const founder_language_shift_raw = clamp(
      sumDimension(signals, FOUNDER_LANGUAGE_CLASSES, false),
      CAP.founder_language_shift
    );
    const investor_receptivity_raw = clamp(
      sumDimension(signals, INVESTOR_RECEPTIVITY_CLASSES, false),
      CAP.investor_receptivity
    );
    const news_momentum_raw = clamp(computeNewsMomentum(signals), CAP.news_momentum);
    const capital_convergence_raw = clamp(
      sumDimension(signals, CAPITAL_CONVERGENCE_CLASSES, true),
      CAP.capital_convergence
    );
    const execution_velocity_raw = clamp(
      sumDimension(signals, EXECUTION_VELOCITY_CLASSES, true),
      CAP.execution_velocity
    );

    const rawGod = godByUploadId[uploadId];
    if (rawGod == null || rawGod === '' || !Number.isFinite(Number(rawGod))) godScoreDefaulted++;
    const godScore = resolveGodScoreForBlend(rawGod);
    const blended = applyGodBlendToSignalDimensions(
      {
        founder_language_shift: founder_language_shift_raw,
        investor_receptivity: investor_receptivity_raw,
        news_momentum: news_momentum_raw,
        capital_convergence: capital_convergence_raw,
        execution_velocity: execution_velocity_raw,
      },
      signals.length,
      godScore,
      CAP
    );
    const {
      founder_language_shift,
      investor_receptivity,
      news_momentum,
      capital_convergence,
      execution_velocity,
      signals_total,
      eventSum,
      blendWeight,
      godPrior,
    } = blended;

    dimTotals.founder_language_shift += founder_language_shift;
    dimTotals.investor_receptivity   += investor_receptivity;
    dimTotals.news_momentum          += news_momentum;
    dimTotals.capital_convergence    += capital_convergence;
    dimTotals.execution_velocity     += execution_velocity;

    rows.push({
      startup_id:              uploadId,
      as_of:                   new Date().toISOString(),
      signals_total,
      founder_language_shift,
      investor_receptivity,
      news_momentum,
      capital_convergence,
      execution_velocity,
      debug: {
        entity_id: entity.id,
        signal_count: signals.length,
        event_sum_before_blend: eventSum,
        god_prior: godPrior,
        blend_weight: godPrior != null ? blendWeight : null,
        god_score_db: rawGod != null && rawGod !== '' && Number.isFinite(Number(rawGod)) ? Number(rawGod) : null,
        god_score_used_for_blend: godScore,
        source: 'sync-signal-scores.js',
        computed_at: new Date().toISOString(),
      },
    });
  }

  // 5. Report
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Entities with signals:  ${withSignals}`);
  console.log(`  Entities without:       ${noSignals}`);
  console.log(`  Rows to upsert:         ${rows.length}`);
  if (withSignals > 0) {
    console.log(`  GOD default ${DEFAULT_GOD_SCORE_BLEND} used for blend: ${godScoreDefaulted} / ${withSignals} rows (missing/non-finite total_god_score)`);
  }

  if (rows.length > 0) {
    const n = rows.length;
    console.log('\n  Average dimension scores:');
    console.log(`    founder_language_shift : ${(dimTotals.founder_language_shift / n).toFixed(2)} / 2.0`);
    console.log(`    investor_receptivity   : ${(dimTotals.investor_receptivity   / n).toFixed(2)} / 2.5`);
    console.log(`    news_momentum          : ${(dimTotals.news_momentum          / n).toFixed(2)} / 1.5`);
    console.log(`    capital_convergence    : ${(dimTotals.capital_convergence    / n).toFixed(2)} / 2.0`);
    console.log(`    execution_velocity     : ${(dimTotals.execution_velocity     / n).toFixed(2)} / 2.0`);

    const totalAvg = (dimTotals.founder_language_shift + dimTotals.investor_receptivity + dimTotals.news_momentum + dimTotals.capital_convergence + dimTotals.execution_velocity) / n;
    console.log(`    ──────────────────────────────────────────`);
    console.log(`    signals_total avg      : ${totalAvg.toFixed(2)} / 10.0`);

    console.log('\n  Top signal classes:');
    const sorted = Object.entries(classCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [cls, cnt] of sorted) console.log(`    ${cls.padEnd(32)} ${cnt}`);

    // Sample 3 rows for spot-check
    console.log('\n  Sample rows (first 3):');
    for (const r of rows.slice(0, 3)) {
      console.log(`    startup_id=${r.startup_id.slice(0, 8)}…  total=${r.signals_total}  news=${r.news_momentum}  velocity=${r.execution_velocity}  signals=${r.debug.signal_count}`);
    }
  }

  if (DRY) {
    console.log('\n  DRY RUN — no writes. Re-run with --apply to commit.\n');
    process.exit(0);
  }

  // 6. Upsert into startup_signal_scores
  console.log('\n  Upserting into startup_signal_scores…');
  const { upserted, errors } = await upsertInBatches(
    supabase, 'startup_signal_scores', rows, 'startup_id'
  );
  console.log(`  ✓ Upserted ${upserted} rows`);
  if (errors > 0) console.error(`  ✗ ${errors} batch errors — check logs above`);

  console.log('\n  Done.\n');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
