#!/usr/bin/env node
/**
 * ENTITY RESOLUTION GATE — STEP 2 in the pipeline (after pre-gate junk filter).
 *
 * classifyStartup() order (see lib/entityResolutionGate.js):
 *   1) Logic engine (structural template: startup vs investor vs headline vs descriptor)
 *   2) Ontology + inference (pendingNameOntology / parseSignal)
 *   3) Entity ontology (nameEntityOntology — geo/person/brand)
 *   4) Legacy safety net (cleanup-garbage patterns + isValidStartupName)
 *   → then URL gate: needs_url | qualified
 *
 * Outcomes:
 *   - junk: failed (1)–(4) or investor-track in startup table
 *   - needs_url: passed (1)–(4) as startup-like but no website
 *   - qualified: passed + URL present
 *
 * Optional pre-pass: reclassify-zero-signal-junk --pre-gate marks obvious junk;
 * gate skips rows already entity_gate=junk.
 *
 * Usage:
 *   node scripts/entity-resolution-gate.js                 # dry-run counts
 *   node scripts/entity-resolution-gate.js --execute       # write entity_gate* columns
 *   node scripts/entity-resolution-gate.js --execute --startups-only
 *   node scripts/entity-resolution-gate.js --execute --investors-only
 *
 * RECOMMENDED PIPELINE ORDER:
 *   1. node scripts/reclassify-zero-signal-junk.js --pre-gate --execute
 *   2. node scripts/entity-resolution-gate.js --execute            ← this script
 *   3. node scripts/enrich-sparse-startups.js --gate-needs-url-only --limit=400
 *   4. node scripts/reclassify-zero-signal-junk.js --execute
 *   5. npx tsx scripts/recalculate-scores.ts
 */

'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { classifyStartup, classifyInvestor } = require('../lib/entityResolutionGate');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PAGE = 500;
const BATCH = 150;

/** Supabase / Node fetch often fails transiently (ETIMEDOUT, ECONNRESET). */
function isTransientNetworkError(err) {
  if (!err) return false;
  const parts = [];
  let e = err;
  for (let i = 0; i < 6 && e; i++) {
    parts.push(e.message || '', e.details || '', String(e.code || ''));
    e = e.cause;
  }
  const s = parts.join(' ');
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|fetch failed|socket hang up|NetworkError/i.test(s);
}

async function withNetworkRetry(label, fn, { maxAttempts = 6 } = {}) {
  let last;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isTransientNetworkError(e) || attempt === maxAttempts) throw e;
      const ms = Math.min(400 * 2 ** (attempt - 1), 12000);
      console.warn(`  ⚠️ ${label}: transient error (${e.message || e}) — attempt ${attempt}/${maxAttempts}, next in ${ms}ms`);
      await new Promise((r) => setTimeout(r, ms));
    }
  }
  throw last;
}

async function supabaseResult(label, runQuery) {
  return withNetworkRetry(label, async () => {
    const result = await runQuery();
    const err = result.error;
    if (err) {
      if (isTransientNetworkError(err)) {
        const e = new Error(err.message || 'Supabase error');
        e.details = err.details;
        throw e;
      }
      throw err;
    }
    return result;
  });
}

const argv = process.argv.slice(2);
const EXECUTE = argv.includes('--execute');
const STARTUPS_ONLY = argv.includes('--startups-only');
const INVESTORS_ONLY = argv.includes('--investors-only');

async function patchIds(table, ids, payload) {
  let n = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    await supabaseResult(`${table} update (${chunk.length} ids)`, () =>
      supabase.from(table).update(payload).in('id', chunk),
    );
    n += chunk.length;
  }
  return n;
}

function bucketByClassification(rows, classifyFn) {
  /** @type {Map<string, string[]>} */
  const m = new Map();
  for (const row of rows) {
    const { gate, reason } = classifyFn(row);
    const key = JSON.stringify({ gate, reason: reason || null });
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(row.id);
  }
  return m;
}

async function gateStartups() {
  const counts = { junk: 0, needs_url: 0, qualified: 0 };
  let updated = 0;
  let skipped = 0;
  let from = 0;
  const now = new Date().toISOString();

  for (;;) {
    const { data } = await supabaseResult(`startup_uploads page @${from}`, () =>
      supabase
        .from('startup_uploads')
        .select('id, name, website, company_website, entity_gate')
        .eq('status', 'approved')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1),
    );
    if (!data || data.length === 0) break;

    for (const row of data) {
      const { gate } = classifyStartup(row);
      counts[gate] += 1;
    }

    if (EXECUTE) {
      // Skip rows already manually reclassified as junk by reclassify-zero-signal-junk.js.
      // Those rows were junk because they had no pitch/metrics — the name-only gate would
      // reassign them to needs_url (they have valid-looking names), which would undo the cleanup.
      const nonJunkRows = data.filter(r => r.entity_gate !== 'junk' || classifyStartup(r).gate === 'junk');
      skipped += data.length - nonJunkRows.length;

      const buckets = bucketByClassification(nonJunkRows, classifyStartup);
      for (const [key, ids] of buckets) {
        const { gate, reason } = JSON.parse(key);
        updated += await patchIds('startup_uploads', ids, {
          entity_gate: gate,
          entity_gate_reason: reason,
          entity_gate_at: now,
        });
      }
    }

    from += PAGE;
    if (data.length < PAGE) break;
  }

  if (EXECUTE && skipped > 0) {
      console.log(`  ℹ️  Skipped ${skipped} rows already marked junk by pre-gate filter (name junk / zero-signal).`);
  }
  return { ...counts, updated: EXECUTE ? updated : 0 };
}

async function gateInvestors() {
  const counts = { junk: 0, needs_url: 0, qualified: 0 };
  let updated = 0;
  let from = 0;
  const now = new Date().toISOString();

  for (;;) {
    const { data } = await supabaseResult(`investors page @${from}`, () =>
      supabase
        .from('investors')
        .select('id, name, linkedin_url, crunchbase_url, blog_url, twitter_url')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1),
    );
    if (!data || data.length === 0) break;

    for (const row of data) {
      counts[classifyInvestor(row).gate] += 1;
    }

    if (EXECUTE) {
      const buckets = bucketByClassification(data, classifyInvestor);
      for (const [key, ids] of buckets) {
        const { gate, reason } = JSON.parse(key);
        updated += await patchIds('investors', ids, {
          entity_gate: gate,
          entity_gate_reason: reason,
          entity_gate_at: now,
        });
      }
    }

    from += PAGE;
    if (data.length < PAGE) break;
  }

  return { ...counts, updated: EXECUTE ? updated : 0 };
}

async function main() {
  console.log('\n🧭 ENTITY RESOLUTION GATE');
  console.log('═'.repeat(56));
  console.log(`  Mode: ${EXECUTE ? 'EXECUTE (writes entity_gate*)' : 'DRY RUN (counts only)'}`);
  console.log(`  Scope: ${INVESTORS_ONLY ? 'investors only' : STARTUPS_ONLY ? 'startups only' : 'startups + investors'}\n`);

  if (!INVESTORS_ONLY) {
    const su = await gateStartups();
    console.log('  Startups (approved)');
    console.log(`    junk: ${su.junk} | needs_url: ${su.needs_url} | qualified: ${su.qualified}`);
    if (EXECUTE) console.log(`    rows updated: ${su.updated}`);
  }

  if (!STARTUPS_ONLY) {
    const inv = await gateInvestors();
    console.log('  Investors (all rows)');
    console.log(`    junk: ${inv.junk} | needs_url: ${inv.needs_url} | qualified: ${inv.qualified}`);
    if (EXECUTE) console.log(`    rows updated: ${inv.updated}`);
  }

  if (!EXECUTE) {
    console.log('\n  💡 Run with --execute after applying migration 20260410150000_entity_resolution_gate.sql');
  } else {
    console.log(
      '\n  ✅ Gate complete. Recommended RSS: RSS_ENRICH_GATE_EXCLUDE_JUNK_ONLY=1 in .env (or --gate-exclude-junk). Strict pool only: RSS_ENRICH_GATE_QUALIFIED_ONLY=1',
    );
  }
  console.log('═'.repeat(56) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
