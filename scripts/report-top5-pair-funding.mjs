#!/usr/bin/env node
/**
 * Pair-level question: of the investors we ranked in a sealed top-5, how many
 * later funded that startup? Also lists sealed startups with no post-match
 * funding events so we can hunt evidence.
 *
 * Official positives: match_validation_evidence.verified + event_at > match.created_at.
 * Trusted ledger participants after predicted_at are a second evidence layer.
 *
 *   npm run funding:top5:pair-funding
 *   npm run funding:top5:pair-funding -- --json
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { resolveSupabaseRestUrl, resolveSupabaseServiceKey } from '../lib/supabaseEnv.mjs';
import { loadFundingEvidenceLedger } from '../lib/loadFundingLibs.mjs';

const require = createRequire(import.meta.url);
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const { classifyFundingEvidence, isServeGradeStartupIdentity, normalizeEntityName } = loadFundingEvidenceLedger();
const {
  evaluateSealedTop5Pairs,
  summarizeTop5PairFunding,
} = require('../server/lib/top5PairFunding.js');

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
      set_key: `snapshot:${key}`,
      cohort_key: predictions[0].cohort_key,
      startup_id: predictions[0].startup_id,
      predicted_at: predictions.map((row) => row.predicted_at).sort()[0],
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
      organizationByInvestor.get(prediction.investor_id)
        ? `organization:${organizationByInvestor.get(prediction.investor_id)}`
        : null,
      `label:${normalizeEntityName(investor.firm || investor.name)}`,
    ].filter((key) => key && key !== 'label:');
    if (!keys.length || keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
  }
  return true;
}

async function main() {
  const [snapshots, events, participants, memberships, evidence] = await Promise.all([
    all('funding_prediction_snapshots', 'id,cohort_key,startup_id,investor_id,rank_position,predicted_at'),
    all('funding_evidence_events', 'id,startup_id,announced_at,occurred_at,discovered_at,created_at,verification_status,source_url,source_publisher,source_title,metadata'),
    all('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation'),
    all('investor_organization_memberships', 'investor_id,organization_id'),
    all('match_validation_evidence', 'id,startup_id,investor_id,match_id,verified,review_status,event_at,evidence_type,source_url'),
  ]);

  const servedSnapshots = snapshots.filter((row) => row.cohort_key === 'served-first-top5');
  const allPredictionSets = buildPredictionSets(servedSnapshots);
  const predictedStartupIds = [...new Set(allPredictionSets.map((row) => row.startup_id))];
  const predictedInvestorIds = [...new Set(allPredictionSets.flatMap((row) => row.predictions.map((p) => p.investor_id)))];
  const evidenceInvestorIds = [...new Set(evidence.map((row) => row.investor_id).filter(Boolean))];
  const participantInvestorIds = [...new Set(participants.map((row) => row.investor_id).filter(Boolean))];
  const investorIds = [...new Set([...predictedInvestorIds, ...evidenceInvestorIds, ...participantInvestorIds])];
  const matchIds = [...new Set(evidence.map((row) => row.match_id).filter(Boolean))];

  const [startups, investors, matches] = await Promise.all([
    rowsByIds('startup_uploads', 'id,name,description,source_type,website,company_domain', predictedStartupIds),
    rowsByIds('investors', 'id,name,firm', investorIds),
    rowsByIds('startup_investor_matches', 'id,startup_id,investor_id,created_at', matchIds),
  ]);

  const startupById = new Map(startups.map((row) => [row.id, row]));
  const investorById = new Map(investors.map((row) => [row.id, row]));
  const matchById = new Map(matches.map((row) => [row.id, row]));
  const organizationByInvestor = new Map(memberships.map((row) => [row.investor_id, row.organization_id]));
  const identityCtx = { organizationByInvestor, investorById };

  const predictionSets = allPredictionSets.filter((set) => {
    const startup = startupById.get(set.startup_id);
    return isServeGradeStartupIdentity(startup)
      && hasFiveDistinctInvestorFirms(set, investorById, organizationByInvestor);
  });

  const officialByStartup = groupBy(evidence.map((row) => ({
    ...row,
    match_created_at: matchById.get(row.match_id)?.created_at || null,
  })), (row) => row.startup_id);
  const participantsByEvent = groupBy(participants, (row) => row.funding_event_id);
  const eventsByStartup = groupBy(events.filter((row) => row.startup_id), (row) => row.startup_id);

  const evaluated = predictionSets.map((set) => {
    const outcome = evaluateSealedTop5Pairs({
      set,
      events: eventsByStartup.get(set.startup_id) || [],
      participantsByEvent,
      officialEvidence: officialByStartup.get(set.startup_id) || [],
      identityCtx,
      asOf,
      classifyFundingEvidence,
      assessFundingSource,
    });
    const startup = startupById.get(set.startup_id);
    return {
      ...outcome,
      startup_name: startup?.name || null,
      website: startup?.website || null,
      predicted_investors: set.predictions.map((prediction) => {
        const inv = investorById.get(prediction.investor_id);
        const pair = outcome.pairs.find((row) => row.investor_id === prediction.investor_id);
        return {
          rank: prediction.rank_position,
          investor_id: prediction.investor_id,
          name: inv?.firm || inv?.name || null,
          pair_hit: pair?.pair_hit || false,
          official_verified: pair?.official_verified || false,
          ledger_trusted: pair?.ledger_trusted || false,
          ledger_observed: pair?.ledger_observed || false,
          source_url: pair?.source_url || null,
        };
      }),
    };
  });

  const summary = summarizeTop5PairFunding(evaluated);
  const hitRows = evaluated.filter((row) => row.pair_hits > 0)
    .sort((a, b) => a.startup_name.localeCompare(b.startup_name));
  const searchCandidates = evaluated
    .filter((row) => summary.search_candidate_ids.includes(row.startup_id) && row.website)
    .sort((a, b) => new Date(a.predicted_at) - new Date(b.predicted_at))
    .slice(0, 40)
    .map((row) => ({
      startup_id: row.startup_id,
      startup: row.startup_name,
      website: row.website,
      predicted_at: row.predicted_at,
    }));

  const report = {
    generated_at: new Date().toISOString(),
    as_of: asOf.toISOString(),
    question: 'How many of our sealed top-5 matches later received funding from that same investor?',
    inventory: {
      served_first_top5_rows: servedSnapshots.length,
      complete_prediction_sets: predictionSets.length,
      excluded_incomplete_or_non_serve_grade: allPredictionSets.length - predictionSets.length,
      official_evidence_rows: evidence.length,
      funding_events: events.length,
    },
    answer: summary,
    confirmed_pair_hits: hitRows.map((row) => ({
      startup: row.startup_name,
      startup_id: row.startup_id,
      predicted_at: row.predicted_at,
      pair_hits: row.pair_hits,
      funders: row.predicted_investors.filter((inv) => inv.pair_hit).map((inv) => ({
        rank: inv.rank,
        name: inv.name,
        official_verified: inv.official_verified,
        source_url: inv.source_url,
      })),
    })),
    search_candidates: searchCandidates,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const a = report.answer;
  console.log('Top-5 pair funding (sealed served-first-top5)');
  console.log('='.repeat(72));
  console.log(`Sealed startups (serve-grade):     ${a.sealed_startups}`);
  console.log(`Sealed top-5 pairs:                ${a.sealed_top5_pairs}`);
  console.log(`Official verified pair hits:       ${a.official_pair_hits}  (${a.official_pair_hit_rate_pct ?? 'n/a'}%)`);
  console.log(`Trusted pair hits (official+ledger): ${a.trusted_pair_hits}  (${a.pair_hit_rate_pct ?? 'n/a'}%)`);
  console.log(`Pairs with any funding evidence:   ${a.evidence_pairs}`);
  console.log(`Startups with a top-5 later funder:${a.startups_with_a_top5_funder}  (${a.startup_hit_rate_pct ?? 'n/a'}%)`);
  console.log(`Startups funded after the match:   ${a.startups_funded_after_match}`);
  console.log('');
  console.log('Read this as pair precision, not the homepage sentence.');
  console.log('Homepage 13/45 is: among startups that later raised from a matched investor,');
  console.log('share where that funder sat in sealed or live top-5. This report asks the');
  console.log('stricter question: of every sealed top-5 investor, how many later funded.');
  console.log('');
  console.log('PAIRS THAT LATER FUNDED');
  console.log('-'.repeat(72));
  if (!hitRows.length) console.log('  (none)');
  for (const row of report.confirmed_pair_hits) {
    const names = row.funders.map((f) => `#${f.rank} ${f.name}${f.official_verified ? '' : ' [ledger]'}`).join(', ');
    console.log(`  ${row.startup}  (${row.pair_hits}/5)  ${names}`);
  }
  console.log('');
  console.log(`SEARCH CANDIDATES (sealed, no post-match funding event yet, showing ${searchCandidates.length})`);
  console.log('-'.repeat(72));
  for (const row of searchCandidates) {
    console.log(`  ${row.startup}  ${row.startup_id}  predicted@ ${row.predicted_at}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
