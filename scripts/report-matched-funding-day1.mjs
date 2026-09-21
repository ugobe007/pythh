#!/usr/bin/env node
/**
 * Official pair-level funding proof using day 1 = match.created_at.
 *
 * Official: match_validation_evidence.verified + event_at > match.created_at.
 * Hunt: trusted funding_evidence_events after funding_evidence_search_queue.earliest_match_at
 * that are not yet official pairs.
 *
 *   npm run funding:matched:day1
 *   npm run funding:matched:day1 -- --json
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { resolveSupabaseRestUrl, resolveSupabaseServiceKey } from '../lib/supabaseEnv.mjs';
import { loadFundingEvidenceLedger } from '../lib/loadFundingLibs.mjs';

const require = createRequire(import.meta.url);
const { officialDay1Pairs, summarizeOfficialPairs, isPostDay1LedgerEvent } = require('../server/lib/matchedFundingDay1.js');
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const { classifyFundingEvidence } = loadFundingEvidenceLedger();

const asJson = process.argv.includes('--json');
const PAGE = 1000;

const url = resolveSupabaseRestUrl().url;
const key = resolveSupabaseServiceKey();
const db = createClient(url, key, { auth: { persistSession: false } });

async function all(table, select, applyFilter) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = db.from(table).select(select).range(offset, offset + PAGE - 1);
    if (applyFilter) q = applyFilter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function rowsByIds(table, select, ids) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.from(table).select(select).in('id', ids.slice(offset, offset + 200));
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
  }
  return rows;
}

function trustedLedgerEvent(event) {
  if (event.verification_status === 'rejected') return false;
  if (!classifyFundingEvidence({
    event_type: 'FUNDING',
    source_title: event.source_title,
    frame_confidence: 1,
    extraction_meta: { decision: 'ACCEPT', graph_safe: true },
  }).eligible) return false;
  if (['verified', 'corroborated'].includes(event.verification_status)) return true;
  return event.verification_status === 'observed' && assessFundingSource(event).trusted;
}

async function main() {
  const [evidence, queue, events] = await Promise.all([
    all('match_validation_evidence', 'id,startup_id,investor_id,match_id,verified,review_status,event_at,evidence_type,source_url'),
    all('funding_evidence_search_queue', 'startup_id,earliest_match_at'),
    all(
      'funding_evidence_events',
      'id,startup_id,announced_at,occurred_at,discovered_at,created_at,verification_status,source_url,source_publisher,source_title'
    ),
  ]);

  const matchIds = [...new Set(evidence.map((row) => row.match_id).filter(Boolean))];
  const matches = await rowsByIds(
    'startup_investor_matches',
    'id,startup_id,investor_id,created_at',
    matchIds
  );
  const matchById = new Map(matches.map((row) => [row.id, row]));
  const official = officialDay1Pairs(evidence, matchById);
  const summary = summarizeOfficialPairs(official);

  const startupIds = [...new Set(official.map((row) => row.startup_id).filter(Boolean))];
  const investorIds = [...new Set(official.map((row) => row.investor_id).filter(Boolean))];
  const [startups, investors] = await Promise.all([
    rowsByIds('startup_uploads', 'id,name,website', startupIds),
    rowsByIds('investors', 'id,name,firm', investorIds),
  ]);
  const startupById = new Map(startups.map((row) => [row.id, row]));
  const investorById = new Map(investors.map((row) => [row.id, row]));

  const examples = official
    .slice()
    .sort((a, b) => b.days_after_match - a.days_after_match)
    .slice(0, 25)
    .map((row) => ({
      startup: startupById.get(row.startup_id)?.name || row.startup_id,
      investor: investorById.get(row.investor_id)?.firm || investorById.get(row.investor_id)?.name || row.investor_id,
      day_1: row.match_created_at,
      funded_at: row.event_at,
      days_after_match: row.days_after_match,
      source_url: row.source_url,
    }));

  const clockByStartup = new Map();
  for (const row of queue) {
    if (!row.startup_id || !row.earliest_match_at) continue;
    const prior = clockByStartup.get(row.startup_id);
    if (!prior || new Date(row.earliest_match_at) < new Date(prior)) {
      clockByStartup.set(row.startup_id, row.earliest_match_at);
    }
  }

  const officialKeys = new Set(official.map((row) => `${row.startup_id}:${row.investor_id}`));
  const hunt = [];
  for (const event of events) {
    if (!event.startup_id || !trustedLedgerEvent(event)) continue;
    const day1 = clockByStartup.get(event.startup_id);
    if (!day1 || !isPostDay1LedgerEvent(event, day1)) continue;
    hunt.push({
      event_id: event.id,
      startup_id: event.startup_id,
      day_1: day1,
      event_at: event.occurred_at || event.announced_at,
      verification_status: event.verification_status,
      source_title: event.source_title,
      source_url: event.source_url,
      source_publisher: event.source_publisher,
    });
  }

  const huntStartupIds = [...new Set(hunt.map((row) => row.startup_id))];
  const huntStartups = await rowsByIds('startup_uploads', 'id,name,website', huntStartupIds);
  const huntName = new Map(huntStartups.map((row) => [row.id, row.name]));
  const huntExamples = hunt.slice(0, 25).map((row) => ({
    ...row,
    startup: huntName.get(row.startup_id) || row.startup_id,
    already_official_startup: official.some((p) => p.startup_id === row.startup_id),
  }));

  const report = {
    clock: 'startup_investor_matches.created_at (day 1)',
    official: {
      ...summary,
      verified_evidence_rows: evidence.filter((row) => row.verified).length,
      evidence_rows: evidence.length,
      examples,
    },
    hunt: {
      trusted_ledger_events_after_day1: hunt.length,
      startups: huntStartupIds.length,
      note: 'Trusted/corroborated ledger events after earliest_match_at that are not yet required to be official pairs. Official still needs MVE.verified + event_at > match.created_at.',
      examples: huntExamples,
      already_official_pair_keys: officialKeys.size,
    },
    computed_at: new Date().toISOString(),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\nMatched funding proof · day 1 = match.created_at\n');
  console.log(`  Official pairs: ${summary.official_pairs}`);
  console.log(`  Startups with a later funder we had already matched: ${summary.startups_with_official_pair}`);
  console.log(`  Investors in those pairs: ${summary.investors_in_official_pairs}`);
  console.log(`  Days after match: ${summary.min_days_after_match ?? '—'}–${summary.max_days_after_match ?? '—'}`);
  console.log(`  Hunt (trusted ledger after earliest_match_at): ${hunt.length} events / ${huntStartupIds.length} startups\n`);
  for (const row of examples.slice(0, 12)) {
    console.log(`  • ${row.startup} ← ${row.investor}  +${row.days_after_match}d  ${String(row.day_1).slice(0, 10)} → ${String(row.funded_at).slice(0, 10)}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
