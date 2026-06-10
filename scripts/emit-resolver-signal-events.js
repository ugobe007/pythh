#!/usr/bin/env node
/**
 * EMIT RESOLVER SIGNAL EVENTS
 * ===========================
 * Bridges the Event Resolver's investor/funding findings into the signal
 * pipeline. For startup_uploads where the resolver linked investors
 * (extracted_data.investors) but the company has NO fundraising signal event yet,
 * emit one `fundraising_signal` pythh_signal_events row. sync-signal-scores.js
 * then aggregates it into startup_signal_scores (lifting investor_receptivity +
 * capital_convergence and expanding signal coverage).
 *
 * Safety / anti-inflation:
 *   - Skips any entity that ALREADY has a fundraising_signal event (no double count).
 *   - Skips uploads with no pythh_entity (does not create entities).
 *   - Idempotent: stamps extracted_data.signal_emitted_at; re-runs skip stamped rows.
 *   - Dry-run by default — prints what it would write. --apply to commit.
 *
 * Usage:
 *   node scripts/emit-resolver-signal-events.js                 # DRY RUN
 *   node scripts/emit-resolver-signal-events.js --apply
 *   node scripts/emit-resolver-signal-events.js --apply --limit 2000
 */
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { buildSignalEvent } = require('../lib/signalEventBuilder');
const { isValidStartupName } = require('../lib/startupNameValidator');

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Company is really a fund/VC if its name basically equals (or is contained by) an investor name.
function companyIsInvestor(name, investors) {
  const n = norm(name);
  if (!n) return true;
  return investors.some((inv) => { const i = norm(inv); return i && (i === n || i.includes(n) || n.includes(i)); });
}

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APPLY = has('--apply');
const FORCE = has('--force');
const REQUIRE_WEBSITE = has('--require-website'); // stricter "real company" cut
const LIMIT = parseInt(val('--limit', '100000'), 10);
const SOURCE_TYPE = 'llm_enrichment'; // honest provenance: resolver is LLM-derived from RSS

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase credentials'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TOP = ['yc', 'y combinator', 'sequoia', 'a16z', 'andreessen', 'founders fund'];

async function pageAll(table, cols, build) {
  const out = []; let off = 0; const P = 1000;
  while (true) {
    let q = supabase.from(table).select(cols).order(table === 'startup_uploads' ? 'id' : 'entity_id', { ascending: true }).range(off, off + P - 1);
    if (build) q = build(q);
    const { data, error } = await q;
    if (error) { console.error(`  page error (${table}): ${error.message}`); break; }
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < P) break;
    off += P;
  }
  return out;
}

(async () => {
  console.log('═'.repeat(70));
  console.log('  EMIT RESOLVER SIGNAL EVENTS   ' + (APPLY ? 'APPLY' : 'DRY-RUN') + (REQUIRE_WEBSITE ? '  [require-website]' : ''));
  console.log('═'.repeat(70));

  // 1. Entity map: startup_upload_id -> entity_id
  console.log('\n  loading pythh_entities…');
  const entRows = await pageAllEntities();
  const entityByUpload = new Map();
  for (const e of entRows) if (e.startup_upload_id) entityByUpload.set(e.startup_upload_id, e.id);
  console.log(`  entities with startup_upload_id: ${entityByUpload.size}`);

  // 2. Entities that already have a fundraising_signal (dedup / anti-inflation)
  console.log('  loading existing fundraising_signal entities…');
  const fr = await pageAll('pythh_signal_events', 'entity_id', (q) => q.eq('primary_signal', 'fundraising_signal'));
  const hasFundraising = new Set(fr.map((r) => r.entity_id));
  console.log(`  entities already carrying a fundraising_signal: ${hasFundraising.size}`);

  // 3. Cohort: uploads with resolver-linked investors
  console.log('  loading uploads with linked investors…');
  const cohort = await pageAll('startup_uploads', 'id, name, website, created_at, latest_funding_amount, extracted_data',
    (q) => q.not('extracted_data->investors', 'is', null));
  console.log(`  uploads with extracted_data.investors: ${cohort.length}\n`);

  const stats = { eligible: 0, no_entity: 0, already_signaled: 0, no_investors: 0, already_emitted: 0, bad_name: 0, is_investor: 0, inserted: 0, errors: 0 };
  const toInsert = [];
  const stampIds = [];

  for (const row of cohort) {
    if (stats.eligible >= LIMIT) break;
    const ed = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};
    if (!FORCE && ed.signal_emitted_at) { stats.already_emitted += 1; continue; }
    const investors = Array.isArray(ed.investors) ? ed.investors.filter(Boolean) : [];
    if (!investors.length) { stats.no_investors += 1; continue; }
    if (!row.name || !isValidStartupName(row.name).isValid) { stats.bad_name += 1; continue; }
    if (companyIsInvestor(row.name, investors)) { stats.is_investor += 1; continue; }
    if (REQUIRE_WEBSITE && !row.website) { stats.no_website = (stats.no_website || 0) + 1; continue; }
    const entityId = entityByUpload.get(row.id);
    if (!entityId) { stats.no_entity += 1; continue; }
    if (hasFundraising.has(entityId)) { stats.already_signaled += 1; continue; }

    stats.eligible += 1;
    if (row.website) stats.eligible_with_site = (stats.eligible_with_site || 0) + 1;
    const fundingAmt = Number(row.latest_funding_amount) || Number(ed.funding_amount) || null;
    const hasTop = investors.some((n) => TOP.some((t) => String(n).toLowerCase().includes(t)));
    const strength = hasTop || fundingAmt ? 0.8 : 0.6;
    const confidence = 0.65;
    const detectedAt = row.created_at || new Date().toISOString();

    const sig = {
      primary_signal: 'fundraising_signal',
      signal_type: 'investment',
      signal_strength: strength,
      confidence,
      evidence_quality: 'inferred',
      raw_text: `${row.name} backed by ${investors.join(', ')}${fundingAmt ? ` (~$${fundingAmt})` : ''}`,
      inference: { likely_stage: null, likely_need: [], urgency: null },
    };
    const event = buildSignalEvent(sig, {
      entityId,
      rawSentence: sig.raw_text,
      sourceType: SOURCE_TYPE,
      source: 'event-resolver',
      sourceUrl: row.website || null,
      detectedAt,
    });
    if (!event) { stats.errors += 1; continue; }
    toInsert.push(event);
    stampIds.push({ id: row.id, ed });

    if (stats.eligible <= 8) {
      console.log(`  + ${row.name}  →  ${investors.join(', ')}  [str ${strength}${hasTop ? ', top' : ''}]`);
    }
  }

  console.log('\n  ' + '─'.repeat(60));
  console.log(`  cohort (linked investors):     ${cohort.length}`);
  console.log(`  already emitted (stamped):     ${stats.already_emitted}`);
  console.log(`  skipped — no investors:        ${stats.no_investors}`);
  console.log(`  skipped — junk/invalid name:   ${stats.bad_name}`);
  console.log(`  skipped — company is a fund:   ${stats.is_investor}`);
  console.log(`  skipped — no pythh_entity:     ${stats.no_entity}`);
  console.log(`  skipped — already has signal:  ${stats.already_signaled}`);
  console.log(`  ELIGIBLE to emit:              ${stats.eligible}`);
  console.log(`    └─ of which have a website:  ${stats.eligible_with_site || 0}  (stricter "real company" cut)`);
  console.log('  ' + '─'.repeat(60));

  if (!APPLY) {
    console.log('\n  DRY RUN — no writes. Re-run with --apply to emit events.\n');
    return;
  }

  // 4. Insert events in batches, then stamp the uploads.
  const B = 200;
  for (let i = 0; i < toInsert.length; i += B) {
    const batch = toInsert.slice(i, i + B);
    const { error } = await supabase.from('pythh_signal_events').insert(batch);
    if (error) { stats.errors += batch.length; console.log(`  insert error @${i}: ${error.message}`); continue; }
    stats.inserted += batch.length;
    const stamps = stampIds.slice(i, i + B);
    await Promise.all(stamps.map(({ id, ed }) =>
      supabase.from('startup_uploads').update({ extracted_data: { ...ed, signal_emitted_at: new Date().toISOString() } }).eq('id', id)
    ));
    console.log(`  inserted ${stats.inserted}/${toInsert.length}`);
  }

  console.log(`\n  ✅ emitted ${stats.inserted} fundraising_signal events  (errors: ${stats.errors})`);
  console.log('  Next: sync-signal-scores.js --apply will aggregate them into startup_signal_scores.\n');
})();

async function pageAllEntities() {
  const out = []; let off = 0; const P = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('pythh_entities').select('id, startup_upload_id')
      .not('startup_upload_id', 'is', null)
      .order('id', { ascending: true }).range(off, off + P - 1);
    if (error) { console.error(`  entity page error: ${error.message}`); break; }
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < P) break;
    off += P;
  }
  return out;
}
