#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildClaimReadiness } = require('../server/lib/fundingPredictionClaim.js');
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const { classifyFundingEvidence, isServeGradeStartupIdentity, normalizeEntityName, groupSourceOutcomesByRoundCluster } = require('../server/lib/fundingEvidenceLedger.js');
const {
  predictionIdentityKeys,
  participantIdentityKeys,
  participantPrimaryKey,
  identityKeysOverlap,
} = require('../server/lib/fundingHitIdentity.js');

const HORIZONS = [30, 90, 180, 365];
const DAY_MS = 86_400_000;
const targetArg = process.argv.find(arg => arg.startsWith('--target='));
const minimumArg = process.argv.find(arg => arg.startsWith('--minimum='));
const asOfArg = process.argv.find(arg => arg.startsWith('--as-of='));
const summaryOnly = process.argv.includes('--summary');
const targetRate = Number(targetArg?.split('=')[1] || 0.85);
const minimumAuditedOutcomes = Number(minimumArg?.split('=')[1] || 100);
const asOf = new Date(asOfArg?.slice('--as-of='.length) || Date.now());
if (!Number.isFinite(targetRate) || targetRate <= 0 || targetRate > 1) throw new Error('--target must be between 0 and 1');
if (!Number.isInteger(minimumAuditedOutcomes) || minimumAuditedOutcomes < 1) throw new Error('--minimum must be a positive integer');
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
  if (ordered.length !== 5 || new Set(ordered.map(row => row.investor_id)).size !== 5) return null;
  return ordered;
}

function buildPredictionSets(snapshots, impressions) {
  const sets = [];
  const snapshotGroups = groupBy(snapshots, row => `${row.cohort_key}\u0000${row.startup_id}`);
  for (const [key, rows] of snapshotGroups) {
    const predictions = exactTopFive(rows, 'predicted_at');
    if (!predictions) continue;
    sets.push({
      set_key: `snapshot:${key}`,
      provenance: 'prospective_snapshot',
      cohort_key: predictions[0].cohort_key,
      startup_id: predictions[0].startup_id,
      model_version: [...new Set(predictions.map(row => row.model_version))].sort().join('+'),
      predicted_at: predictions.map(row => row.predicted_at).sort().at(-1),
      predictions,
    });
  }
  const impressionGroups = groupBy(impressions, row => `${row.session_id}\u0000${row.startup_id}\u0000${row.model_version}`);
  for (const [key, rows] of impressionGroups) {
    const predictions = exactTopFive(rows, 'shown_at');
    if (!predictions) continue;
    const times = predictions.map(row => new Date(row.shown_at).getTime());
    if (Math.max(...times) - Math.min(...times) > 10 * 60_000) continue;
    sets.push({
      set_key: `impression:${key}`,
      provenance: 'served_impression',
      cohort_key: `served:${predictions[0].session_id}`,
      startup_id: predictions[0].startup_id,
      model_version: predictions[0].model_version,
      predicted_at: new Date(Math.max(...times)).toISOString(),
      predictions,
    });
  }
  const firstByStartup = new Map();
  for (const set of sets.sort((a, b) => new Date(a.predicted_at) - new Date(b.predicted_at))) {
    if (!firstByStartup.has(set.startup_id)) firstByStartup.set(set.startup_id, set);
  }
  return [...firstByStartup.values()];
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

function evaluateSetAtHorizon(set, horizon, events, participantsByEvent, organizationByInvestor, investorById) {
  const predictedAt = new Date(set.predicted_at);
  const horizonEnd = new Date(predictedAt.getTime() + horizon * DAY_MS);
  const mature = asOf >= horizonEnd;
  const identityCtx = { organizationByInvestor, investorById };
  const predictedKeys = new Set(set.predictions.flatMap((row) => predictionIdentityKeys(row, identityCtx)));
  const eligibleEvents = events.filter(event => {
    const at = eventTime(event);
    const discoveredAt = new Date(event.discovered_at || event.created_at);
    return trustedOutcome(event) && at > predictedAt && at <= horizonEnd && at <= asOf
      && discoveredAt >= predictedAt;
  });
  const sourceOutcomes = eligibleEvents.map(event => {
    const namedParticipants = (participantsByEvent.get(event.id) || []).filter(row =>
      row.participation_relation && row.participant_role !== 'unknown' && String(row.investor_name_raw || '').trim());
    // Firm-level identity: org, investor id, or cleaned firm label (duplicate profiles share labels).
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
  const eventOutcomes = [...roundGroups.values()].map(sources => {
    const participants = [...new Map(sources.flatMap(row => row.participants)
      .map((row) => [participantPrimaryKey(row, identityCtx), row])).values()];
    const namedParticipants = [...new Map(sources.flatMap(row => row.namedParticipants)
      .map(row => [String(row.investor_name_raw || '').trim().toLowerCase(), row])).values()];
    const hitParticipants = participants.filter((row) =>
      identityKeysOverlap(participantIdentityKeys(row, identityCtx), predictedKeys));
    return {
      event_ids: sources.map(row => row.event.id),
      participants,
      namedParticipants,
      hitParticipants,
      participant_list_complete: sources.some(row => row.participant_list_complete),
    };
  });
  const funded = eventOutcomes.length > 0;
  const confirmedHit = eventOutcomes.some(row => row.hitParticipants.length > 0);
  // Misses need a complete named roster; names need not resolve into our investor universe.
  const auditableMiss = funded && !confirmedHit
    && eventOutcomes.every(row => row.participant_list_complete && row.namedParticipants.length > 0);
  const indeterminate = funded && !confirmedHit && !auditableMiss;
  const audited = confirmedHit || auditableMiss;
  const distinctActualKeys = new Set(eventOutcomes.flatMap((row) => row.participants
    .map((participant) => participantPrimaryKey(participant, identityCtx)).filter(Boolean)));
  const distinctHitKeys = new Set(eventOutcomes.flatMap((row) => row.hitParticipants
    .map((participant) => participantPrimaryKey(participant, identityCtx)).filter(Boolean)));
  return {
    ...set,
    horizon_days: horizon,
    mature,
    funded,
    audited,
    confirmed_hit: confirmedHit,
    confirmed_miss: auditableMiss,
    indeterminate,
    funding_event_ids: eventOutcomes.flatMap(row => row.event_ids),
    actual_investor_count: distinctActualKeys.size,
    predicted_investor_hits: distinctHitKeys.size,
    all_participant_lists_complete: funded && eventOutcomes.every(row => row.participant_list_complete),
  };
}

function summarize(rows, horizon) {
  const scoped = rows.filter(row => row.horizon_days === horizon);
  const funded = scoped.filter(row => row.funded);
  const audited = funded.filter(row => row.audited);
  const complete = audited.filter(row => row.all_participant_lists_complete);
  const confirmedHits = audited.filter(row => row.confirmed_hit).length;
  const confirmedMisses = audited.filter(row => row.confirmed_miss).length;
  const readiness = buildClaimReadiness({
    confirmedHits,
    confirmedMisses,
    indeterminate: funded.filter(row => row.indeterminate).length,
    targetRate,
    minimumAuditedOutcomes,
  });
  const investorHits = complete.reduce((sum, row) => sum + row.predicted_investor_hits, 0);
  const actualInvestors = complete.reduce((sum, row) => sum + row.actual_investor_count, 0);
  return {
    horizon_days: horizon,
    prediction_sets: scoped.length,
    mature_prediction_sets: scoped.filter(row => row.mature).length,
    pending_prediction_sets: scoped.filter(row => !row.mature).length,
    funded_startups_observed: funded.length,
    confirmed_hit_startups: confirmedHits,
    confirmed_miss_startups: confirmedMisses,
    indeterminate_funded_startups: funded.filter(row => row.indeterminate).length,
    per_investor_precision_at_5: complete.length ? investorHits / (complete.length * 5) : null,
    actual_investor_recall_at_5: actualInvestors ? investorHits / actualInvestors : null,
    claim_readiness: readiness,
  };
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
    ].filter(key => key && key !== 'label:');
    if (!keys.length || keys.some(key => seen.has(key))) return false;
    keys.forEach(key => seen.add(key));
  }
  return true;
}

async function main() {
  const [snapshots, impressions, events, participants, memberships] = await Promise.all([
    all('funding_prediction_snapshots', 'id,cohort_key,startup_id,investor_id,rank_position,model_version,predicted_at,prediction_kind'),
    all('ranking_impressions', 'id,session_id,startup_id,investor_id,rank_position,model_version,score,shown_at'),
    all('funding_evidence_events', 'id,startup_id,canonical_round_key,announced_at,occurred_at,discovered_at,created_at,verification_status,source_url,source_publisher,source_title,metadata'),
    all('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status'),
    all('investor_organization_memberships', 'investor_id,organization_id'),
  ]);
  const allPredictionSets = buildPredictionSets(snapshots, impressions);
  const predictedStartupIds = [...new Set(allPredictionSets.map(row => row.startup_id))];
  const predictedInvestorIds = [...new Set(allPredictionSets.flatMap(row => row.predictions.map(prediction => prediction.investor_id)))];
  const participantInvestorIds = [...new Set(participants.map((row) => row.investor_id).filter(Boolean))];
  const investorIds = [...new Set([...predictedInvestorIds, ...participantInvestorIds])];
  const [startups, investors] = await Promise.all([
    rowsByIds('startup_uploads', 'id,name,description,source_type,website,company_domain', predictedStartupIds),
    rowsByIds('investors', 'id,name,firm', investorIds),
  ]);
  const startupById = new Map(startups.map(row => [row.id, row]));
  const investorById = new Map(investors.map(row => [row.id, row]));
  const organizationByInvestor = new Map(memberships.map(row => [row.investor_id, row.organization_id]));
  const identityQualifiedSets = allPredictionSets.filter(set => {
    const startup = startupById.get(set.startup_id);
    return isServeGradeStartupIdentity(startup);
  });
  const predictionSets = identityQualifiedSets.filter(set =>
    hasFiveDistinctInvestorFirms(set, investorById, organizationByInvestor));
  const participantsByEvent = groupBy(participants, row => row.funding_event_id);
  const eventsByStartup = groupBy(events.filter(row => row.startup_id), row => row.startup_id);
  const rows = predictionSets.flatMap(set => HORIZONS.map(horizon => evaluateSetAtHorizon(
    set, horizon, eventsByStartup.get(set.startup_id) || [], participantsByEvent, organizationByInvestor, investorById,
  )));
  const confirmedOutcomes = rows.filter(row => row.funded).map(row => ({
    cohort_key: row.cohort_key,
    provenance: row.provenance,
    startup_id: row.startup_id,
    startup_name: startupById.get(row.startup_id)?.name || null,
    model_version: row.model_version,
    predicted_at: row.predicted_at,
    horizon_days: row.horizon_days,
    result: row.confirmed_hit ? 'confirmed_hit' : row.confirmed_miss ? 'confirmed_miss' : 'indeterminate',
    funding_event_ids: row.funding_event_ids,
    predicted_investor_hits: row.predicted_investor_hits,
  }));
  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    as_of: asOf.toISOString(),
    policy: {
      target_rate: targetRate,
      minimum_audited_outcomes: minimumAuditedOutcomes,
      temporal_rule: 'Funding event and evidence discovery must occur after the immutable prediction timestamp.',
      evidence_rule: 'One reputable source can prove a hit. A miss requires a complete or explicitly audited participant list.',
      anti_inflation_rule: 'Metrics are startup-level Hit@5; per-investor precision and actual-investor recall are reported separately.',
    },
    inventory: {
      prospective_snapshot_rows: snapshots.length,
      served_impression_rows: impressions.length,
      complete_prediction_sets: predictionSets.length,
      excluded_prediction_sets_without_prediction_grade_identity: allPredictionSets.length - identityQualifiedSets.length,
      excluded_prediction_sets_with_duplicate_or_unresolved_firms: identityQualifiedSets.length - predictionSets.length,
      funding_events: events.length,
      funding_participants: participants.length,
    },
    metrics: HORIZONS.map(horizon => summarize(rows, horizon)),
    confirmed_outcome_counts: {
      total: confirmedOutcomes.length,
      by_result: confirmedOutcomes.reduce((acc, row) => {
        acc[row.result] = (acc[row.result] || 0) + 1;
        return acc;
      }, {}),
    },
    ...(summaryOnly
      ? {}
      : { confirmed_outcomes: confirmedOutcomes }),
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
