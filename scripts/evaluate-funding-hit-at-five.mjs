#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const cohortArg = process.argv.find(arg => arg.startsWith('--cohort-key='));
const asOfArg = process.argv.find(arg => arg.startsWith('--as-of='));
const cohortKey = cohortArg?.slice('--cohort-key='.length) || 'god-desc-2026-08-17';
const asOf = new Date(asOfArg?.slice('--as-of='.length) || Date.now());
if (Number.isNaN(asOf.getTime())) throw new Error('--as-of must be a valid date');
const horizons = [30, 90, 180, 365];
const dayMs = 86_400_000;
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function groupBy(rows, key) {
  const result = new Map();
  for (const row of rows || []) result.set(row[key], [...(result.get(row[key]) || []), row]);
  return result;
}

async function main() {
  const { data: snapshots, error: snapshotError } = await db.from('funding_prediction_snapshots')
    .select('id,cohort_key,startup_id,investor_id,god_score_at_prediction,match_score_at_prediction,rank_position,model_version,predicted_at')
    .eq('cohort_key', cohortKey).order('rank_position');
  if (snapshotError) throw snapshotError;
  const startupIds = [...new Set((snapshots || []).map(row => row.startup_id))];
  const { data: startups, error: startupError } = startupIds.length
    ? await db.from('startup_uploads').select('id,name').in('id', startupIds)
    : { data: [], error: null };
  if (startupError) throw startupError;
  const { data: events, error: eventError } = startupIds.length
    ? await db.from('funding_evidence_events').select('id,startup_id,announced_at,occurred_at,canonical_round_key,verification_status,source_url').in('startup_id', startupIds).in('verification_status', ['observed', 'corroborated', 'verified'])
    : { data: [], error: null };
  if (eventError) throw eventError;
  const eventIds = (events || []).map(row => row.id);
  const { data: participants, error: participantError } = eventIds.length
    ? await db.from('funding_evidence_participants').select('id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status').in('funding_event_id', eventIds)
    : { data: [], error: null };
  if (participantError) throw participantError;

  const snapshotInvestorIds = [...new Set((snapshots || []).map(row => row.investor_id))];
  const memberships = [];
  for (let offset = 0; offset < snapshotInvestorIds.length; offset += 200) {
    const { data, error } = await db.from('investor_organization_memberships')
      .select('investor_id,organization_id').in('investor_id', snapshotInvestorIds.slice(offset, offset + 200));
    if (error) throw error;
    memberships.push(...(data || []));
  }
  const organizationByInvestor = new Map(memberships.map(row => [row.investor_id, row.organization_id]));

  const startupById = new Map((startups || []).map(row => [row.id, row]));
  const snapshotsByStartup = groupBy(snapshots, 'startup_id');
  const eventsByStartup = groupBy(events, 'startup_id');
  const participantsByEvent = groupBy((participants || []).filter(row =>
    row.participation_relation && row.participant_role !== 'unknown'
    && (row.investor_id || row.investor_organization_id)
  ), 'funding_event_id');
  const rows = [];
  for (const [startupId, predictions] of snapshotsByStartup) {
    if (predictions.length !== 5) continue;
    const predictedAt = new Date(predictions[0].predicted_at);
    const matchedInvestorIds = new Set(predictions.map(row => row.investor_id));
    const matchedOrganizationIds = new Set(predictions.map(row => organizationByInvestor.get(row.investor_id)).filter(Boolean));
    for (const horizon of horizons) {
      const horizonEnd = new Date(predictedAt.getTime() + horizon * dayMs);
      const mature = asOf >= horizonEnd;
      const eligibleEvents = (eventsByStartup.get(startupId) || []).filter(event => {
        const eventAt = new Date(event.occurred_at || event.announced_at);
        return eventAt > predictedAt && eventAt <= horizonEnd && eventAt <= asOf;
      });
      const hitParticipants = eligibleEvents.flatMap(event => (participantsByEvent.get(event.id) || []).filter(participant =>
        matchedInvestorIds.has(participant.investor_id)
        || (participant.investor_organization_id && matchedOrganizationIds.has(participant.investor_organization_id))
      ));
      rows.push({
        startup_id: startupId,
        startup_name: startupById.get(startupId)?.name || null,
        god_score: predictions[0].god_score_at_prediction,
        horizon_days: horizon,
        mature,
        funded_within_horizon: eligibleEvents.length > 0,
        hit_at_5: eligibleEvents.length > 0 ? hitParticipants.length > 0 : null,
        matched_investors_who_invested: [...new Set(hitParticipants.map(row => row.investor_name_raw))],
        funding_event_ids: eligibleEvents.map(row => row.id),
      });
    }
  }
  const metrics = horizons.map(horizon => {
    const matureRows = rows.filter(row => row.horizon_days === horizon && row.mature);
    const fundedRows = matureRows.filter(row => row.funded_within_horizon);
    const hits = fundedRows.filter(row => row.hit_at_5);
    return {
      horizon_days: horizon,
      total_snapshot_sets: rows.filter(row => row.horizon_days === horizon).length,
      mature_snapshot_sets: matureRows.length,
      pending_snapshot_sets: rows.filter(row => row.horizon_days === horizon && !row.mature).length,
      funded_startups: fundedRows.length,
      hit_startups: hits.length,
      funding_event_rate: matureRows.length ? fundedRows.length / matureRows.length : null,
      hit_at_5_among_funded: fundedRows.length ? hits.length / fundedRows.length : null,
    };
  });
  console.log(JSON.stringify({ cohort_key: cohortKey, as_of: asOf.toISOString(), metric_definition: 'A startup is a Hit@5 when at least one of its five snapshotted investors is a verified participant in a later funding round within the horizon.', metrics, resolved_outcomes: rows.filter(row => row.mature && row.funded_within_horizon) }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
