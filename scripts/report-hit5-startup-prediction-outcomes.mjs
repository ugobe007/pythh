#!/usr/bin/env node
/**
 * Human-readable Hit@5 startup report:
 * How many sealed prediction sets later had a predicted investor actually fund the startup?
 *
 * Uses the same sealed contract as funding:claim-readiness (immutable predicted_at,
 * serve-grade identity, complete rosters for misses). Does not rewrite match clocks.
 *
 * Usage:
 *   npm run funding:hit5:startup-report
 *   npm run funding:hit5:startup-report -- --horizon=180
 *   npm run funding:hit5:startup-report -- --horizon=180 --json
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const {
  classifyFundingEvidence,
  isServeGradeStartupIdentity,
  normalizeEntityName,
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
const horizonDays = Number(horizonArg?.split('=')[1] || 180);
const withReconcile = process.argv.includes('--with-reconcile');
const asJson = process.argv.includes('--json');
const asOfArg = process.argv.find((arg) => arg.startsWith('--as-of='));
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
      provenance: 'prospective_snapshot',
      cohort_key: predictions[0].cohort_key,
      startup_id: predictions[0].startup_id,
      model_version: [...new Set(predictions.map((row) => row.model_version))].sort().join('+'),
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

function evaluateSet(set, events, participantsByEvent, organizationByInvestor, investorById) {
  const predictedAt = new Date(set.predicted_at);
  const horizonEnd = new Date(predictedAt.getTime() + horizonDays * DAY_MS);
  const mature = asOf >= horizonEnd;
  const identityCtx = { organizationByInvestor, investorById };
  const predictedKeys = new Set(set.predictions.flatMap((row) => predictionIdentityKeys(row, identityCtx)));
  const predictedInvestors = set.predictions.map((row) => {
    const inv = investorById.get(row.investor_id);
    return {
      rank: row.rank_position,
      investor_id: row.investor_id,
      name: inv?.name || null,
      firm: inv?.firm || null,
    };
  });
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
  const roundGroups = groupBy(sourceOutcomes, (row) => row.event.canonical_round_key || `event:${row.event.id}`);
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
      actual_names: namedParticipants.map((row) => row.investor_name_raw),
      hit_names: hitParticipants.map((row) => row.investor_name_raw || investorById.get(row.investor_id)?.name).filter(Boolean),
    };
  });
  const funded = eventOutcomes.length > 0;
  const confirmedHit = eventOutcomes.some((row) => row.hitParticipants.length > 0);
  const auditableMiss = funded && !confirmedHit
    && eventOutcomes.every((row) => row.participant_list_complete && row.namedParticipants.length > 0);
  const indeterminate = funded && !confirmedHit && !auditableMiss;
  return {
    startup_id: set.startup_id,
    predicted_at: set.predicted_at,
    model_version: set.model_version,
    mature,
    funded,
    result: !funded ? 'unfunded_in_horizon'
      : confirmedHit ? 'confirmed_hit'
        : auditableMiss ? 'confirmed_miss'
          : 'indeterminate',
    predicted_investors: predictedInvestors,
    predicted_investor_hits: new Set(eventOutcomes.flatMap((row) => row.hitParticipants
      .map((participant) => participantPrimaryKey(participant, identityCtx)).filter(Boolean))).size,
    hit_investor_names: [...new Set(eventOutcomes.flatMap((row) => row.hit_names))],
    actual_investor_names: [...new Set(eventOutcomes.flatMap((row) => row.actual_names))],
    funding_event_ids: eventOutcomes.flatMap((row) => row.event_ids),
    roster_complete: funded && eventOutcomes.every((row) => row.participant_list_complete),
  };
}

async function loadReconcileDeltaReasons() {
  if (!process.env.DATABASE_URL) return null;
  const child = spawnSync(process.execPath, ['scripts/reconcile-historical-funding-matches.mjs', '--summary'], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (child.status !== 0) return null;
  const raw = child.stdout || '';
  const idx = raw.indexOf('{');
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(raw.slice(idx));
    return {
      totals: parsed.totals || null,
      actual_investor_delta_reasons: parsed.actual_investor_delta_reasons || null,
      directional_hit_rate_at_5: parsed.directional_hit_rate_at_5 ?? null,
      audited_hit_rate_at_5: parsed.audited_hit_rate_at_5 ?? null,
    };
  } catch {
    return null;
  }
}

async function main() {
  const [snapshots, events, participants, memberships] = await Promise.all([
    all('funding_prediction_snapshots', 'id,cohort_key,startup_id,investor_id,rank_position,model_version,predicted_at'),
    all('funding_evidence_events', 'id,startup_id,canonical_round_key,announced_at,occurred_at,discovered_at,created_at,verification_status,source_url,source_publisher,source_title,metadata'),
    all('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation'),
    all('investor_organization_memberships', 'investor_id,organization_id'),
  ]);
  const allPredictionSets = buildPredictionSets(snapshots);
  const predictedStartupIds = [...new Set(allPredictionSets.map((row) => row.startup_id))];
  const predictedInvestorIds = [...new Set(allPredictionSets.flatMap((row) => row.predictions.map((p) => p.investor_id)))];
  const participantInvestorIds = [...new Set(participants.map((row) => row.investor_id).filter(Boolean))];
  const investorIds = [...new Set([...predictedInvestorIds, ...participantInvestorIds])];
  const [startups, investors] = await Promise.all([
    rowsByIds('startup_uploads', 'id,name,description,source_type,website,company_domain', predictedStartupIds),
    rowsByIds('investors', 'id,name,firm', investorIds),
  ]);
  const startupById = new Map(startups.map((row) => [row.id, row]));
  const investorById = new Map(investors.map((row) => [row.id, row]));
  const organizationByInvestor = new Map(memberships.map((row) => [row.investor_id, row.organization_id]));
  const predictionSets = allPredictionSets.filter((set) => {
    const startup = startupById.get(set.startup_id);
    return isServeGradeStartupIdentity(startup)
      && hasFiveDistinctInvestorFirms(set, investorById, organizationByInvestor);
  });
  const participantsByEvent = groupBy(participants, (row) => row.funding_event_id);
  const eventsByStartup = groupBy(events.filter((row) => row.startup_id), (row) => row.startup_id);
  const evaluated = predictionSets.map((set) => {
    const outcome = evaluateSet(
      set,
      eventsByStartup.get(set.startup_id) || [],
      participantsByEvent,
      organizationByInvestor,
      investorById,
    );
    return {
      ...outcome,
      startup_name: startupById.get(set.startup_id)?.name || null,
    };
  });

  const hits = evaluated.filter((row) => row.result === 'confirmed_hit')
    .sort((a, b) => a.startup_name.localeCompare(b.startup_name));
  const misses = evaluated.filter((row) => row.result === 'confirmed_miss')
    .sort((a, b) => a.startup_name.localeCompare(b.startup_name));
  const indeterminates = evaluated.filter((row) => row.result === 'indeterminate')
    .sort((a, b) => a.startup_name.localeCompare(b.startup_name));
  const funded = evaluated.filter((row) => row.funded);
  const mature = evaluated.filter((row) => row.mature);

  const reconcile = withReconcile ? await loadReconcileDeltaReasons() : null;

  const report = {
    generated_at: new Date().toISOString(),
    as_of: asOf.toISOString(),
    horizon_days: horizonDays,
    question: 'How many startups did Pythh predict investors for who later actually funded that startup?',
    answer: {
      sealed_prediction_sets: predictionSets.length,
      mature_prediction_sets: mature.length,
      funded_startups_in_horizon: funded.length,
      confirmed_hit_startups: hits.length,
      confirmed_miss_startups: misses.length,
      indeterminate_funded_startups: indeterminates.length,
      hit_rate_among_audited: (hits.length + misses.length)
        ? hits.length / (hits.length + misses.length)
        : null,
    },
    why_not_higher: {
      note: 'Past Hit@5 cannot improve by backdating matches. created_at is the prediction clock.',
      dominant_gap: 'candidate_generation_miss = actual funder was not in the pre-event match pool / top-5',
      next_ops: [
        'npm run funding:participants:prediction-linked -- --apply --limit=100',
        'npm run funding:participants:seed-indeterminate -- --apply',
        'npm run funding:reconcile:historical:summary',
        'npm run funding:hit5:startup-report -- --horizon=180 --with-reconcile',
      ],
      reconcile_delta_reasons: reconcile?.actual_investor_delta_reasons || null,
      reconcile_directional_hit_rate_at_5: reconcile?.directional_hit_rate_at_5 ?? null,
      reconcile_audited_hit_rate_at_5: reconcile?.audited_hit_rate_at_5 ?? null,
    },
    confirmed_hits: hits.map((row) => ({
      startup: row.startup_name,
      startup_id: row.startup_id,
      predicted_at: row.predicted_at,
      predicted_top5: row.predicted_investors.map((p) => p.firm || p.name),
      hit_investors: row.hit_investor_names,
      actual_investors: row.actual_investor_names,
    })),
    confirmed_misses: misses.map((row) => ({
      startup: row.startup_name,
      startup_id: row.startup_id,
      predicted_at: row.predicted_at,
      predicted_top5: row.predicted_investors.map((p) => p.firm || p.name),
      actual_investors: row.actual_investor_names,
    })),
    indeterminates: indeterminates.map((row) => ({
      startup: row.startup_name,
      startup_id: row.startup_id,
      predicted_at: row.predicted_at,
      reason: 'funded after prediction but participant roster incomplete / unaudited',
      actual_investors_partial: row.actual_investor_names,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const a = report.answer;
  console.log(`Hit@5 startup prediction outcomes (horizon=${horizonDays}d, as_of=${asOf.toISOString()})`);
  console.log('='.repeat(72));
  console.log(`Sealed prediction sets:           ${a.sealed_prediction_sets}`);
  console.log(`Mature in horizon:                ${a.mature_prediction_sets}`);
  console.log(`Funded after prediction:          ${a.funded_startups_in_horizon}`);
  console.log(`Confirmed HIT startups:           ${a.confirmed_hit_startups}`);
  console.log(`Confirmed MISS startups:          ${a.confirmed_miss_startups}`);
  console.log(`Indeterminate (incomplete roster):${a.indeterminate_funded_startups}`);
  console.log(`Hit rate among audited:           ${a.hit_rate_among_audited == null ? 'n/a' : `${(a.hit_rate_among_audited * 100).toFixed(1)}%`}`);
  console.log('');
  if (reconcile?.actual_investor_delta_reasons) {
    console.log('Reconcile why actual funders were not Hit@5 predictions:');
    for (const [reason, n] of Object.entries(reconcile.actual_investor_delta_reasons)) {
      console.log(`  ${reason}: ${n}`);
    }
    console.log('');
  }
  console.log('CONFIRMED HITS (predicted investor later funded)');
  console.log('-'.repeat(72));
  if (!hits.length) console.log('  (none)');
  for (const row of report.confirmed_hits) {
    console.log(`  ${row.startup}`);
    console.log(`    predicted@ ${row.predicted_at}`);
    console.log(`    top5: ${row.predicted_top5.join(', ')}`);
    console.log(`    hit:  ${row.hit_investors.join(', ')}`);
  }
  console.log('');
  console.log('CONFIRMED MISSES (complete roster, no predicted investor funded)');
  console.log('-'.repeat(72));
  if (!misses.length) console.log('  (none)');
  for (const row of report.confirmed_misses) {
    console.log(`  ${row.startup}`);
    console.log(`    top5:   ${row.predicted_top5.join(', ')}`);
    console.log(`    actual: ${row.actual_investors.join(', ')}`);
  }
  console.log('');
  console.log('INDETERMINATE (funded, roster incomplete — cannot audit miss)');
  console.log('-'.repeat(72));
  if (!indeterminates.length) console.log('  (none)');
  for (const row of report.indeterminates) {
    console.log(`  ${row.startup} — partial: ${(row.actual_investors_partial || []).join(', ') || '(none extracted)'}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
