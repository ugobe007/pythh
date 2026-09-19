#!/usr/bin/env node
/**
 * Among startups that later raised from a matched investor, where did that
 * funder sit on the pre-event list — top 5, ranks 6–50, worse than 50, or
 * never in the pool?
 *
 * Clock is match.created_at / event_at. Rank uses only matches written before
 * the raise. Does not rewrite matches or retune GOD/fit.
 *
 *   npm run funding:top50:pair-funding
 *   npm run funding:top50:pair-funding -- --json
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { resolveSupabaseRestUrl, resolveSupabaseServiceKey } from '../lib/supabaseEnv.mjs';
import { loadFundingEvidenceLedger } from '../lib/loadFundingLibs.mjs';

const require = createRequire(import.meta.url);
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const { classifyFundingEvidence } = loadFundingEvidenceLedger();
const {
  rankFirmMatches,
  placeFunderRank,
  rankBucket,
  bestStartupRank,
  summarizeTopNPlacements,
  participantIdentityKeys,
  predictionIdentityKeys,
} = require('../server/lib/topNPairFunding.js');

const TOP_N = 50;
const asJson = process.argv.includes('--json');
const asOfArg = process.argv.find((arg) => arg.startsWith('--as-of='));
const asOf = new Date(asOfArg?.slice('--as-of='.length) || Date.now());
if (Number.isNaN(asOf.getTime())) throw new Error('--as-of must be a valid date');

const url = resolveSupabaseRestUrl().url;
const key = resolveSupabaseServiceKey();
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

async function rowsByColumn(table, select, column, ids, batchSize = 80) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    const chunk = ids.slice(offset, offset + batchSize);
    for (let page = 0; ; page += 1000) {
      const { data, error } = await db.from(table).select(select).in(column, chunk).range(page, page + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
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

function trustedLedgerEvent(event) {
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
  return new Date(event.occurred_at || event.announced_at || event.event_at);
}

function namedParticipants(rows) {
  return (rows || []).filter((row) =>
    row.participation_relation
    && row.participant_role !== 'unknown'
    && String(row.investor_name_raw || '').trim());
}

function evaluateCohort({
  pairs,
  matchesByStartup,
  snapshotsByStartup,
  identityCtx,
}) {
  const byStartup = groupBy(pairs, (row) => row.startup_id);
  const evaluated = [];
  for (const [startupId, funders] of byStartup) {
    const placed = funders.map((funder) => {
      const beforeMs = new Date(funder.event_at).getTime();
      const ranked = rankFirmMatches(matchesByStartup.get(startupId) || [], identityCtx, { beforeMs });
      let rank = placeFunderRank(funder.keys, ranked);
      const sealed = (snapshotsByStartup.get(startupId) || []).find((row) =>
        identityCtx && funder.keys?.length
          && identityKeysOverlap(
            predictionIdentityKeys({ investor_id: row.investor_id }, identityCtx),
            new Set(funder.keys),
          ));
      if (sealed) {
        const sealedRank = Number(sealed.rank_position);
        rank = rank == null ? sealedRank : Math.min(rank, sealedRank);
      }
      return {
        name: funder.name,
        investor_id: funder.investor_id,
        event_at: funder.event_at,
        rank,
        bucket: rankBucket(rank, { topN: TOP_N }),
        source: funder.source,
      };
    });
    evaluated.push({
      startup_id: startupId,
      startup_name: funders[0].startup_name,
      best_rank: bestStartupRank(placed.map((row) => row.rank)),
      funders: placed,
    });
  }
  evaluated.sort((a, b) => String(a.startup_name || '').localeCompare(String(b.startup_name || '')));
  return evaluated;
}

function identityKeysOverlap(leftKeys, rightKeySet) {
  return (leftKeys || []).some((key) => rightKeySet.has(key));
}

async function main() {
  const [evidence, events, participants, memberships, snapshots] = await Promise.all([
    all('match_validation_evidence', 'id,startup_id,investor_id,match_id,verified,review_status,event_at,evidence_type,source_url'),
    all('funding_evidence_events', 'id,startup_id,announced_at,occurred_at,discovered_at,created_at,verification_status,source_url,source_publisher,source_title,metadata'),
    all('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation'),
    all('investor_organization_memberships', 'investor_id,organization_id'),
    all('funding_prediction_snapshots', 'startup_id,investor_id,rank_position,cohort_key,predicted_at'),
  ]);

  const officialEvidence = evidence.filter((row) =>
    row.verified
    && ['funding', 'investment'].includes(row.evidence_type || 'funding')
    && row.event_at);
  const officialMatchIds = [...new Set(officialEvidence.map((row) => row.match_id).filter(Boolean))];
  const officialMatches = await rowsByColumn(
    'startup_investor_matches',
    'id,startup_id,investor_id,created_at',
    'id',
    officialMatchIds,
    150,
  );
  const officialMatchById = new Map(officialMatches.map((row) => [row.id, row]));

  const officialPairsRaw = officialEvidence.map((row) => {
    const match = officialMatchById.get(row.match_id);
    if (!match) return null;
    if (row.startup_id !== match.startup_id || row.investor_id !== match.investor_id) return null;
    const eventAt = new Date(row.event_at);
    const matchAt = new Date(match.created_at);
    if (!(eventAt > matchAt) || eventAt > asOf) return null;
    return {
      startup_id: row.startup_id,
      investor_id: row.investor_id,
      event_at: row.event_at,
      source: 'official',
      source_url: row.source_url,
    };
  }).filter(Boolean);

  const participantsByEvent = groupBy(participants, (row) => row.funding_event_id);
  const ledgerPairsRaw = [];
  for (const event of events) {
    if (!event.startup_id || !trustedLedgerEvent(event)) continue;
    const at = eventTime(event);
    const discoveredAt = new Date(event.discovered_at || event.created_at);
    if (!Number.isFinite(at.getTime()) || at > asOf) continue;
    for (const participant of namedParticipants(participantsByEvent.get(event.id))) {
      ledgerPairsRaw.push({
        startup_id: event.startup_id,
        investor_id: participant.investor_id || null,
        investor_name_raw: participant.investor_name_raw,
        investor_organization_id: participant.investor_organization_id,
        event_at: at.toISOString(),
        discovered_at: discoveredAt.toISOString(),
        source: 'ledger',
      });
    }
  }

  const startupIds = [...new Set([
    ...officialPairsRaw.map((row) => row.startup_id),
    ...ledgerPairsRaw.map((row) => row.startup_id),
  ])];
  const matches = await rowsByColumn(
    'startup_investor_matches',
    'id,startup_id,investor_id,match_score,created_at,status',
    'startup_id',
    startupIds,
    25,
  );
  const matchesByStartup = groupBy(matches, (row) => row.startup_id);

  const firstMatchAt = new Map();
  for (const row of matches) {
    const t = new Date(row.created_at).getTime();
    const prev = firstMatchAt.get(row.startup_id);
    if (!prev || t < prev) firstMatchAt.set(row.startup_id, t);
  }

  const investorIds = [...new Set([
    ...officialPairsRaw.map((row) => row.investor_id),
    ...ledgerPairsRaw.map((row) => row.investor_id).filter(Boolean),
    ...matches.map((row) => row.investor_id),
    ...snapshots.map((row) => row.investor_id),
  ].filter(Boolean))];

  const [startups, investors] = await Promise.all([
    rowsByColumn('startup_uploads', 'id,name', 'id', startupIds, 150),
    rowsByColumn('investors', 'id,name,firm', 'id', investorIds, 150),
  ]);
  const startupById = new Map(startups.map((row) => [row.id, row]));
  const investorById = new Map(investors.map((row) => [row.id, row]));
  const organizationByInvestor = new Map(memberships.map((row) => [row.investor_id, row.organization_id]));
  const identityCtx = { organizationByInvestor, investorById };
  const snapshotsByStartup = groupBy(
    snapshots.filter((row) => row.cohort_key === 'served-first-top5' && Number(row.rank_position) >= 1 && Number(row.rank_position) <= 5),
    (row) => row.startup_id,
  );

  function decorate(row) {
    const keys = row.source === 'official'
      ? predictionIdentityKeys({ investor_id: row.investor_id }, identityCtx)
      : participantIdentityKeys(row, identityCtx);
    const inv = row.investor_id ? investorById.get(row.investor_id) : null;
    return {
      ...row,
      keys,
      name: inv?.firm || inv?.name || row.investor_name_raw || null,
      startup_name: startupById.get(row.startup_id)?.name || null,
    };
  }

  const officialPairs = officialPairsRaw.map(decorate).filter((row) => row.keys.length);
  const ledgerPairs = ledgerPairsRaw
    .filter((row) => {
      const first = firstMatchAt.get(row.startup_id);
      const at = new Date(row.event_at).getTime();
      const discovered = new Date(row.discovered_at).getTime();
      return first != null && at > first && discovered >= first;
    })
    .map(decorate)
    .filter((row) => row.keys.length);

  const officialEval = evaluateCohort({
    pairs: officialPairs,
    matchesByStartup,
    snapshotsByStartup,
    identityCtx,
  });
  const combinedKeys = new Map();
  const combinedPairs = [];
  for (const row of [...officialPairs, ...ledgerPairs]) {
    const startupId = row.startup_id;
    if (!combinedKeys.has(startupId)) {
      combinedKeys.set(startupId, []);
    }
    const existing = combinedKeys.get(startupId);
    const keySet = new Set(row.keys);
    const duplicate = existing.some((seenKeySet) => identityKeysOverlap(row.keys, seenKeySet));
    if (duplicate) continue;
    existing.push(keySet);
    combinedPairs.push(row);
  }
  const combinedEval = evaluateCohort({
    pairs: combinedPairs,
    matchesByStartup,
    snapshotsByStartup,
    identityCtx,
  });

  const official = summarizeTopNPlacements(officialEval, { topN: TOP_N });
  const combined = summarizeTopNPlacements(combinedEval, { topN: TOP_N });

  const listByBucket = (evaluated, bucket) => evaluated
    .filter((row) => rankBucket(row.best_rank, { topN: TOP_N }) === bucket)
    .map((row) => ({
      startup: row.startup_name,
      best_rank: row.best_rank,
      funders: row.funders.map((f) => `${f.name || 'unknown'} (#${f.rank ?? '—'} ${f.bucket})`),
    }));

  const report = {
    generated_at: new Date().toISOString(),
    as_of: asOf.toISOString(),
    question: 'How many startups later raised from an investor we had already ranked in the top 50?',
    official_verified: official,
    official_plus_ledger: combined,
    official_top_5: listByBucket(officialEval, 'top_5'),
    official_ranks_6_to_50: listByBucket(officialEval, 'ranks_6_to_n'),
    official_outside_top_50: listByBucket(officialEval, 'outside_top_n'),
    official_never_matched: listByBucket(officialEval, 'never_matched'),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const o = report.official_verified;
  const c = report.official_plus_ledger;
  console.log('Top-50 match funding (pre-event rank, firm-deduped)');
  console.log('='.repeat(72));
  console.log('OFFICIAL verified pairs (same clock as homepage 13/45)');
  console.log(`  Startups with a later matched funder:     ${o.startups}`);
  console.log(`  Funder was in top 5:                      ${o.startups_top_5}  (${o.startup_top_5_rate_pct ?? 'n/a'}%)`);
  console.log(`  Funder was in ranks 6–50:                 ${o.startups_ranks_6_to_n}`);
  console.log(`  Funder was in top 50 (5 + 6–50):          ${o.startups_top_n}  (${o.startup_top_n_rate_pct ?? 'n/a'}%)`);
  console.log(`  Matched but outside top 50:               ${o.startups_outside_top_n}`);
  console.log(`  Never in the pre-event pool:              ${o.startups_never_matched}`);
  console.log('');
  console.log('OFFICIAL + trusted ledger rosters');
  console.log(`  Startups: ${c.startups}  top5 ${c.startups_top_5}  ranks6–50 ${c.startups_ranks_6_to_n}  top50 ${c.startups_top_n} (${c.startup_top_n_rate_pct ?? 'n/a'}%)`);
  console.log('');
  console.log('RANKS 6–50 (official)');
  console.log('-'.repeat(72));
  if (!report.official_ranks_6_to_50.length) console.log('  (none)');
  for (const row of report.official_ranks_6_to_50) {
    console.log(`  ${row.startup}  best #${row.best_rank}  ${row.funders.join('; ')}`);
  }
  console.log('');
  console.log('OUTSIDE TOP 50 (official)');
  console.log('-'.repeat(72));
  if (!report.official_outside_top_50.length) console.log('  (none)');
  for (const row of report.official_outside_top_50) {
    console.log(`  ${row.startup}  best #${row.best_rank}  ${row.funders.join('; ')}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
