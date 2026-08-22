#!/usr/bin/env node
/**
 * Triage sealed Hit@5 prediction sets for near-term horizon maturity and hunt
 * funded startups outside the current audited cohort.
 *
 * Usage:
 *   node scripts/triage-hit5-pending-horizons.mjs
 *   node scripts/triage-hit5-pending-horizons.mjs --horizon=180 --json
 *   node scripts/triage-hit5-pending-horizons.mjs --horizon=180 --within-days=90
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const {
  classifyFundingEvidence,
  isServeGradeStartupIdentity,
  normalizeEntityName,
  groupSourceOutcomesByRoundCluster,
} = require('../server/lib/fundingEvidenceLedger.js');
const {
  predictionIdentityKeys,
  participantIdentityKeys,
  participantPrimaryKey,
  identityKeysOverlap,
} = require('../server/lib/fundingHitIdentity.js');

const HORIZONS = [30, 90, 180, 365];
const DAY_MS = 86_400_000;
const horizonArg = process.argv.find((arg) => arg.startsWith('--horizon='));
const withinDaysArg = process.argv.find((arg) => arg.startsWith('--within-days='));
const asOfArg = process.argv.find((arg) => arg.startsWith('--as-of='));
const asJson = process.argv.includes('--json');
const horizonDays = Number(horizonArg?.split('=')[1] || 180);
const withinDays = Number(withinDaysArg?.split('=')[1] || 90);
const asOf = new Date(asOfArg?.slice('--as-of='.length) || Date.now());
if (!HORIZONS.includes(horizonDays)) throw new Error('--horizon must be one of 30,90,180,365');
if (Number.isNaN(asOf.getTime())) throw new Error('--as-of must be a valid date');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
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

function evaluateSet(set, horizon, events, participantsByEvent, organizationByInvestor, investorById) {
  const predictedAt = new Date(set.predicted_at);
  const horizonEnd = new Date(predictedAt.getTime() + horizon * DAY_MS);
  const mature = asOf >= horizonEnd;
  const daysUntilMature = mature ? 0 : Math.ceil((horizonEnd.getTime() - asOf.getTime()) / DAY_MS);
  const identityCtx = { organizationByInvestor, investorById };
  const predictedKeys = new Set(set.predictions.flatMap((row) => predictionIdentityKeys(row, identityCtx)));
  const eligibleEvents = events.filter((event) => {
    const at = eventTime(event);
    const discoveredAt = new Date(event.discovered_at || event.created_at);
    return trustedOutcome(event) && at > predictedAt && at <= horizonEnd && at <= asOf
      && discoveredAt >= predictedAt;
  });
  const sourceOutcomes = eligibleEvents.map((event) => {
    const namedParticipants = (participantsByEvent.get(event.id) || []).filter((row) =>
      row.participation_relation && row.participant_role !== 'unknown' && String(row.investor_name_raw || '').trim());
    const participants = namedParticipants.filter((row) => participantIdentityKeys(row, identityCtx).length > 0);
    const hitParticipants = participants.filter((row) =>
      identityKeysOverlap(participantIdentityKeys(row, identityCtx), predictedKeys));
    return {
      event,
      participants,
      namedParticipants,
      hitParticipants,
      participant_list_complete: event.metadata?.participant_list_complete === true,
    };
  });
  const roundGroups = groupSourceOutcomesByRoundCluster(sourceOutcomes);
  const eventOutcomes = [...roundGroups.values()].map((sources) => {
    const participants = [...new Map(sources.flatMap((row) => row.participants)
      .map((row) => [participantPrimaryKey(row, identityCtx), row])).values()];
    const namedParticipants = [...new Map(sources.flatMap((row) => row.namedParticipants)
      .map((row) => [String(row.investor_name_raw || '').trim().toLowerCase(), row])).values()];
    const hitParticipants = participants.filter((row) =>
      identityKeysOverlap(participantIdentityKeys(row, identityCtx), predictedKeys));
    return {
      event_ids: sources.map((row) => row.event.id),
      participants,
      namedParticipants,
      hitParticipants,
      participant_list_complete: sources.some((row) => row.participant_list_complete),
    };
  });
  const funded = eventOutcomes.length > 0;
  const confirmedHit = eventOutcomes.some((row) => row.hitParticipants.length > 0);
  const auditableMiss = funded && !confirmedHit
    && eventOutcomes.every((row) => row.participant_list_complete && row.namedParticipants.length > 0);
  const indeterminate = funded && !confirmedHit && !auditableMiss;
  const result = !funded ? 'unfunded_in_horizon'
    : confirmedHit ? 'confirmed_hit'
      : auditableMiss ? 'confirmed_miss'
        : 'indeterminate';
  return {
    mature,
    days_until_mature: daysUntilMature,
    horizon_end: horizonEnd.toISOString(),
    funded,
    result,
    indeterminate,
    funding_event_ids: eventOutcomes.flatMap((row) => row.event_ids),
    incomplete_round_clusters: eventOutcomes.filter((row) => !row.participant_list_complete).length,
  };
}

function classifyExclusion(set, startup, investorById, organizationByInvestor) {
  if (!isServeGradeStartupIdentity(startup)) return 'not_serve_grade';
  if (!hasFiveDistinctInvestorFirms(set, investorById, organizationByInvestor)) return 'duplicate_or_unresolved_firms';
  return null;
}

function huntOutsideCohort(set, startup, events, predictedAt, horizonEnd) {
  const reasons = [];
  const postPrediction = events.filter((event) => {
    const at = eventTime(event);
    return at > predictedAt && at <= horizonEnd && at <= asOf;
  });
  if (!postPrediction.length) return reasons;
  const trustedInWindow = postPrediction.filter((event) => trustedOutcome(event));
  if (!trustedInWindow.length) {
    const untrusted = postPrediction.filter((event) => !event.verification_status || event.verification_status !== 'rejected');
    if (untrusted.length) reasons.push('post_prediction_events_not_trusted');
    return reasons;
  }
  const temporalBlocked = trustedInWindow.filter((event) => {
    const discoveredAt = new Date(event.discovered_at || event.created_at);
    return discoveredAt < predictedAt;
  });
  if (temporalBlocked.length && temporalBlocked.length === trustedInWindow.length) {
    reasons.push('discovered_before_prediction');
  }
  const incompleteOnly = trustedInWindow.every((event) => event.metadata?.participant_list_complete !== true);
  if (trustedInWindow.length && incompleteOnly) reasons.push('trusted_but_roster_incomplete');
  return reasons;
}

function huntFundingGaps(events, predictedAt, horizonEnd) {
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
        verification_status: event.verification_status,
        participant_list_complete: event.metadata?.participant_list_complete === true,
        source_url: event.source_url,
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

async function main() {
  const [snapshots, events, participants, memberships] = await Promise.all([
    all('funding_prediction_snapshots', 'id,cohort_key,startup_id,investor_id,rank_position,predicted_at'),
    all('funding_evidence_events', 'id,startup_id,canonical_round_key,announced_at,occurred_at,discovered_at,created_at,verification_status,source_url,source_publisher,source_title,metadata'),
    all('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation'),
    all('investor_organization_memberships', 'investor_id,organization_id'),
  ]);
  const allSets = buildPredictionSets(snapshots);
  const startupIds = [...new Set(allSets.map((row) => row.startup_id))];
  const investorIds = [...new Set([
    ...allSets.flatMap((row) => row.predictions.map((p) => p.investor_id)),
    ...participants.map((row) => row.investor_id).filter(Boolean),
  ])];
  const [startups, investors] = await Promise.all([
    rowsByIds('startup_uploads', 'id,name,description,source_type,website,company_domain', startupIds),
    rowsByIds('investors', 'id,name,firm', investorIds),
  ]);
  const startupById = new Map(startups.map((row) => [row.id, row]));
  const investorById = new Map(investors.map((row) => [row.id, row]));
  const organizationByInvestor = new Map(memberships.map((row) => [row.investor_id, row.organization_id]));
  const participantsByEvent = groupBy(participants, (row) => row.funding_event_id);
  const eventsByStartup = groupBy(events.filter((row) => row.startup_id), (row) => row.startup_id);

  const evaluated = allSets.map((set) => {
    const startup = startupById.get(set.startup_id);
    const exclusion = classifyExclusion(set, startup, investorById, organizationByInvestor);
    const predictedAt = new Date(set.predicted_at);
    const horizonEnd = new Date(predictedAt.getTime() + horizonDays * DAY_MS);
    const startupEvents = eventsByStartup.get(set.startup_id) || [];
    const outcome = exclusion
      ? null
      : evaluateSet(
        set,
        horizonDays,
        startupEvents,
        participantsByEvent,
        organizationByInvestor,
        investorById,
      );
    const huntReasons = exclusion
      ? huntOutsideCohort(set, startup, startupEvents, predictedAt, horizonEnd)
      : [];
    const fundingGaps = exclusion ? [] : huntFundingGaps(startupEvents, predictedAt, horizonEnd);
    return {
      startup_id: set.startup_id,
      startup_name: startup?.name || null,
      predicted_at: set.predicted_at,
      excluded: exclusion,
      hunt_reasons: huntReasons,
      funding_gaps: fundingGaps,
      ...outcome,
    };
  });

  const inCohort = evaluated.filter((row) => !row.excluded);
  const fundedInCohort = inCohort.filter((row) => row.funded);
  const pending = inCohort.filter((row) => !row.mature);
  const pendingSoon = pending.filter((row) => row.days_until_mature > 0 && row.days_until_mature <= withinDays);
  const pendingFunded = pending.filter((row) => row.funded);
  const pendingIndeterminate = pending.filter((row) => row.result === 'indeterminate');
  const excludedWithFundingSignal = evaluated.filter((row) => row.excluded && row.hunt_reasons.length > 0);

  const maturityBuckets = {
    within_30d: pending.filter((row) => row.days_until_mature > 0 && row.days_until_mature <= 30).length,
    within_60d: pending.filter((row) => row.days_until_mature > 30 && row.days_until_mature <= 60).length,
    within_90d: pending.filter((row) => row.days_until_mature > 60 && row.days_until_mature <= 90).length,
    beyond_90d: pending.filter((row) => row.days_until_mature > 90).length,
  };

  const pendingSoonRows = pendingSoon
    .sort((a, b) => a.days_until_mature - b.days_until_mature)
    .map((row) => ({
      startup: row.startup_name,
      startup_id: row.startup_id,
      predicted_at: row.predicted_at,
      days_until_mature: row.days_until_mature,
      horizon_end: row.horizon_end,
      funded_in_horizon: row.funded,
      projected_result: row.result,
      incomplete_round_clusters: row.incomplete_round_clusters,
    }));

  const unfundedWithGaps = inCohort.filter((row) => !row.funded && row.funding_gaps?.length > 0);
  const untrustedObservedGaps = unfundedWithGaps.flatMap((row) =>
    row.funding_gaps.filter((gap) => gap.kind === 'untrusted_observed').map((gap) => ({
      startup: row.startup_name,
      startup_id: row.startup_id,
      predicted_at: row.predicted_at,
      days_until_mature: row.days_until_mature,
      ...gap,
    })));
  const duplicateFirmStartups = evaluated
    .filter((row) => row.excluded === 'duplicate_or_unresolved_firms')
    .map((row) => ({
      startup: row.startup_name,
      startup_id: row.startup_id,
      predicted_at: row.predicted_at,
      hunt_reasons: row.hunt_reasons,
    }));

  const report = {
    generated_at: new Date().toISOString(),
    as_of: asOf.toISOString(),
    horizon_days: horizonDays,
    within_days: withinDays,
    inventory: {
      sealed_snapshot_startups: allSets.length,
      evaluated_cohort: inCohort.length,
      excluded_not_serve_grade: evaluated.filter((row) => row.excluded === 'not_serve_grade').length,
      excluded_duplicate_firms: evaluated.filter((row) => row.excluded === 'duplicate_or_unresolved_firms').length,
      funded_in_horizon: fundedInCohort.length,
      mature: inCohort.filter((row) => row.mature).length,
      pending: pending.length,
    },
    pending_maturity_buckets: maturityBuckets,
    pending_funded_breakdown: {
      total: pendingFunded.length,
      confirmed_hit: pendingFunded.filter((row) => row.result === 'confirmed_hit').length,
      confirmed_miss: pendingFunded.filter((row) => row.result === 'confirmed_miss').length,
      indeterminate: pendingIndeterminate.length,
      unfunded_pending: pending.filter((row) => !row.funded).length,
    },
    note: 'Metrics already count pending funded hits/misses before maturity; near-term unlock adds audited startups only when pending sets become funded+auditable before horizon_end.',
    hunt_outside_current_funded: {
      excluded_with_post_prediction_funding_signal: excludedWithFundingSignal.length,
      excluded_samples: excludedWithFundingSignal.slice(0, 25).map((row) => ({
        startup: row.startup_name,
        startup_id: row.startup_id,
        exclusion: row.excluded,
        hunt_reasons: row.hunt_reasons,
        predicted_at: row.predicted_at,
      })),
      mature_unfunded_count: inCohort.filter((row) => row.mature && !row.funded).length,
      unfunded_with_funding_gaps: unfundedWithGaps.length,
      untrusted_observed_gap_events: untrustedObservedGaps.length,
      untrusted_observed_samples: untrustedObservedGaps.slice(0, 30),
      duplicate_firm_excluded_startups: duplicateFirmStartups,
    },
    near_term_unlock_queue: pendingSoonRows.filter((row) => row.funded_in_horizon && row.projected_result === 'indeterminate'),
    near_term_maturity_soon: pendingSoonRows.slice(0, 40),
    ops_next: [
      'npm run funding:participants:prediction-linked -- --apply --limit=150',
      'npm run funding:participants:seed-indeterminate -- --apply',
      'node scripts/repair-top-god-identity-cohort.mjs (serve-grade exclusions)',
      'npm run funding:hit5:pending-triage -- --horizon=180 --within-days=90',
    ],
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Hit@5 pending horizon triage (horizon=${horizonDays}d, within=${withinDays}d, as_of=${asOf.toISOString()})`);
  console.log('='.repeat(72));
  console.log(`Evaluated cohort:     ${report.inventory.evaluated_cohort}`);
  console.log(`Funded in horizon:    ${report.inventory.funded_in_horizon}`);
  console.log(`Mature / pending:     ${report.inventory.mature} / ${report.inventory.pending}`);
  console.log(`Excluded serve-grade: ${report.inventory.excluded_not_serve_grade}`);
  console.log(`Excluded dup firms:   ${report.inventory.excluded_duplicate_firms}`);
  console.log('');
  console.log('Pending maturity buckets (days until horizon_end):');
  for (const [bucket, n] of Object.entries(maturityBuckets)) console.log(`  ${bucket}: ${n}`);
  console.log('');
  console.log('Pending funded (already in metrics if auditable):');
  console.log(`  hits ${report.pending_funded_breakdown.confirmed_hit}, misses ${report.pending_funded_breakdown.confirmed_miss}, indeterminate ${report.pending_funded_breakdown.indeterminate}`);
  console.log(`  unfunded pending: ${report.pending_funded_breakdown.unfunded_pending}`);
  console.log('');
  console.log(`Excluded startups with funding signal: ${report.hunt_outside_current_funded.excluded_with_post_prediction_funding_signal}`);
  console.log(`Near-term indeterminate unlock queue: ${report.near_term_unlock_queue.length}`);
  console.log('');
  console.log('Maturity soon (first 15):');
  for (const row of report.near_term_maturity_soon.slice(0, 15)) {
    console.log(`  ${row.startup} | mature in ${row.days_until_mature}d | ${row.projected_result}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
