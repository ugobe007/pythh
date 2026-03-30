#!/usr/bin/env node
/**
 * INGEST DISCOVERED SIGNALS
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads discovered_startups records (RSS-scraped headlines + any enriched
 * fields) and ingests them into the Pythh signal intelligence tables.
 *
 * Uses: article_title, description, problem, solution, value_proposition
 *
 * Only processes records where:
 *   - startup_id IS NULL (not yet promoted to startup_uploads)
 *   - name and article_title are non-null
 *
 * Deduplication: skips companies already in pythh_entities by name or
 * by startup_id linkage (when the record has been imported).
 *
 * Usage:
 *   node scripts/ingest-discovered-signals.js              # dry-run
 *   node scripts/ingest-discovered-signals.js --apply
 *   node scripts/ingest-discovered-signals.js --apply --limit 5000
 *   node scripts/ingest-discovered-signals.js --apply --skip-existing
 */

'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { parseSignal }  = require('../lib/signalParser');

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
const DRY_RUN       = !process.argv.includes('--apply');
const SKIP_EXISTING =  process.argv.includes('--skip-existing');
const LIMIT         = +(argVal('--limit',           '5000'));
const BATCH_SZ      = +(argVal('--batch',           '50'));
const MIN_CONF      = +(argVal('--min-confidence',  '0.38'));

// ── Text extraction ───────────────────────────────────────────────────────────
function toStr(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 400);
  return String(v).trim();
}

function extractTextBlocks(row) {
  const blocks = [];
  const add = (text, src) => {
    const t = toStr(text);
    if (t && t.length >= 20) blocks.push({ text: t, source_type: src });
  };
  add(row.article_title,      'news');
  add(row.description,        'website');
  add(row.problem,            'website');
  add(row.solution,           'website');
  add(row.value_proposition,  'website');
  return blocks;
}

function splitSentences(text) {
  return text
    .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length >= 15 && s.length <= 600);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔍 DISCOVERED STARTUPS SIGNAL INGESTION');
  console.log('═'.repeat(60));
  console.log(`Mode:     ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Limit:    ${LIMIT} records`);
  console.log(`Min conf: ${MIN_CONF}`);
  if (SKIP_EXISTING) console.log('Skip:     already-ingested entities (by name)');
  console.log('═'.repeat(60) + '\n');

  // ── Paginated fetch of discovered_startups (not yet in startup_uploads) ──
  console.log('📥 Fetching discovered_startups (paginated, startup_id IS NULL)…');
  const PAGE_FETCH = 500;
  let rows = [];
  let offset = 0;
  while (rows.length < LIMIT) {
    const { data: page, error } = await supabase
      .from('discovered_startups')
      .select('id, name, website, sectors, description, problem, solution, value_proposition, article_title, article_url, rss_source, article_date, created_at, updated_at')
      .is('startup_id', null)
      .not('name', 'is', null)
      .or('article_title.not.is.null,description.not.is.null')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_FETCH - 1);
    if (error) { console.error('❌ Fetch failed:', error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    rows.push(...page);
    process.stdout.write(`\r   Fetched: ${rows.length}…`);
    if (page.length < PAGE_FETCH) break;
    offset += PAGE_FETCH;
  }
  rows = rows.slice(0, LIMIT);
  console.log(`\r   Fetched: ${rows.length} discovered_startups (startup_id IS NULL).\n`);

  if (!rows.length) {
    console.log('No discovered_startups to process (all already imported or none with article_title).');
    return;
  }

  // ── Skip-existing: load entity names already in pythh_entities ───────────
  if (SKIP_EXISTING) {
    console.log('🔎 Loading existing entity names from pythh_entities…');
    const EPAGE = 1000;
    const existingNames = new Set();
    let eoff = 0;
    while (true) {
      const { data: ep } = await supabase
        .from('pythh_entities')
        .select('name')
        .range(eoff, eoff + EPAGE - 1);
      if (!ep || ep.length === 0) break;
      for (const e of ep) if (e.name) existingNames.add(e.name.toLowerCase());
      if (ep.length < EPAGE) break;
      eoff += EPAGE;
    }
    const before = rows.length;
    rows = rows.filter(r => !existingNames.has((r.name || '').toLowerCase()));
    console.log(`   Existing: ${existingNames.size} | Skipping: ${before - rows.length} | To process: ${rows.length}\n`);
  }

  if (!rows.length) { console.log('All already ingested.'); return; }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    startups: 0, entities_inserted: 0,
    sentences_parsed: 0, signals_written: 0,
    skipped_low_conf: 0, skipped_unclassified: 0, errors: 0,
    by_class: {}, by_evidence: {},
  };

  // ── Bulk entity insert (fast path) ────────────────────────────────────────
  if (!DRY_RUN) {
    console.log(`⚡ Bulk-inserting ${rows.length} entities (fast path)…`);
    const ENTITY_BATCH = 200;
    const today = new Date().toISOString().split('T')[0];
    const now   = new Date().toISOString();
    const entityIdMap = {};

    for (let ei = 0; ei < rows.length; ei += ENTITY_BATCH) {
      const eb = rows.slice(ei, ei + ENTITY_BATCH).map(row => ({
        name:                   row.name,
        entity_type:            'startup',
        sectors:                Array.isArray(row.sectors) ? row.sectors : [],
        geographies:            [],
        stage:                  row.funding_stage || null,
        website:                row.website || null,
        startup_upload_id:      null,
        discovered_startup_id:  row.id,
        is_active:              true,
        last_signal_date:       today,
        updated_at:             now,
        metadata:               { source: 'discovered' },
      }));
      const { data: inserted, error: entErr } = await supabase
        .from('pythh_entities')
        .insert(eb)
        .select('id, name');
      if (entErr) {
        // On conflict (name already exists), try individually to get existing IDs
        console.error('\n  Entity batch error:', entErr.message.substring(0, 80));
        stats.errors++;
      } else {
        for (const e of (inserted || [])) entityIdMap[e.name] = e.id;
        stats.entities_inserted += (inserted || []).length;
      }
      process.stdout.write(`\r   Entity inserts: ${Math.min(ei + ENTITY_BATCH, rows.length)}/${rows.length}  `);
    }
    console.log('\n');
    // Also look up IDs for any rows that had conflicts (already existed)
    const unmappedNames = rows.filter(r => !entityIdMap[r.name]).map(r => r.name);
    if (unmappedNames.length > 0) {
      const NAME_BATCH = 100;
      for (let ni = 0; ni < unmappedNames.length; ni += NAME_BATCH) {
        const { data: existing } = await supabase
          .from('pythh_entities')
          .select('id, name')
          .in('name', unmappedNames.slice(ni, ni + NAME_BATCH));
        for (const e of (existing || [])) entityIdMap[e.name] = e.id;
      }
    }

    // ── Signal parsing loop ───────────────────────────────────────────────
    const signalBuf  = [];
    const timelineBuf = [];
    const FLUSH_SIZE  = 100;

    async function flushSignals(force = false) {
      if (force || signalBuf.length >= FLUSH_SIZE) {
        const s = signalBuf.splice(0, signalBuf.length);
        const t = timelineBuf.splice(0, timelineBuf.length);
        if (s.length) {
          const { error } = await supabase.from('pythh_signal_events').insert(s);
          if (error) { stats.errors++; }
          else stats.signals_written += s.length;
        }
        if (t.length) await supabase.from('pythh_signal_timeline').insert(t);
      }
    }

    for (let i = 0; i < rows.length; i += BATCH_SZ) {
      const batch = rows.slice(i, i + BATCH_SZ);

      for (const row of batch) {
        stats.startups++;
        const entityId = entityIdMap[row.name];
        if (!entityId) continue;

        const blocks = extractTextBlocks(row);
        if (!blocks.length) continue;

        const detectedAt = row.article_date || row.created_at || new Date().toISOString();
        const signalDate = detectedAt.split('T')[0];

        for (const { text, source_type } of blocks) {
          const sentences = splitSentences(text);
          for (const sentence of sentences) {
            try {
              const sig = parseSignal(sentence, { source_type, actor_context: row.name });
              if (!sig) continue;
              stats.sentences_parsed++;

              const cls  = sig.primary_signal || 'unclassified_signal';
              const conf = sig.confidence ?? 0;
              if (cls === 'unclassified_signal') { stats.skipped_unclassified++; continue; }
              if (conf < MIN_CONF)               { stats.skipped_low_conf++;     continue; }

              stats.by_class[cls]   = (stats.by_class[cls]   || 0) + 1;
              const eq = sig.evidence_quality || 'inferred';
              stats.by_evidence[eq] = (stats.by_evidence[eq] || 0) + 1;

              signalBuf.push({
                entity_id:         entityId,
                source:            source_type,
                source_type,
                source_url:        row.article_url || null,
                detected_at:       detectedAt,
                raw_sentence:      sentence,
                signal_object:     sig,
                primary_signal:    cls,
                signal_type:       sig.signal_type      || null,
                signal_strength:   sig.signal_strength  ?? null,
                confidence:        conf,
                evidence_quality:  eq,
                actor_type:        sig.actor            || null,
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
                likely_stage:      sig.inference?.likely_stage || null,
                likely_needs:      sig.inference?.likely_need  || [],
                urgency:           sig.inference?.urgency      || null,
              });

              timelineBuf.push({
                entity_id:      entityId,
                event_date:     signalDate,
                signal_class:   cls,
                signal_type:    sig.signal_type    || null,
                signal_strength: sig.signal_strength ?? null,
                confidence:     conf,
                evidence_quality: eq,
                is_costly_action: sig.costly_action || false,
                summary:        sig._actions?.[0]?.meaning || cls,
                source:         source_type,
                source_type,
                source_url:     row.article_url || null,
              });

            } catch { /* skip bad sentences */ }
          }
        }
      }

      await flushSignals();
      const pct = Math.round(((i + batch.length) / rows.length) * 100);
      process.stdout.write(`\r  Progress: ${i + batch.length}/${rows.length} startups (${pct}%)  `);
    }
    await flushSignals(true);

  } else {
    // ── DRY-RUN: parse and count without writing ──────────────────────────
    for (const row of rows) {
      stats.startups++;
      const blocks = extractTextBlocks(row);
      for (const { text, source_type } of blocks) {
        for (const sentence of splitSentences(text)) {
          try {
            const sig = parseSignal(sentence, { source_type, actor_context: row.name });
            if (!sig) continue;
            stats.sentences_parsed++;
            const cls = sig.primary_signal || 'unclassified_signal';
            if (cls === 'unclassified_signal') { stats.skipped_unclassified++; continue; }
            stats.by_class[cls] = (stats.by_class[cls] || 0) + 1;
          } catch { /* skip */ }
        }
      }
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Startups processed:   ${stats.startups}`);
  console.log(`Entities inserted:    ${DRY_RUN ? '(dry-run)' : stats.entities_inserted}`);
  console.log(`Sentences parsed:     ${stats.sentences_parsed}`);
  console.log(`Signals written:      ${DRY_RUN ? '(dry-run)' : stats.signals_written}`);
  console.log(`Skipped (unclassif.): ${stats.skipped_unclassified}`);
  console.log(`Errors:               ${stats.errors}`);
  console.log('');

  const topClasses = Object.entries(stats.by_class).sort((a,b) => b[1]-a[1]).slice(0, 8);
  if (topClasses.length) {
    console.log('Top signal classes:');
    for (const [cls, cnt] of topClasses) console.log(`  ${String(cnt).padStart(5)}  ${cls}`);
  }

  if (!DRY_RUN && Object.keys(stats.by_evidence).length) {
    console.log('\nEvidence quality:');
    for (const [eq, cnt] of Object.entries(stats.by_evidence).sort((a,b) => b[1]-a[1])) {
      console.log(`  ${String(cnt).padStart(5)}  ${eq}`);
    }
  }

  console.log('\n✅ Discovery ingestion complete. Run compute-trajectories.js next.');
  console.log('═'.repeat(60) + '\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
