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

const { createClient }         = require('@supabase/supabase-js');
const { parseSignal }          = require('../lib/signalParser');
const { buildSignalEvent,
        buildTimelineEvent }   = require('../lib/signalEventBuilder');
const { insertInBatches }      = require('../lib/supabaseUtils');

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
const DRY_RUN        = !process.argv.includes('--apply');
const SKIP_EXISTING  =  process.argv.includes('--skip-existing');
const LIMIT          = +(argVal('--limit',          '3000'));
const BATCH_SZ       = +(argVal('--batch',          '50'));
const SINCE          =   argVal('--since',          null);
const MIN_CONF       = +(argVal('--min-confidence', '0.38'));

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
  if (SINCE)          console.log(`Since:    ${SINCE}`);
  if (SKIP_EXISTING)  console.log(`Skip:     already-ingested entities`);
  console.log('═'.repeat(60) + '\n');

  // ── Paginated fetch of startup_uploads ───────────────────────────────────
  // PostgREST caps at 1,000 rows per request — paginate through all records.
  console.log('📥 Fetching startup_uploads (paginated)…');
  const PAGE_FETCH = 500;
  let processRows = [];
  let offset = 0;

  while (processRows.length < LIMIT) {
    let q = supabase
      .from('startup_uploads')
      .select('id, name, website, sectors, extracted_data, updated_at, created_at')
      .eq('status', 'approved')
      .not('extracted_data', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_FETCH - 1);

    if (SINCE) q = q.gte('updated_at', SINCE);

    const { data: page, error } = await q;
    if (error) { console.error('❌ Fetch failed:', error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    processRows.push(...page);
    process.stdout.write(`\r   Fetched: ${processRows.length}…`);
    if (page.length < PAGE_FETCH) break;
    offset += PAGE_FETCH;
  }
  console.log(`\r   Fetched: ${processRows.length} startups from DB.`);

  // ── Filter out already-ingested startups (--skip-existing) ───────────────
  if (SKIP_EXISTING && processRows.length > 0) {
    console.log('🔎 Checking which startups are already ingested…');
    // Fetch all startup_upload_ids already in pythh_entities
    const PAGE = 1000;
    const alreadyIngested = new Set();
    let offset = 0;
    while (true) {
      const { data: eids } = await supabase
        .from('pythh_entities')
        .select('startup_upload_id')
        .not('startup_upload_id', 'is', null)
        .range(offset, offset + PAGE - 1);
      if (!eids || eids.length === 0) break;
      for (const e of eids) alreadyIngested.add(e.startup_upload_id);
      if (eids.length < PAGE) break;
      offset += PAGE;
    }
    const before = processRows.length;
    processRows = processRows.filter(r => !alreadyIngested.has(r.id));
    console.log(`   Already ingested: ${alreadyIngested.size} | Skipping: ${before - processRows.length} | To process: ${processRows.length}\n`);
  }

  console.log(`📊 Startups to process: ${processRows.length}\n`);
  if (!processRows.length) { console.log('Nothing to process.'); return; }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    startups: 0, entities_upserted: 0,
    sentences_parsed: 0, signals_written: 0,
    skipped_low_conf: 0, skipped_unclassified: 0,
    errors: 0,
    by_class: {}, by_evidence: {},
  };

  // ── When --skip-existing is set, ALL rows are new → pre-bulk-insert entities
  // This avoids N individual SELECT+INSERT pairs (major speedup for large batches)
  const knownNewIds = SKIP_EXISTING ? new Set(processRows.map(r => r.id)) : null;
  // entityIdMap: startup_upload_id → pythh_entity.id (populated on first batch insert)
  const entityIdMap = {};

  if (!DRY_RUN && knownNewIds) {
    console.log(`\n⚡ Bulk-inserting ${processRows.length} entities (fast path)…`);
    const ENTITY_BATCH = 200;
    const today = new Date().toISOString().split('T')[0];
    const now   = new Date().toISOString();
    for (let ei = 0; ei < processRows.length; ei += ENTITY_BATCH) {
      const eb = processRows.slice(ei, ei + ENTITY_BATCH).map(row => ({
        name:              row.name,
        entity_type:       'startup',
        sectors:           Array.isArray(row.sectors) ? row.sectors : (row.extracted_data?.sectors || []),
        geographies:       [],
        stage:             row.extracted_data?.funding_stage || null,
        website:           row.website || null,
        startup_upload_id: row.id,
        is_active:         true,
        last_signal_date:  today,
        updated_at:        now,
      }));
      const { data: inserted, error: entErr } = await supabase
        .from('pythh_entities')
        .insert(eb)
        .select('id, startup_upload_id');
      if (entErr) { console.error('\n  Entity batch error:', entErr.message); stats.errors++; }
      else {
        for (const e of (inserted || [])) entityIdMap[e.startup_upload_id] = e.id;
        stats.entities_upserted += (inserted || []).length;
      }
      process.stdout.write(`\r   Entity inserts: ${Math.min(ei + ENTITY_BATCH, processRows.length)}/${processRows.length}  `);
    }
    console.log('\n');
  }

  // ── Process in batches ───────────────────────────────────────────────────
  // Signal rows are buffered and flushed in batches — not one insert per signal.
  const eventBuf    = [];
  const timelineBuf = [];

  const flush = async () => {
    if (!DRY_RUN && eventBuf.length > 0) {
      await insertInBatches(supabase, 'pythh_signal_events',   eventBuf);
      await insertInBatches(supabase, 'pythh_signal_timeline', timelineBuf);
      eventBuf.length    = 0;
      timelineBuf.length = 0;
    }
  };

  for (let i = 0; i < processRows.length; i += BATCH_SZ) {
    const batch = processRows.slice(i, i + BATCH_SZ);

    for (const row of batch) {
      stats.startups++;

      // ── Entity resolution ──────────────────────────────────────────────────
      let entityId = null;
      if (!DRY_RUN) {
        if (knownNewIds) {
          entityId = entityIdMap[row.id] ?? null;
        } else {
          const entityPayload = {
            name:              row.name,
            entity_type:       'startup',
            sectors:           Array.isArray(row.sectors) ? row.sectors : (row.extracted_data?.sectors || []),
            geographies:       [],
            stage:             row.extracted_data?.funding_stage || null,
            website:           row.website || null,
            startup_upload_id: row.id,
            is_active:         true,
            last_signal_date:  new Date().toISOString().split('T')[0],
            updated_at:        new Date().toISOString(),
          };
          const { data: existing } = await supabase
            .from('pythh_entities')
            .select('id')
            .eq('startup_upload_id', row.id)
            .maybeSingle();
          if (existing) {
            await supabase.from('pythh_entities').update(entityPayload).eq('id', existing.id);
            entityId = existing.id;
          } else {
            const { data: ins } = await supabase.from('pythh_entities').insert(entityPayload).select('id').single();
            entityId = ins?.id;
          }
          if (entityId) stats.entities_upserted++;
        }
      } else {
        entityId = `dry_${row.id}`;
      }

      // ── Extract text + parse signals ───────────────────────────────────────
      const blocks = extractTextBlocks(row);
      if (blocks.length === 0) continue;

      const detectedAt = row.updated_at || row.created_at || new Date().toISOString();
      const signalDate = detectedAt.split('T')[0];
      const sourceUrl  = row.extracted_data?.source_url || row.website || null;

      for (const { text, source_type } of blocks) {
        for (const sentence of splitSentences(text)) {
          try {
            const sig = parseSignal(sentence, { source_type, actor_context: row.name });
            if (!sig) continue;
            stats.sentences_parsed++;

            const cls  = sig.primary_signal || 'unclassified_signal';
            const conf = sig.confidence ?? 0;

            if (cls === 'unclassified_signal') { stats.skipped_unclassified++; continue; }
            if (conf < MIN_CONF)               { stats.skipped_low_conf++;     continue; }

            stats.signals_written++;
            stats.by_class[cls]                = (stats.by_class[cls] || 0) + 1;
            stats.by_evidence[sig.evidence_quality] = (stats.by_evidence[sig.evidence_quality] || 0) + 1;

            if (DRY_RUN) continue;

            // ── Use canonical builder — field mapping lives in signalEventBuilder.js ──
            const meta = { entityId, rawSentence: sentence, sourceType: source_type,
                           source: source_type, sourceUrl, detectedAt };
            eventBuf.push(buildSignalEvent(sig, meta));
            timelineBuf.push(buildTimelineEvent(sig, { entityId, sourceType: source_type,
                                                       source: source_type, sourceUrl,
                                                       eventDate: signalDate }));
          } catch (e) {
            stats.errors++;
          }
        }
      }
    }

    // Flush after each startup batch
    await flush();
    const pct = Math.round(((i + batch.length) / processRows.length) * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${processRows.length} startups (${pct}%)  `);
  }

  // Final flush for any remaining rows
  await flush();

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
