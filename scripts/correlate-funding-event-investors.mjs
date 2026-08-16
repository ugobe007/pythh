#!/usr/bin/env node
import 'dotenv/config';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const { extractInferenceData } = require('../lib/inference-extractor.js');
const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = Math.max(1, Number(limitArg?.split('=')[1] || 5000));
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service environment');
const db = createClient(url, key, { auth: { persistSession: false } });

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const speculative = /\b(in talks|plans? to|may invest|considering|could invest|reportedly|rumou?r)\b/i;

async function paged(table, columns, configure, max = Infinity) {
  const rows = [];
  for (let from = 0; rows.length < max; from += 1000) {
    let query = db.from(table).select(columns).range(from, Math.min(from + 999, from + max - rows.length - 1));
    query = configure ? configure(query) : query;
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function uniqueMap(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = normalize(row.name);
    if (!key) continue;
    const values = grouped.get(key) || [];
    values.push(row.id);
    grouped.set(key, values);
  }
  return new Map([...grouped].filter(([, ids]) => ids.length === 1).map(([k, ids]) => [k, ids[0]]));
}

const [startups, investors, events] = await Promise.all([
  paged('startup_uploads', 'id,name', q => q.not('name', 'is', null)),
  paged('investors', 'id,name', q => q.not('name', 'is', null)),
  paged('startup_events', 'id,event_id,event_type,subject,source_title,source_url,source_publisher,occurred_at,entities',
    q => q.eq('event_type', 'FUNDING').not('source_url', 'is', null).not('occurred_at', 'is', null).order('occurred_at', { ascending: false }), limit),
]);
const startupByName = uniqueMap(startups);
const investorByName = uniqueMap(investors);
let extracted = 0, resolvedPairs = 0, matchedPredictions = 0, inserted = 0, speculativeSkipped = 0;

for (const event of events) {
  if (speculative.test(event.source_title || '')) { speculativeSkipped++; continue; }
  const startupId = startupByName.get(normalize(event.subject));
  if (!startupId) continue;
  const inferred = extractInferenceData(event.source_title || '', event.source_url || '');
  const investorName = inferred?.lead_investor;
  if (!investorName) continue;
  extracted++;
  const investorId = investorByName.get(normalize(investorName));
  if (!investorId) continue;
  resolvedPairs++;
  const { data: match, error: matchError } = await db.from('startup_investor_matches')
    .select('id,created_at').eq('startup_id', startupId).eq('investor_id', investorId)
    .lt('created_at', event.occurred_at).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (matchError) throw new Error(matchError.message);
  if (!match) continue;
  matchedPredictions++;
  if (!apply) continue;
  const { error } = await db.from('match_validation_evidence').insert({
    match_id: match.id, startup_id: startupId, investor_id: investorId, evidence_type: 'funding',
    event_at: event.occurred_at, source_url: event.source_url,
    source_provider: event.source_publisher || 'startup_events', source_record_type: 'startup_event',
    source_record_id: event.id, resolution_method: 'name_exact_unique', resolution_confidence: 0.95,
    raw_payload: { event_id: event.event_id, title: event.source_title, startup_name: event.subject, investor_name: investorName, entities: event.entities || [] },
  });
  if (!error) inserted++;
  else if (!/duplicate key/i.test(error.message)) throw new Error(error.message);
}

console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', events_scanned: events.length, speculative_skipped: speculativeSkipped,
  lead_investors_extracted: extracted, canonical_pairs_resolved: resolvedPairs, post_prediction_matches: matchedPredictions, inserted }, null, 2));
