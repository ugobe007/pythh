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

/* ---------------- main ---------------- */
(async () => {
  console.log('═'.repeat(64));
  console.log('  EVENT RESOLVER  ' + resolver.RESOLVER_VERSION);
  console.log(`  mode=${APPLY ? 'APPLY' : 'DRY-RUN'}  model=${MODEL}  window=${HOURS}h  limit=${LIMIT}`);
  console.log(`  url-lookup=${NO_URLS ? 'off' : 'on'}  verify=${NO_VERIFY ? 'off' : 'on'}  min-conf=${MIN_CONF}`);
  console.log('═'.repeat(64));

  const candidates = await fetchCandidates();
  console.log(`\nCandidates needing resolution: ${candidates.length}\n`);

  const stats = {
    processed: 0, created: 0, skipped_existing: 0, not_startup: 0,
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
