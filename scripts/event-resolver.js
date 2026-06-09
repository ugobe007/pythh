#!/usr/bin/env node
/**
 * EVENT RESOLVER — independent batch runner
 * =========================================
 * Second pass over startup_events that recovers startups the scraper's frame
 * parser missed or mis-extracted (wrong subject, empty entities, no URL, no
 * investor association). Fully decoupled from the scraper: reads startup_events,
 * runs an LLM re-extraction + heuristic URL lookup + investor resolution, and
 * stages results into discovered_startups (the existing safe import path).
 * Idempotency is tracked in the resolved_events table.
 *
 * Usage:
 *   node scripts/event-resolver.js                 # DRY RUN (no writes)
 *   node scripts/event-resolver.js --apply         # stage into discovered_startups
 *   node scripts/event-resolver.js --apply --hours 72 --limit 200
 *   node scripts/event-resolver.js --apply --no-urls        # skip website lookup
 *   node scripts/event-resolver.js --id <event_id>          # single event
 *   node scripts/event-resolver.js --model gpt-4o           # override model
 *
 * Flags:
 *   --apply        Actually write (default is dry-run preview)
 *   --hours N      Lookback window in hours (default 48)
 *   --limit N      Max events to resolve this run (default 150)
 *   --model M      OpenAI model (default gpt-4o-mini)
 *   --no-urls      Skip heuristic website lookup (faster)
 *   --min-conf X   Min extraction confidence to create (default 0.55)
 *   --force        Re-process events already in resolved_events
 *   --id ID        Process a single event id (implies no idempotency skip)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const resolver = require('../server/lib/eventResolver');
const gate = require('../lib/startupInsertGate');
const { isValidStartupName } = require('../lib/startupNameValidator');
const InferenceExtractor = require('../lib/inference-extractor');

let inferDomainFromName = null;
try {
  ({ inferDomainFromName } = require('../server/services/inferenceService.js'));
} catch (e) {
  console.log(`⚠️  inferenceService unavailable (${e.message}) — URL lookup disabled`);
}

/* ---------------- args ---------------- */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const APPLY = has('--apply');
const FORCE = has('--force');
const NO_URLS = has('--no-urls');
const NO_VERIFY = has('--no-verify');
const HOURS = parseInt(val('--hours', '48'), 10);
const LIMIT = parseInt(val('--limit', '150'), 10);
const MODEL = val('--model', 'gpt-4o-mini');
const MIN_CONF = parseFloat(val('--min-conf', '0.55'));
const SINGLE_ID = val('--id', null);
const SOURCE = val('--source', 'events'); // events | discovered | uploads
const CONCURRENCY = Math.max(1, parseInt(val('--concurrency', '1'), 10) || 1);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}
if (!OPENAI_KEY || OPENAI_KEY.includes('your') || OPENAI_KEY.length < 20) {
  console.error('❌ Missing/invalid OPENAI_API_KEY — resolver requires the LLM');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_KEY });
gate.setSupabase(supabase);

const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

/* ---------------- candidate selection ---------------- */
async function fetchCandidates() {
  if (SINGLE_ID) {
    const { data } = await supabase.from('startup_events').select('*').eq('id', SINGLE_ID).maybeSingle();
    return data ? [data] : [];
  }

  const TYPES = [...resolver.STARTUP_EVENT_TYPES, 'OTHER'];
  const candidates = [];
  const seen = new Set();
  const PAGE = 500;
  let offset = 0;

  // Pull recent events, filter to ones that need resolution, until LIMIT collected.
  while (candidates.length < LIMIT && offset < 6000) {
    const { data, error } = await supabase
      .from('startup_events')
      .select('id, event_id, event_type, frame_type, subject, object, verb, entities, amounts, round, source_title, source_url, source_publisher, semantic_context, created_at')
      .in('event_type', TYPES)
      .gte('created_at', ago(HOURS))
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error('❌ fetch error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const ev of data) {
      const key = ev.id || ev.event_id;
      if (seen.has(key)) continue;
      seen.add(key);
      if (resolver.needsResolution(ev)) candidates.push(ev);
      if (candidates.length >= LIMIT) break;
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  if (FORCE || SINGLE_ID) return candidates.slice(0, LIMIT);

  // Idempotency: drop events already in resolved_events.
  const ids = candidates.map((c) => String(c.id || c.event_id));
  const done = new Set();
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const { data } = await supabase.from('resolved_events').select('event_id').in('event_id', chunk);
    (data || []).forEach((r) => done.add(r.event_id));
  }
  return candidates.filter((c) => !done.has(String(c.id || c.event_id)));
}

/**
 * A — In-place reconciliation: if the hardcoded scraper already created a
 * startup_uploads row for THIS event (via discovery_event_id), supersede it with
 * the LLM result instead of staging a parallel discovered_startups row.
 * Returns null if no existing row (caller proceeds with normal staging),
 * else { outcome, id }.
 */
async function reconcileExistingUpload(event, result) {
  const eventId = event.id || event.event_id;
  if (!eventId) return null;
  const { data: existing } = await supabase
    .from('startup_uploads')
    .select('id, name, website, sectors, entity_gate, extracted_data, lead_investor, latest_funding_amount')
    .eq('discovery_event_id', eventId)
    .maybeSingle();
  if (!existing) return null;

  // Resolver verdict: this event is not a startup -> gate the existing row.
  if (result.action === 'skip_not_startup') {
    if (!APPLY) return { outcome: 'reconcile_gate', id: existing.id };
    await supabase
      .from('startup_uploads')
      .update({ entity_gate: 'junk', entity_gate_reason: `resolver: ${result.reason}`.slice(0, 300), entity_gate_at: new Date().toISOString() })
      .eq('id', existing.id);
    return { outcome: 'reconcile_gate', id: existing.id };
  }

  if (result.action !== 'create') return { outcome: 'reconcile_noop', id: existing.id };

  // Build a guarded patch: fix the name only if the existing one is junk; fill
  // website/sectors/investors/funding only when missing; never clobber good data.
  const ex = result.extraction;
  const rec = result.record;
  const patch = {};
  const ed = existing.extracted_data && typeof existing.extracted_data === 'object' ? existing.extracted_data : {};
  patch.extracted_data = { ...ed, resolver: rec.metadata.resolver };
  // Feed the scorer (extracted.investors -> backed_by social-proof signal) only
  // when the row doesn't already carry investors. Credit only table-linked
  // investors (investor_id) using canonical matched names; skip unverified mentions.
  const reconInvestorNames = (result.investors || [])
    .filter((i) => i.investor_id)
    .map((i) => i.matched_name || i.name)
    .filter(Boolean);
  if (reconInvestorNames.length && (!Array.isArray(ed.investors) || ed.investors.length === 0)) {
    patch.extracted_data.investors = reconInvestorNames;
  }

  const nameBad =
    !existing.name ||
    !isValidStartupName(existing.name).isValid ||
    resolver.JUNK_SUBJECTS.has(String(existing.name).toLowerCase());
  if (nameBad && ex.startupName && ex.startupName.toLowerCase() !== String(existing.name || '').toLowerCase()) {
    patch.name = ex.startupName;
  }
  if (!existing.website && rec.website) patch.website = rec.website;
  if ((!existing.sectors || existing.sectors.length === 0) && rec.sectors) patch.sectors = rec.sectors;
  if (!existing.lead_investor && rec.lead_investor) patch.lead_investor = rec.lead_investor;
  if (!existing.latest_funding_amount && ex.fundingAmountUsd) patch.latest_funding_amount = ex.fundingAmountUsd;

  if (!APPLY) return { outcome: patch.name ? 'reconcile_rename' : 'reconcile_fill', id: existing.id };

  let { error } = await supabase.from('startup_uploads').update(patch).eq('id', existing.id);
  if (error && (error.code === '23505' || /unique/i.test(error.message)) && patch.name) {
    // Name collision with an existing row — keep old name, apply the rest.
    delete patch.name;
    ({ error } = await supabase.from('startup_uploads').update(patch).eq('id', existing.id));
  }
  if (error) return { outcome: 'reconcile_error', id: existing.id, error: error.message };
  return { outcome: patch.name ? 'reconcile_rename' : 'reconcile_fill', id: existing.id };
}

async function markResolved(event, result) {
  if (!APPLY) return;
  const ev = String(event.id || event.event_id);
  const rec = {
    event_id: ev,
    outcome: result.action,
    startup_name: result.extraction?.startupName || null,
    website: result.record?.website || null,
    discovered_id: result.discoveredId || null,
    confidence: result.extraction?.confidence ?? null,
    reason: result.reason || null,
    resolver_version: resolver.RESOLVER_VERSION,
    resolved_at: new Date().toISOString(),
  };
  await supabase.from('resolved_events').upsert(rec, { onConflict: 'event_id' });
}

/* ---------------- B: known-company enrichment (uploads / discovered) ----------------
 * For rows where the company is ALREADY known (created by the hardcoded pipeline)
 * but missing a website / investor links. Cheap: verified URL lookup + investor
 * resolution, NO LLM call (so it doesn't overlap the Sage logic pass or run up cost).
 * Idempotent via a `*_enriched_at` stamp.
 */
async function enrichKnownCompany({ name, text, hasWebsite, hasLeadInvestor }) {
  const patch = { website: null, lead_investor: null, investors: [], investorNames: [] };
  if (!hasWebsite && !NO_URLS) {
    patch.website = await resolver.resolveWebsite(name, { inferDomainFromName, verifyUrls: !NO_VERIFY });
  }
  try {
    const f = InferenceExtractor.extractFunding(text || '') || {};
    patch.investorNames = Array.isArray(f.investors_mentioned) ? f.investors_mentioned.slice(0, 12) : [];
    if (!hasLeadInvestor && f.lead_investor) patch.lead_investor = f.lead_investor;
  } catch { /* non-fatal */ }
  if (patch.investorNames.length) patch.investors = await resolver.resolveInvestors(supabase, patch.investorNames);
  return patch;
}

async function runKnownCompanyEnrichment(kind) {
  const isUploads = kind === 'uploads';
  const table = isUploads ? 'startup_uploads' : 'discovered_startups';
  const cols = isUploads
    ? 'id, name, description, website, entity_gate, extracted_data, lead_investor'
    : 'id, name, description, article_title, website, lead_investor, investors_mentioned, metadata, imported_to_startups';

  const stats = { processed: 0, urls_found: 0, investors_linked: 0, stamped: 0, skipped: 0, errors: 0 };
  const PAGE = 500;
  let offset = 0;
  const work = [];

  // Collect rows that still need a website, skipping ones already enriched.
  while (work.length < LIMIT && offset < 40000) {
    let q = supabase.from(table).select(cols).is('website', null).order('id', { ascending: true }).range(offset, offset + PAGE - 1);
    if (!isUploads) q = q.eq('imported_to_startups', false);
    const { data, error } = await q;
    if (error) { console.error('fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const r of data) {
      const meta = isUploads
        ? (r.extracted_data && typeof r.extracted_data === 'object' ? r.extracted_data : {})
        : (r.metadata && typeof r.metadata === 'object' ? r.metadata : {});
      if (!FORCE && meta.url_enriched_at) continue;
      if (isUploads && r.entity_gate === 'junk') continue;
      if (!r.name || !isValidStartupName(r.name).isValid) continue;
      work.push({ row: r, meta });
      if (work.length >= LIMIT) break;
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\nRows needing website (${kind}): ${work.length}  (concurrency=${CONCURRENCY})\n`);

  const processOne = async ({ row, meta }) => {
    stats.processed += 1;
    const text = [row.name, row.description, row.article_title].filter(Boolean).join('. ');
    let res;
    try {
      res = await enrichKnownCompany({
        name: row.name, text,
        hasWebsite: Boolean(row.website),
        hasLeadInvestor: Boolean(row.lead_investor),
      });
    } catch (e) { stats.errors += 1; console.log(`  ⚠️  ${row.name} — ${e.message}`); return; }

    const linked = res.investors.filter((i) => i.investor_id).length;
    if (res.website) stats.urls_found += 1;
    stats.investors_linked += linked;
    if (res.website || res.investorNames.length) {
      console.log(`  ${res.website ? '✅ ' + res.website.replace('https://', '') : '·  no-url'}  ${row.name}` +
        `${res.investorNames.length ? '  (' + res.investorNames.length + ' inv/' + linked + ' linked)' : ''}`);
    }

    if (!APPLY) return;

    const newMeta = { ...meta, url_enriched_at: new Date().toISOString(), resolver_investors: res.investors };
    // Feed the scorer: hotGodFromStartupRow reads backed_by = startup.backed_by
    // || extracted.backed_by || extracted.investors. Without this the resolved
    // investors earn +0 social-proof score. Only credit investors actually linked
    // to the canonical investors table (investor_id) — unlinked mentions are
    // unverified extraction noise and shouldn't inflate the score.
    const scorerInvestorNames = res.investors
      .filter((i) => i.investor_id)
      .map((i) => i.matched_name || i.name)
      .filter(Boolean);
    if (scorerInvestorNames.length && (!Array.isArray(meta.investors) || meta.investors.length === 0)) {
      newMeta.investors = scorerInvestorNames;
    }
    const patch = isUploads ? { extracted_data: newMeta } : { metadata: newMeta };
    if (res.website) patch.website = res.website;
    if (res.lead_investor) patch.lead_investor = res.lead_investor;
    if (!isUploads && res.investorNames.length && (!row.investors_mentioned || row.investors_mentioned.length === 0)) {
      patch.investors_mentioned = res.investorNames;
    }
    const { error } = await supabase.from(table).update(patch).eq('id', row.id);
    if (error) { stats.errors += 1; console.log(`      ↳ update failed (${row.name}): ${error.message}`); }
    else stats.stamped += 1;
  };

  // Process with a bounded concurrency pool (URL resolution is network-bound).
  for (let i = 0; i < work.length; i += CONCURRENCY) {
    await Promise.all(work.slice(i, i + CONCURRENCY).map(processOne));
    if (i % (CONCURRENCY * 20) === 0 && i > 0) {
      console.log(`  … progress ${i}/${work.length}  (urls ${stats.urls_found}, linked ${stats.investors_linked})`);
    }
  }

  console.log('\n' + '─'.repeat(64));
  console.log(`  SUMMARY (${kind})`);
  console.log('─'.repeat(64));
  console.log(`  processed:         ${stats.processed}`);
  console.log(`  websites resolved: ${stats.urls_found}`);
  console.log(`  investors linked:  ${stats.investors_linked}`);
  console.log(`  rows updated:      ${stats.stamped}${APPLY ? '' : ' (dry-run)'}`);
  console.log(`  errors:            ${stats.errors}`);
  console.log('─'.repeat(64));
  if (!APPLY) console.log('\n  DRY RUN — no writes. Re-run with --apply.\n');
}

/* ---------------- main ---------------- */
(async () => {
  console.log('═'.repeat(64));
  console.log('  EVENT RESOLVER  ' + resolver.RESOLVER_VERSION);
  console.log(`  source=${SOURCE}  mode=${APPLY ? 'APPLY' : 'DRY-RUN'}  model=${MODEL}  window=${HOURS}h  limit=${LIMIT}`);
  console.log(`  url-lookup=${NO_URLS ? 'off' : 'on'}  verify=${NO_VERIFY ? 'off' : 'on'}  min-conf=${MIN_CONF}`);
  console.log('═'.repeat(64));

  if (SOURCE === 'uploads') return runKnownCompanyEnrichment('uploads');
  if (SOURCE === 'discovered') return runKnownCompanyEnrichment('discovered');

  const candidates = await fetchCandidates();
  console.log(`\nCandidates needing resolution: ${candidates.length}\n`);

  const stats = {
    processed: 0, created: 0, reconciled: 0, skipped_existing: 0, not_startup: 0,
    no_name: 0, low_conf: 0, errors: 0, urls_found: 0, investors_linked: 0,
  };

  for (const ev of candidates) {
    stats.processed += 1;
    const title = (ev.source_title || '').slice(0, 78);
    let result;
    try {
      result = await resolver.resolveEvent(ev, {
        openai, supabase, model: MODEL,
        inferDomainFromName, resolveUrls: !NO_URLS, verifyUrls: !NO_VERIFY,
        minConfidence: MIN_CONF,
      });
    } catch (err) {
      stats.errors += 1;
      console.log(`  ⚠️  [err] ${title} — ${err.message}`);
      continue;
    }

    // A — in-place reconciliation: supersede the hardcoded upload for this event
    if (result.action === 'create' || result.action === 'skip_not_startup') {
      const rec = await reconcileExistingUpload(ev, result);
      if (rec) {
        stats.reconciled += 1;
        console.log(`  🔁 [${rec.outcome}] ${title}${rec.error ? ' — ' + rec.error : ''}`);
        result.discoveredId = rec.id;
        await markResolved(ev, { ...result, action: rec.outcome });
        continue;
      }
    }

    if (result.action !== 'create') {
      if (result.action === 'skip_not_startup') stats.not_startup += 1;
      else if (result.action === 'skip_no_name') stats.no_name += 1;
      else if (result.action === 'skip_low_confidence') stats.low_conf += 1;
      else stats.errors += 1;
      console.log(`  ⏭️  [${result.action.replace('skip_', '')}] ${title} — ${result.reason}`);
      await markResolved(ev, result);
      continue;
    }

    const r = result.record;
    const linked = (result.investors || []).filter((i) => i.investor_id).length;
    if (r.website) stats.urls_found += 1;
    stats.investors_linked += linked;

    console.log(`  ✅ ${r.name}${r.website ? ' [' + r.website.replace('https://', '') + ']' : ' [no-url]'}` +
      ` (conf ${result.extraction.confidence.toFixed(2)}${r.funding_amount ? ', $' + (r.funding_amount / 1e6).toFixed(1) + 'M' : ''}` +
      `${r.investors_mentioned ? ', ' + r.investors_mentioned.length + ' inv/' + linked + ' linked' : ''})`);

    if (APPLY) {
      const ins = await gate.insertDiscovered(r, { checkDuplicates: true });
      if (ins.ok) {
        result.discoveredId = ins.id || null;
        if (ins.skipped) console.log(`      ↳ already in discovered_startups (dedup)`);
        else { stats.created += 1; console.log(`      ↳ staged → discovered_startups ${ins.id}`); }
        await markResolved(ev, result); // only mark resolved on a successful write
      } else {
        stats.errors += 1;
        console.log(`      ↳ insert rejected: ${ins.error}`); // leave unmarked so it retries
      }
    } else {
      stats.created += 1;
    }
  }

  console.log('\n' + '─'.repeat(64));
  console.log('  SUMMARY');
  console.log('─'.repeat(64));
  console.log(`  processed:          ${stats.processed}`);
  console.log(`  staged (created):   ${stats.created}${APPLY ? '' : ' (dry-run — would create)'}`);
  console.log(`  reconciled in-place:${stats.reconciled}  (superseded scraper rows for same event)`);
  console.log(`  websites resolved:  ${stats.urls_found}`);
  console.log(`  investors linked:   ${stats.investors_linked}`);
  console.log(`  not-a-startup:      ${stats.not_startup}`);
  console.log(`  no clean name:      ${stats.no_name}`);
  console.log(`  low confidence:     ${stats.low_conf}`);
  console.log(`  errors:             ${stats.errors}`);
  console.log('─'.repeat(64));
  if (!APPLY) console.log('\n  DRY RUN — no writes. Re-run with --apply to stage results.\n');
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
