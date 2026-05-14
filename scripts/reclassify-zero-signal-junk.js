#!/usr/bin/env node
/**
 * ZERO-SIGNAL JUNK RECLASSIFICATION
 *
 * The needs_url pool is heavily polluted with RSS-scraped text fragments that
 * have no data beyond a name (no pitch, sectors, stage, raise, team, location,
 * or extracted_data).  These will never enrich successfully — there's nothing
 * to look up — and they crowd out real startups.
 *
 * This script:
 *   1. Hard-deletes rows with null/empty names (--delete-nulls flag)
 *   2. [--pre-gate] Scans ALL approved rows (incl. entity_gate=NULL) for name junk ONLY
 *      — run this BEFORE entity-resolution-gate so the logic engine never sees junk names
 *   3. Pages through all approved + needs_url startups
 *   4. Identifies rows with ZERO non-URL data signals
 *   5. Sets entity_gate='junk' (and optionally status='rejected') for them
 *
 * Usage:
 *   node scripts/reclassify-zero-signal-junk.js                           # dry-run: count only
 *   node scripts/reclassify-zero-signal-junk.js --execute                 # set entity_gate='junk'
 *   node scripts/reclassify-zero-signal-junk.js --execute --reject        # also status='rejected'
 *   node scripts/reclassify-zero-signal-junk.js --delete-nulls            # dry-run null audit
 *   node scripts/reclassify-zero-signal-junk.js --delete-nulls --execute  # hard-delete null names
 *   node scripts/reclassify-zero-signal-junk.js --pre-gate --execute      # name-junk pre-filter
 *                                                                           # (run before gate)
 *
 * Five eviction paths:
 *   1. Null names   — name IS NULL or empty string → hard DELETE (not just reclassify)
 *   2. Pre-gate junk — name fails junk filter on unclassified rows (entity_gate IS NULL)
 *   3. Zero-signal  — no pitch/raise/metrics at all → entity_gate='junk'
 *   4. Name-junk    — evaluateStartupNameForPipeline() (logic engine → ontology → entity ontology → legacy safety net)
 *   5. Exhausted    — 3+ enrichment attempts, no URL found, no founder metrics
 *
 * RECOMMENDED PIPELINE ORDER:
 *   node scripts/reclassify-zero-signal-junk.js --pre-gate --execute
 *   node scripts/entity-resolution-gate.js --execute
 *   node scripts/enrich-sparse-startups.js --gate-needs-url-only --limit=400
 *   node scripts/reclassify-zero-signal-junk.js --execute
 *   npx tsx scripts/recalculate-scores.ts
 */

'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { evaluateStartupNameForPipeline } = require('../lib/entityResolutionGate');
const {
  mlLogEnabled,
  insertEntityGateMlEventsBatch,
  buildRowFromSnapshot,
} = require('../lib/nameGateMlLogger');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PAGE = 500;
const BATCH = 200;
const argv = process.argv.slice(2);
const EXECUTE = argv.includes('--execute');
const REJECT = EXECUTE && argv.includes('--reject');
const DELETE_NULLS = argv.includes('--delete-nulls');
const PRE_GATE = argv.includes('--pre-gate');
const DEBUG = argv.includes('--debug');
const DEBUG_LIMIT = 30;

/**
 * A startup passes the signal check ONLY if it has a field that requires a human
 * to have deliberately submitted it. Debug confirmed that sectors, stage, team_size,
 * location, and extracted_data are ALL auto-assigned by the ingestion pipeline to
 * every RSS-scraped entry — "Gaming" appears as a default sector fallback on
 * essentially every junk row. The only reliable submission-origin signals are:
 *   - pitch: a founder has to actually write this
 *   - raise_amount / customer_count / mrr / arr: explicit numeric business data
 */
function hasAtLeastOneSignal(s) {
  if (s.pitch && s.pitch.trim().length > 20) return true;
  if (s.raise_amount) return true;
  if (s.customer_count || s.mrr || s.arr) return true;
  return false;
}

/**
 * A row is "enrichment-exhausted" when:
 *   - enrichment_attempts >= 3 (tried at least 3 times)
 *   - still has no URL (website AND company_website are both empty)
 *   - no real founder-submitted metrics (raise_amount, mrr, arr, customer_count)
 *
 * These rows had pitch/market_signals written by the inference engine itself
 * (not by a founder), which allowed them to bypass the zero-signal check.
 * After 3 enrichment passes with no URL found, they are not startups.
 */
function isEnrichmentExhausted(s) {
  if ((s.enrichment_attempts || 0) < 3) return false;
  const hasUrl = s.website || s.company_website;
  if (hasUrl) return false;
  // Allow hard numeric metrics even if no URL (founder may have entered them)
  if (s.raise_amount || s.customer_count || s.mrr || s.arr) return false;
  return true;
}

async function patchIds(ids, payload) {
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error } = await supabase
      .from('startup_uploads')
      .update(payload)
      .in('id', chunk);
    if (error) throw error;
  }
}

/**
 * Hard-delete rows whose name IS NULL or empty string.
 * These rows are unrecoverable — they have no identity and cannot be enriched.
 * Cascades to related tables (matches, score_history, social_signals).
 */
async function deleteNullNameRows(execute) {
  console.log('\n=== NULL-NAME DELETION ===\n');

  // Query null and empty-string names in the needs_url pool
  const { data: nullRows, error } = await supabase
    .from('startup_uploads')
    .select('id, name')
    .eq('status', 'approved')
    .eq('entity_gate', 'needs_url')
    .or('name.is.null,name.eq.');

  if (error) throw error;

  const ids = (nullRows || []).map(r => r.id);
  console.log(`Null/empty-name rows found: ${ids.length}`);
  if (ids.length === 0) {
    console.log('Nothing to delete.\n');
    return;
  }

  // Also sample nearby-null: single char or whitespace-only
  const { data: blankRows, error: blankErr } = await supabase
    .from('startup_uploads')
    .select('id, name')
    .eq('status', 'approved')
    .eq('entity_gate', 'needs_url');

  if (!blankErr && blankRows) {
    const extraBlanks = blankRows
      .filter(r => !ids.includes(r.id) && r.name !== null && r.name.trim().length <= 1)
      .map(r => r.id);
    if (extraBlanks.length > 0) {
      ids.push(...extraBlanks);
      console.log(`+ ${extraBlanks.length} whitespace/single-char name rows`);
    }
  }

  console.log(`Total to delete: ${ids.length}`);

  if (!execute) {
    console.log('(Dry run — pass --execute to hard-delete these rows)\n');
    return;
  }

  // Cascade-delete related records first
  for (const table of ['startup_investor_matches', 'score_history', 'match_gen_logs', 'social_signals']) {
    const { error: relErr } = await supabase.from(table).delete().in('startup_id', ids);
    if (relErr && relErr.code !== '42P01') {
      console.warn(`  Warning: could not clean ${table}: ${relErr.message}`);
    } else {
      console.log(`  Removed related rows from ${table}`);
    }
  }

  // Hard-delete the startup rows
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error: delErr } = await supabase
      .from('startup_uploads')
      .delete()
      .in('id', chunk);
    if (delErr) throw delErr;
  }
  console.log(`\nDeleted ${ids.length} null/empty-name rows from startup_uploads.\n`);
}

/**
 * PRE-GATE NAME JUNK FILTER
 *
 * Scans ALL approved rows regardless of entity_gate value (including NULL).
 * Applies ONLY evaluateStartupNameForPipeline (logic engine first, then ontology
 * layers, then legacy safety net) — no zero-signal or exhaustion logic.
 *
 * Purpose: remove junk names from the pool BEFORE entity-resolution-gate runs
 * so downstream steps only see names that pass the same SSOT as classifyStartup().
 *
 * Run with: node scripts/reclassify-zero-signal-junk.js --pre-gate --execute
 */
async function runPreGate() {
  console.log('=== PRE-GATE NAME JUNK FILTER ===');
  console.log('  Scope: ALL approved rows (entity_gate IS NULL OR any value)\n');
  if (!EXECUTE) console.log('  DRY RUN — pass --execute to apply changes\n');

  let page = 0;
  let totalScanned = 0;
  const junkIds = [];

  while (true) {
    const from = page * PAGE;
    // Scan everything except rows already marked junk — no point re-checking those
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, entity_gate')
      .eq('status', 'approved')
      .neq('entity_gate', 'junk')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const mlBatch = [];
    for (const s of data) {
      totalScanned++;
      const nameJunk =
        !s.name || s.name.trim().length === 0 ||
        !evaluateStartupNameForPipeline(s.name).ok;

      if (nameJunk) junkIds.push(s.id);

      if (mlLogEnabled()) {
        mlBatch.push(
          buildRowFromSnapshot({
            startup_id: s.id,
            name: s.name,
            event_source: 'pre_gate',
            entity_gate: s.entity_gate,
            bucket: nameJunk ? 'pre_gate_mark' : null,
            training_label: nameJunk ? 'junk' : 'clean',
            meta: { execute: EXECUTE },
          }),
        );
      }
    }
    if (mlBatch.length) {
      try {
        await insertEntityGateMlEventsBatch(supabase, mlBatch);
      } catch (e) {
        console.warn('  ⚠️  ML log batch failed (table missing or RLS?):', e.message);
      }
    }

    console.log(`  Scanned page ${page + 1} (${data.length} rows) — name-junk found: ${junkIds.length} so far`);
    if (data.length < PAGE) break;
    page++;
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`Total scanned:    ${totalScanned}`);
  console.log(`Name-junk found:  ${junkIds.length}`);
  console.log(`Will remain:      ${totalScanned - junkIds.length}`);
  console.log('─────────────────────────────────────────\n');

  if (!EXECUTE) {
    console.log('Pass --execute to write entity_gate=junk for these rows.\n');
    return;
  }

  if (junkIds.length === 0) {
    console.log('Nothing to update.\n');
    return;
  }

  console.log(`Writing entity_gate=junk for ${junkIds.length} rows...`);
  await patchIds(junkIds, { entity_gate: 'junk' });
  console.log(`Done. ${junkIds.length} rows pre-filtered as junk.\n`);
  console.log('Next: node scripts/entity-resolution-gate.js --execute\n');
}

async function run() {
  console.log('=== ZERO-SIGNAL JUNK RECLASSIFICATION ===\n');
  if (!EXECUTE) console.log('DRY RUN — pass --execute to apply changes\n');
  if (REJECT) console.log('REJECT mode — junk rows will also be set to status=rejected\n');
  if (DEBUG) console.log(`DEBUG mode — will print signal fields for first ${DEBUG_LIMIT} rows that look like junk names\n`);

  // Step 0: hard-delete null/empty-name rows first
  if (DELETE_NULLS) {
    await deleteNullNameRows(EXECUTE);
    if (!EXECUTE) {
      console.log('Add --execute to the --delete-nulls run to actually delete.\n');
    }
  }

  let page = 0;
  let totalScanned = 0;
  let zeroSignalIds = [];
  let nameJunkIds = [];
  let exhaustedIds = [];
  let debugPrinted = 0;

  while (true) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, pitch, sectors, stage, raise_amount, customer_count, mrr, arr, team_size, location, extracted_data, website, company_website, enrichment_attempts, entity_gate')
      .eq('status', 'approved')
      .eq('entity_gate', 'needs_url')
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const mlJunkBatch = [];
    for (const s of data) {
      totalScanned++;
      const noSignal = !hasAtLeastOneSignal(s);
      // Name classifier — same order as entity-resolution gate (logic engine first)
      const nameJunk = !evaluateStartupNameForPipeline(s.name).ok;

      // Debug: show what signals and classifier reason exist on junky-looking rows
      if (DEBUG && debugPrinted < DEBUG_LIMIT) {
        const nameWords = s.name?.trim().split(/\s+/).length || 0;
        const looksJunky = nameWords >= 3 || /[A-Z]{2,}/.test(s.name) || /\d/.test(s.name);
        if (looksJunky) {
          debugPrinted++;
          const signals = {
            pitch: s.pitch ? `"${String(s.pitch).slice(0, 40)}..."` : null,
            sectors: Array.isArray(s.sectors) && s.sectors.length ? s.sectors : null,
            stage: s.stage || null,
            raise_amount: s.raise_amount || null,
            customer_count: s.customer_count || null,
            mrr: s.mrr || null,
            arr: s.arr || null,
            team_size: s.team_size || null,
            extracted_data_keys: s.extracted_data ? Object.keys(s.extracted_data) : null,
          };
          const populated = Object.entries(signals).filter(([, v]) => v !== null).map(([k]) => k);
          const ev = evaluateStartupNameForPipeline(s.name);
          const classifierReason = !ev.ok
            ? ev.reason
            : (noSignal ? 'zero-signal' : 'pass');
          console.log(`  [${debugPrinted}] "${s.name}" → ${classifierReason} | signals: [${populated.join(', ') || 'NONE'}]`);
          if (populated.includes('sectors')) console.log(`       sectors value: ${JSON.stringify(s.sectors)}`);
          if (populated.includes('extracted_data_keys')) console.log(`       extracted_data keys: ${JSON.stringify(signals.extracted_data_keys)}`);
        }
      }

      const exhausted = isEnrichmentExhausted(s);

      if (nameJunk) {
        nameJunkIds.push(s.id);
        if (mlLogEnabled()) {
          mlJunkBatch.push(
            buildRowFromSnapshot({
              startup_id: s.id,
              name: s.name,
              event_source: 'reclassify_needs_url',
              entity_gate: s.entity_gate,
              bucket: 'name_junk',
              training_label: 'junk',
              meta: { execute: EXECUTE },
            }),
          );
        }
      } else if (noSignal) {
        zeroSignalIds.push(s.id);
        if (mlLogEnabled()) {
          mlJunkBatch.push(
            buildRowFromSnapshot({
              startup_id: s.id,
              name: s.name,
              event_source: 'reclassify_needs_url',
              entity_gate: s.entity_gate,
              bucket: 'zero_signal',
              training_label: 'junk',
              meta: { execute: EXECUTE },
            }),
          );
        }
      } else if (exhausted) {
        exhaustedIds.push(s.id);
        if (mlLogEnabled()) {
          mlJunkBatch.push(
            buildRowFromSnapshot({
              startup_id: s.id,
              name: s.name,
              event_source: 'reclassify_needs_url',
              entity_gate: s.entity_gate,
              bucket: 'exhausted',
              training_label: 'junk',
              meta: { execute: EXECUTE },
            }),
          );
        }
      }
    }

    if (mlJunkBatch.length) {
      try {
        await insertEntityGateMlEventsBatch(supabase, mlJunkBatch);
      } catch (e) {
        console.warn('  ⚠️  ML log batch failed:', e.message);
      }
    }

    if (!DEBUG) console.log(`  Scanned page ${page + 1} (${data.length} rows) — zero-signal: ${zeroSignalIds.length}, exhausted: ${exhaustedIds.length}, name-junk: ${nameJunkIds.length} so far`);
    if (data.length < PAGE) break;
    page++;
  }

  const allJunkIds = [...new Set([...zeroSignalIds, ...nameJunkIds, ...exhaustedIds])];

  console.log('\n─────────────────────────────────────────');
  console.log(`Total scanned:    ${totalScanned}`);
  console.log(`Zero-signal rows: ${zeroSignalIds.length}  (name only — no pitch/sectors/stage/location)`);
  console.log(`Name-junk rows:   ${nameJunkIds.length}  (failed isGarbage or ontologyJunkReason)`);
  console.log(`Exhausted rows:   ${exhaustedIds.length}  (3+ enrichment attempts, no URL, no metrics)`);
  console.log(`Combined junk:    ${allJunkIds.length}`);
  console.log(`Will remain:      ${totalScanned - allJunkIds.length}`);
  console.log('─────────────────────────────────────────\n');

  if (!EXECUTE) {
    console.log('Pass --execute to write entity_gate=junk for these rows.');
    console.log('Pass --execute --reject to also set status=rejected (removes them entirely from all queues).\n');
    return;
  }

  if (allJunkIds.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  const payload = REJECT
    ? { entity_gate: 'junk', status: 'rejected' }
    : { entity_gate: 'junk' };

  console.log(`Writing entity_gate=junk${REJECT ? ' + status=rejected' : ''} for ${allJunkIds.length} rows...`);
  await patchIds(allJunkIds, payload);

  console.log(`\nDone. ${allJunkIds.length} rows reclassified as junk.`);
  console.log('Run [node scripts/entity-resolution-gate.js] to verify updated counts.\n');
}

(PRE_GATE ? runPreGate() : run()).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
