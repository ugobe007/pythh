#!/usr/bin/env node
/**
 * List mature sealed sets with funding gaps (unlock candidates).
 * Usage: node scripts/list-hit5-mature-gap-unlocks.mjs [--horizon=180] [--json]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

import { loadFundingEvidenceLedger } from '../lib/loadFundingLibs.mjs';

const require = createRequire(import.meta.url);
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const {
  classifyFundingEvidence,
  isServeGradeStartupIdentity,
  normalizeEntityName,
} = loadFundingEvidenceLedger();

const horizon = Number(process.argv.find((a) => a.startsWith('--horizon='))?.split('=')[1] || 180);
const asJson = process.argv.includes('--json');
const DAY_MS = 86_400_000;
const asOf = new Date();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key required');
const db = createClient(url, key, { auth: { persistSession: false } });

async function all(table, select) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from(table).select(select).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function rowsByIds(table, select, ids) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.from(table).select(select).in('id', ids.slice(offset, offset + 200));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

function groupBy(rows, keyFor) {
  const grouped = new Map();
  for (const row of rows || []) {
    const key = keyFor(row);
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  return grouped;
}

function exactTopFive(rows, timestampField) {
  const byRank = new Map();
  for (const row of [...rows].sort((a, b) => new Date(a[timestampField]) - new Date(b[timestampField]))) {
    if (Number(row.rank_position) >= 1 && Number(row.rank_position) <= 5 && !byRank.has(Number(row.rank_position))) {
      byRank.set(Number(row.rank_position), row);
    }
  }
  const ordered = [...byRank.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
  if (ordered.length !== 5 || new Set(ordered.map((row) => row.investor_id)).size !== 5) return null;
  return ordered;
}

function buildPredictionSets(snapshots) {
  const sets = [];
  const snapshotGroups = groupBy(snapshots, (row) => `${row.cohort_key}\0${row.startup_id}`);
  for (const [key, rows] of snapshotGroups) {
    const predictions = exactTopFive(rows, 'predicted_at');
    if (!predictions) continue;
    sets.push({
      cohort_key: predictions[0].cohort_key,
      startup_id: predictions[0].startup_id,
      predicted_at: predictions.map((row) => row.predicted_at).sort().at(-1),
      predictions,
    });
  }
  const firstByStartup = new Map();
  for (const set of sets.sort((a, b) => new Date(a.predicted_at) - new Date(b.predicted_at))) {
    if (!firstByStartup.has(set.startup_id)) firstByStartup.set(set.startup_id, set);
  }
  return [...firstByStartup.values()];
}

function hasFiveDistinctInvestorFirms(set, investorById, organizationByInvestor) {
  if (set.predictions.length !== 5) return false;
  const seen = new Set();
  for (const prediction of set.predictions) {
    const investor = investorById.get(prediction.investor_id);
    if (!investor) return false;
    const keys = [
      organizationByInvestor.get(prediction.investor_id) ? `organization:${organizationByInvestor.get(prediction.investor_id)}` : null,
      `label:${normalizeEntityName(investor.firm || investor.name)}`,
    ].filter((key) => key && key !== 'label:');
    if (!keys.length || keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
  }
  return true;
}

function trustedOutcome(event) {
  if (!classifyFundingEvidence({
    event_type: 'FUNDING',
    source_title: event.source_title,
    frame_confidence: 1,
    extraction_meta: { decision: 'ACCEPT', graph_safe: true },
  }).eligible) return false;
  if (event.verification_status === 'rejected') return false;
  if (['verified', 'corroborated'].includes(event.verification_status)) return true;
  return event.verification_status === 'observed' && assessFundingSource(event).trusted;
}

function eventTime(event) {
  return new Date(event.occurred_at || event.announced_at);
}

function fundingGaps(events, predictedAt, horizonEnd) {
  const gaps = [];
  for (const event of events) {
    const at = eventTime(event);
    if (at <= predictedAt || at > horizonEnd || at > asOf) continue;
    const discoveredAt = new Date(event.discovered_at || event.created_at);
    const eligible = classifyFundingEvidence({
      event_type: 'FUNDING',
      source_title: event.source_title,
      frame_confidence: 1,
      extraction_meta: { decision: 'ACCEPT', graph_safe: true },
    }).eligible;
    if (!eligible || event.verification_status === 'rejected') continue;
    if (trustedOutcome(event) && discoveredAt >= predictedAt) continue;
    if (event.verification_status === 'observed' && !assessFundingSource(event).trusted) {
      gaps.push({
        kind: 'untrusted_observed',
        event_id: event.id,
        title: event.source_title,
        announced_at: event.announced_at,
        participant_list_complete: event.metadata?.participant_list_complete === true,
        source_url: event.source_url,
        source_publisher: event.source_publisher,
      });
      continue;
    }
    if (trustedOutcome(event) && discoveredAt < predictedAt) {
      gaps.push({
        kind: 'discovered_before_prediction',
        event_id: event.id,
        title: event.source_title,
        discovered_at: event.discovered_at || event.created_at,
        announced_at: event.announced_at,
      });
    }
  }
  return gaps;
}

const [snapshots, events, memberships] = await Promise.all([
  all('funding_prediction_snapshots', 'id,cohort_key,startup_id,investor_id,rank_position,predicted_at'),
  all('funding_evidence_events', 'id,startup_id,announced_at,occurred_at,discovered_at,created_at,verification_status,source_url,source_publisher,source_title,metadata'),
  all('investor_organization_memberships', 'investor_id,organization_id'),
]);
const allSets = buildPredictionSets(snapshots);
const startupIds = [...new Set(allSets.map((row) => row.startup_id))];
const investorIds = [...new Set(allSets.flatMap((row) => row.predictions.map((p) => p.investor_id)))];
const [startups, investors] = await Promise.all([
  rowsByIds('startup_uploads', 'id,name', startupIds),
  rowsByIds('investors', 'id,name,firm', investorIds),
]);
const startupById = new Map(startups.map((row) => [row.id, row]));
const investorById = new Map(investors.map((row) => [row.id, row]));
const organizationByInvestor = new Map(memberships.map((row) => [row.investor_id, row.organization_id]));
const eventsByStartup = groupBy(events.filter((row) => row.startup_id), (row) => row.startup_id);

const rows = [];
for (const set of allSets) {
  const startup = startupById.get(set.startup_id);
  if (!isServeGradeStartupIdentity(startup)) continue;
  if (!hasFiveDistinctInvestorFirms(set, investorById, organizationByInvestor)) continue;
  const predictedAt = new Date(set.predicted_at);
  const horizonEnd = new Date(predictedAt.getTime() + horizon * DAY_MS);
  const mature = asOf >= horizonEnd;
  const startupEvents = eventsByStartup.get(set.startup_id) || [];
  const gaps = fundingGaps(startupEvents, predictedAt, horizonEnd);
  if (!gaps.length) continue;
  const daysUntilMature = mature ? 0 : Math.ceil((horizonEnd.getTime() - asOf.getTime()) / DAY_MS);
  rows.push({
    startup: startup?.name,
    startup_id: set.startup_id,
    predicted_at: set.predicted_at,
    mature,
    days_until_mature: daysUntilMature,
    gaps,
  });
}

const matureRows = rows.filter((r) => r.mature);
const pendingRows = rows.filter((r) => !r.mature);

const report = {
  horizon_days: horizon,
  mature_with_gaps: matureRows.length,
  pending_with_gaps: pendingRows.length,
  mature_unlock_candidates: matureRows.sort((a, b) => a.startup.localeCompare(b.startup)),
  pending_unlock_candidates: pendingRows.sort((a, b) => a.days_until_mature - b.days_until_mature).slice(0, 40),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Mature gap unlocks (horizon=${horizon}d): ${matureRows.length}`);
  for (const row of matureRows) {
    console.log(`- ${row.startup} | gaps=${row.gaps.length}`);
    for (const g of row.gaps) console.log(`    ${g.kind} complete=${g.participant_list_complete} ${g.title?.slice(0, 80)}`);
  }
}
