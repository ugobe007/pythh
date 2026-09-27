#!/usr/bin/env node
/**
 * Analyze funding research and write investors.signals.match_model.
 *
 * Reads trusted events that already have a funding_intelligence briefing,
 * plus each participant's observed thesis. Folds amount, stage, sector, and
 * why-they-funded into the match model. Does not retune GOD weights, rewrite
 * match clocks, or overwrite investment_thesis.
 *
 *   npm run funding:match-model
 *   npm run funding:match-model -- --apply --event-limit=400
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const {
  aspectCountsFromObserved,
  foldMatchModel,
  withMatchModel,
} = require('../lib/matchModelFromResearch.js');

const apply = process.argv.includes('--apply');
const jsonOut = process.argv.includes('--json');
const eventLimit = Math.min(
  Math.max(Number(process.argv.find((arg) => arg.startsWith('--event-limit='))?.split('=')[1] || 400), 1),
  5000,
);

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

async function pageSelect(table, columns, build) {
  const out = [];
  const pageSize = 1000;
  let offset = 0;
  while (out.length < eventLimit) {
    const end = Math.min(offset + pageSize, offset + (eventLimit - out.length)) - 1;
    let query = db.from(table).select(columns).range(offset, end);
    if (build) query = build(query);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize || out.length >= eventLimit) break;
    offset += pageSize;
  }
  return out.slice(0, eventLimit);
}

async function loadIn(table, columns, ids, column) {
  const out = [];
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 150) {
    const chunk = unique.slice(i, i + 150);
    const { data, error } = await db.from(table).select(columns).in(column, chunk);
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

function briefingAspects(event) {
  const intel = event?.metadata?.funding_intelligence;
  const aspects = intel?.why?.aspects;
  return Array.isArray(aspects) ? aspects : [];
}

async function main() {
  const mode = apply ? 'apply' : 'dry-run';
  console.error(`match-model  ${mode}  event-limit=${eventLimit}`);

  const scanned = await pageSelect(
    'funding_evidence_events',
    'id, startup_id, round_type, amount_usd, metadata, announced_at, verification_status',
    (query) => query
      .in('verification_status', ['verified', 'corroborated'])
      .order('announced_at', { ascending: false, nullsFirst: false }),
  );
  const events = scanned.filter((event) => event?.metadata?.funding_intelligence);

  const eventIds = events.map((event) => event.id);
  const participants = eventIds.length
    ? await loadIn(
      'funding_evidence_participants',
      'funding_event_id, investor_id, resolution_status',
      eventIds,
      'funding_event_id',
    )
    : [];
  const resolved = participants.filter((row) => row.resolution_status === 'resolved' && row.investor_id);
  const startupIds = events.map((event) => event.startup_id);
  const startups = startupIds.length
    ? await loadIn('startup_uploads', 'id, sectors', startupIds, 'id')
    : [];
  const sectorsByStartup = new Map(startups.map((row) => [row.id, row.sectors]));
  const investorIds = [...new Set(resolved.map((row) => row.investor_id))];
  const investors = investorIds.length
    ? await loadIn('investors', 'id, signals', investorIds, 'id')
    : [];
  const investorById = new Map(investors.map((row) => [row.id, row]));

  const eventsByInvestor = new Map();
  const participantsByEvent = new Map();
  for (const row of resolved) {
    if (!participantsByEvent.has(row.funding_event_id)) participantsByEvent.set(row.funding_event_id, []);
    participantsByEvent.get(row.funding_event_id).push(row.investor_id);
  }
  for (const event of events) {
    const round = {
      id: event.id,
      amount_usd: event.amount_usd || event.metadata?.funding_intelligence?.round?.amount_usd || null,
      round_type: event.round_type || event.metadata?.funding_intelligence?.round?.round_type || null,
      sectors: sectorsByStartup.get(event.startup_id) || [],
      aspects: briefingAspects(event),
    };
    for (const investorId of participantsByEvent.get(event.id) || []) {
      if (!eventsByInvestor.has(investorId)) eventsByInvestor.set(investorId, []);
      eventsByInvestor.get(investorId).push(round);
    }
  }

  const stats = {
    mode,
    events: events.length,
    investors: investorIds.length,
    updated: 0,
    unchanged: 0,
    with_priorities: 0,
    with_sectors: 0,
    errors: 0,
  };

  for (const investorId of investorIds) {
    const row = investorById.get(investorId);
    if (!row) continue;
    const observed = row.signals?.observed_thesis;
    const fromObserved = aspectCountsFromObserved(observed);
    const fromBriefings = {};
    if (!Object.keys(fromObserved).length) {
      for (const event of eventsByInvestor.get(investorId) || []) {
        for (const aspect of event.aspects || []) {
          if (typeof aspect === 'string') fromBriefings[aspect] = (fromBriefings[aspect] || 0) + 1;
        }
      }
    }
    const { model, added } = foldMatchModel(row.signals?.match_model, {
      aspectCounts: Object.keys(fromObserved).length ? fromObserved : fromBriefings,
      events: eventsByInvestor.get(investorId) || [],
    });
    if (model.priorities?.length) stats.with_priorities += 1;
    if (model.sectors?.length) stats.with_sectors += 1;
    const previous = row.signals?.match_model;
    const same = previous
      && previous.event_count === model.event_count
      && JSON.stringify(previous.priorities) === JSON.stringify(model.priorities)
      && JSON.stringify(previous.stages) === JSON.stringify(model.stages)
      && JSON.stringify(previous.sectors) === JSON.stringify(model.sectors)
      && added === 0;
    if (same) {
      stats.unchanged += 1;
      continue;
    }
    if (!apply) {
      stats.updated += 1;
      continue;
    }
    const { error } = await db
      .from('investors')
      .update({ signals: withMatchModel(row.signals, model) })
      .eq('id', investorId);
    if (error) {
      stats.errors += 1;
      console.warn(`  investor ${investorId}: ${error.message}`);
      continue;
    }
    stats.updated += 1;
  }

  mkdirSync('reports', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `reports/funding-match-model-${stamp}.json`;
  writeFileSync(reportPath, JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats, null, 2));
  console.log(`report ${reportPath}`);
  if (jsonOut) process.stdout.write(`${JSON.stringify(stats)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
