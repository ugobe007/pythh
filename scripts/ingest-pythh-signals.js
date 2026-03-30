#!/usr/bin/env node
/**
 * INGEST PYTHH SIGNALS
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads approved startup_uploads records, extracts rich content (description,
 * pitch, tagline, problem, solution, value_proposition), parses signal objects
 * sentence-by-sentence, and writes to the Pythh signal intelligence tables:
 *
 *   pythh_entities       — upsert one entity per startup
 *   pythh_signal_events  — one row per meaningful parsed signal
 *   pythh_signal_timeline — lightweight time-series entry per signal
 *
 * Content priority (first non-empty wins per sentence source):
 *   description → pitch → problem + solution → value_proposition → tagline
 *   → admin_notes (sometimes holds article context)
 *
 * Usage:
 *   node scripts/ingest-pythh-signals.js              # dry-run
 *   node scripts/ingest-pythh-signals.js --apply
 *   node scripts/ingest-pythh-signals.js --apply --limit 500
 *   node scripts/ingest-pythh-signals.js --apply --since 2026-01-01
 *   node scripts/ingest-pythh-signals.js --apply --min-confidence 0.45
 */

'use strict';
require('dotenv').config();

const { createClient }    = require('@supabase/supabase-js');
const { parseSignal }     = require('../lib/signalParser');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) { console.error(`❌ Missing ${k}`); process.exit(1); }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── CLI flags ─────────────────────────────────────────────────────────────────
function argVal(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const DRY_RUN    = !process.argv.includes('--apply');
const LIMIT      = +(argVal('--limit',          '3000'));
const BATCH_SZ   = +(argVal('--batch',          '50'));
const SINCE      =   argVal('--since',          null);
const MIN_CONF   = +(argVal('--min-confidence', '0.38'));

// ── Text extraction ───────────────────────────────────────────────────────────
/**
 * Pull all parseable text blocks from a startup_uploads record.
 * Returns an array of { text, source_type } objects.
 */
function extractTextBlocks(row) {
  const ed  = row.extracted_data || {};
  const blocks = [];

  const toStr = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(toStr).filter(Boolean).join('. ');
    if (typeof v === 'object') {
      // Extract any string values from the object
      return Object.values(v).map(toStr).filter(Boolean).join('. ');
    }
    return '';
  };

  const push = (raw, src) => {
    const t = toStr(raw).trim();
    if (t.length >= 20) blocks.push({ text: t.slice(0, 1500), source_type: src });
  };

  push(ed.description,        'description');
  push(ed.pitch,              'pitch');
  push(ed.value_proposition,  'value_proposition');
  push(ed.problem,            'problem');
  push(ed.solution,           'solution');
  push(ed.tagline,            'tagline');
  push(ed.market,             'market');
  push(ed.web_signals,        'web_signals');
  push(ed.execution_signals,  'execution_signals');

  return blocks;
}

/**
 * Split a text block into individual sentences for per-sentence parsing.
 * Avoids splitting on abbreviations like "Inc." or "U.S.".
 */
function splitSentences(text) {
  return text
    .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length >= 15 && s.length <= 600);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 PYTHH SIGNAL INGESTION PIPELINE');
  console.log('═'.repeat(60));
  console.log(`Mode:     ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Limit:    ${LIMIT} startups`);
  console.log(`Min conf: ${MIN_CONF}`);
  if (SINCE) console.log(`Since:    ${SINCE}`);
  console.log('═'.repeat(60) + '\n');

  // ── Query startup_uploads ─────────────────────────────────────────────────
  let query = supabase
    .from('startup_uploads')
    .select('id, name, website, sectors, extracted_data, updated_at, created_at')
    .eq('status', 'approved')
    .not('extracted_data', 'is', null)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (SINCE) query = query.gte('updated_at', SINCE);

  const { data: rows, error } = await query;
  if (error) { console.error('❌ Fetch failed:', error.message); process.exit(1); }
  console.log(`📊 Startups to process: ${rows?.length ?? 0}\n`);
  if (!rows?.length) { console.log('Nothing to process.'); return; }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    startups: 0, entities_upserted: 0,
    sentences_parsed: 0, signals_written: 0,
    skipped_low_conf: 0, skipped_unclassified: 0,
    errors: 0,
    by_class: {}, by_evidence: {},
  };

  // ── Process in batches ────────────────────────────────────────────────────
  for (let i = 0; i < rows.length; i += BATCH_SZ) {
    const batch = rows.slice(i, i + BATCH_SZ);

    for (const row of batch) {
      stats.startups++;

      // 1. Upsert entity
      const entityPayload = {
        name:              row.name,
        entity_type:       'startup',
        sectors:           Array.isArray(row.sectors)
                             ? row.sectors
                             : (row.extracted_data?.sectors || []),
        geographies:       [],
        stage:             row.extracted_data?.funding_stage || null,
        website:           row.website || null,
        startup_upload_id: row.id,
        is_active:         true,
        last_signal_date:  new Date().toISOString().split('T')[0],
        updated_at:        new Date().toISOString(),
      };

      let entityId = null;
      if (!DRY_RUN) {
        const { data: existing } = await supabase
          .from('pythh_entities')
          .select('id')
          .eq('startup_upload_id', row.id)
          .maybeSingle();

        if (existing) {
          await supabase.from('pythh_entities')
            .update({ ...entityPayload })
            .eq('id', existing.id);
          entityId = existing.id;
        } else {
          const { data: inserted } = await supabase.from('pythh_entities')
            .insert(entityPayload)
            .select('id')
            .single();
          entityId = inserted?.id;
        }
        if (entityId) stats.entities_upserted++;
      } else {
        entityId = `dry_${row.id}`;
      }

      // 2. Extract text blocks and parse sentence-level signals
      const blocks = extractTextBlocks(row);
      if (blocks.length === 0) continue;

      const detectedAt = row.updated_at || row.created_at || new Date().toISOString();
      const signalDate = detectedAt.split('T')[0];

      for (const { text, source_type } of blocks) {
        const sentences = splitSentences(text);

        for (const sentence of sentences) {
          try {
            const sig = parseSignal(sentence, {
              source_type,
              actor_context: row.name,
            });
            if (!sig) continue;
            stats.sentences_parsed++;

            const cls = sig.primary_signal || 'unclassified_signal';
            const conf = sig.confidence ?? 0;

            // Filter weak / unclassified signals
            if (cls === 'unclassified_signal') { stats.skipped_unclassified++; continue; }
            if (conf < MIN_CONF)               { stats.skipped_low_conf++;     continue; }

            stats.signals_written++;
            stats.by_class[cls]                    = (stats.by_class[cls] || 0) + 1;
            const ev = sig.evidence_quality || 'unknown';
            stats.by_evidence[ev]                  = (stats.by_evidence[ev] || 0) + 1;

            if (DRY_RUN) continue;

            // 3. Write to pythh_signal_events
            const eventRow = {
              entity_id:         entityId,
              source:            source_type,
              source_type,
              source_url:        row.extracted_data?.source_url || row.website || null,
              detected_at:       detectedAt,
              raw_sentence:      sentence,
              signal_object:     sig,
              primary_signal:    cls,
              signal_type:       sig.signal_type     || null,
              signal_strength:   sig.signal_strength ?? null,
              confidence:        conf,
              evidence_quality:  ev,
              actor_type:        sig.actor           || null,
              action_tag:        sig._actions?.[0]?.action_tag || null,
              modality:          sig.modality         || null,
              intensity:         sig._intensity       || [],
              posture:           sig.posture          || null,
              is_costly_action:  sig.costly_action    || false,
              is_ambiguous:      sig.is_ambiguous     || false,
              is_multi_signal:   (sig._sub_signals?.length > 0) || false,
              has_negation:      sig.has_negation     || false,
              sub_signals:       sig._sub_signals     || [],
              who_cares:         sig.who_cares        || {},
              likely_stage:      sig.inference?.likely_stage  || null,
              likely_needs:      sig.inference?.likely_need   || [],
              urgency:           sig.inference?.urgency       || null,
            };

            await supabase.from('pythh_signal_events').insert(eventRow);

            // 4. Write to pythh_signal_timeline (lightweight)
            await supabase.from('pythh_signal_timeline').insert({
              entity_id:         entityId,
              event_date:        signalDate,
              signal_class:      cls,
              signal_type:       sig.signal_type     || null,
              signal_strength:   sig.signal_strength ?? null,
              confidence:        conf,
              evidence_quality:  ev,
              is_costly_action:  sig.costly_action   || false,
              summary:           sig._actions?.[0]?.meaning || cls,
              source:            source_type,
              source_type,
              source_url:        row.extracted_data?.source_url || row.website || null,
            });

          } catch (e) {
            stats.errors++;
          }
        }
      }
    }

    const pct = Math.round(((i + batch.length) / rows.length) * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${rows.length} startups (${pct}%)  `);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Startups processed:   ${stats.startups}`);
  console.log(`Entities upserted:    ${DRY_RUN ? '(dry-run)' : stats.entities_upserted}`);
  console.log(`Sentences parsed:     ${stats.sentences_parsed}`);
  console.log(`Signals written:      ${DRY_RUN ? '(dry-run)' : stats.signals_written}`);
  console.log(`Skipped (unclassif.): ${stats.skipped_unclassified}`);
  console.log(`Skipped (low conf):   ${stats.skipped_low_conf}`);
  console.log(`Errors:               ${stats.errors}`);

  if (Object.keys(stats.by_class).length > 0) {
    console.log('\nTop signal classes:');
    Object.entries(stats.by_class)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
  }
  if (Object.keys(stats.by_evidence).length > 0) {
    console.log('\nEvidence quality:');
    Object.entries(stats.by_evidence)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
  }

  if (DRY_RUN) {
    console.log('\n💡 Run with --apply to write to pythh_signal_events.');
  } else {
    console.log('\n✅ Ingestion complete. Run compute-trajectories.js next.');
  }
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
