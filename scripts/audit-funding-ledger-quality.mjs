#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { classifyFundingEvidence } = require('../server/lib/fundingEvidenceLedger.js');
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');

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

function increment(bucket, key) { bucket[key] = (bucket[key] || 0) + 1; }

async function main() {
  const [events, participants, snapshots] = await Promise.all([
    all('funding_evidence_events', 'id,startup_id,startup_name_raw,financing_type,round_type,amount_usd,announced_at,occurred_at,occurred_at_precision,source_url,source_publisher,source_title,verification_status,canonical_round_key,metadata'),
    all('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status,evidence_phrase'),
    all('funding_prediction_snapshots', 'cohort_key,startup_id,investor_id,rank_position,predicted_at'),
  ]);
  const participantsByEvent = new Map();
  for (const row of participants) participantsByEvent.set(row.funding_event_id, [...(participantsByEvent.get(row.funding_event_id) || []), row]);
  const statusCounts = {}, sourceTiers = {}, issueCounts = {}, samples = [];
  let linkedStartups = 0, evaluableEvents = 0, trustedEvents = 0;
  for (const event of events) {
    increment(statusCounts, event.verification_status || 'missing');
    const trust = assessFundingSource(event);
    increment(sourceTiers, trust.tier);
    if (trust.trusted) trustedEvents++;
    if (event.startup_id) linkedStartups++;
    const eventParticipants = participantsByEvent.get(event.id) || [];
    const validParticipants = eventParticipants.filter(row => row.investor_id && row.participation_relation && row.participant_role !== 'unknown');
    const classification = classifyFundingEvidence({ event_type: 'FUNDING', source_title: event.source_title, frame_confidence: 1, extraction_meta: { decision: 'ACCEPT', graph_safe: true } });
    const issues = [];
    if (!classification.eligible) issues.push(`classification:${classification.reason}`);
    if (!event.startup_id) issues.push('unresolved_startup');
    if (!event.amount_usd) issues.push('missing_usd_amount');
    if (!event.round_type) issues.push('missing_round_type');
    if (!event.occurred_at || event.occurred_at_precision === 'announcement_proxy') issues.push('announcement_date_only');
    if (!eventParticipants.length) issues.push('no_participants');
    else if (!validParticipants.length) issues.push('no_resolved_proven_participants');
    if (!event.source_url) issues.push('missing_source');
    if (!event.canonical_round_key) issues.push('missing_round_key');
    for (const issue of issues) increment(issueCounts, issue);
    const hasPriorSet = snapshots.some(row => row.startup_id === event.startup_id && new Date(row.predicted_at) < new Date(event.announced_at));
    if (event.startup_id && validParticipants.length && hasPriorSet && ['verified', 'corroborated'].includes(event.verification_status)) evaluableEvents++;
    if (issues.length && samples.length < 30) samples.push({ id: event.id, startup: event.startup_name_raw, status: event.verification_status, source: trust.identity, issues, title: event.source_title });
  }
  const snapshotSets = new Map();
  for (const row of snapshots) snapshotSets.set(`${row.cohort_key}:${row.startup_id}`, [...(snapshotSets.get(`${row.cohort_key}:${row.startup_id}`) || []), row]);
  const completeSets = [...snapshotSets.values()].filter(rows => rows.length === 5 && new Set(rows.map(row => row.rank_position)).size === 5).length;
  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    totals: { events: events.length, participants: participants.length, prospective_snapshot_sets: snapshotSets.size, complete_top_five_sets: completeSets },
    evidence_value: { linked_startup_events: linkedStartups, trusted_source_events: trustedEvents, formally_evaluable_events: evaluableEvents },
    verification_status: statusCounts, source_tiers: sourceTiers, issue_counts: issueCounts, issue_samples: samples,
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
