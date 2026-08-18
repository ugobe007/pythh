#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import ledger from '../server/lib/fundingEvidenceLedger.js';

const require = createRequire(import.meta.url);
const { extractFunding, extractCompanyNameFromHeadline } = require('../lib/inference-extractor.js');
const { classifyNamedInvestorParticipation, extractExplicitParticipantMentions } = require('../server/lib/fundingParticipationOntology.js');
const { HORIZONS, normalizeEntityName, normalizeStartupName, isPromotionSafeStartupName, isPlausibleInvestorEntityName, startupNameCandidates, participantNamesFromEvent, classifyFundingEvidence, startupNameFromFundingEvent, eventTimestamp, evaluateRecommendationSet, canonicalRoundKey } = ledger;
const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const offsetArg = process.argv.find(arg => arg.startsWith('--offset='));
const lookbackArg = process.argv.find(arg => arg.startsWith('--lookback-days='));
const beforeArg = process.argv.find(arg => arg.startsWith('--before='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 250), 1), 10000);
const offset = Math.min(Math.max(Number(offsetArg?.split('=')[1] || 0), 0), 1_000_000);
const lookbackDays = Math.min(Number(lookbackArg?.split('=')[1] || 30), 3650);
const before = beforeArg?.slice('--before='.length) || null;
if (before && Number.isNaN(Date.parse(before))) throw new Error('--before must be an ISO-8601 timestamp');
const resolvedOnly = process.argv.includes('--resolved-only');
const equityOnly = process.argv.includes('--equity-only');
const eventIdsArg = process.argv.find(arg => arg.startsWith('--event-ids='));
const selectedEventIds = new Set((eventIdsArg?.slice('--event-ids='.length) || '').split(',').map(value => value.trim()).filter(Boolean));
const extractionVersion = 'funding-evidence-v1';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function amountUsd(amounts) {
  const values = Array.isArray(amounts) ? amounts : [amounts];
  for (const value of values) {
    const direct = Number(value?.usd ?? value?.value_usd);
    if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
    let numeric = Number(value?.value);
    const magnitude = String(value?.magnitude || '').toLowerCase();
    if (magnitude === 'b' || magnitude === 'billion') numeric *= 1_000_000_000;
    else if (magnitude === 'm' || magnitude === 'million') numeric *= 1_000_000;
    else if (magnitude === 'k' || magnitude === 'thousand') numeric *= 1_000;
    if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);
  }
  return null;
}

function eventStartupName(event) {
  return startupNameFromFundingEvent(event);
}

function buildNameIndex(rows, normalize = normalizeEntityName) {
  const index = new Map();
  for (const row of rows) {
    const aliases = Array.isArray(row.extracted_data?.aliases) ? row.extracted_data.aliases : [];
    for (const value of [row.name, row.firm, ...aliases]) {
      const normalized = normalize(value);
      if (!normalized) continue;
      const existing = index.get(normalized) || [];
      existing.push(row);
      index.set(normalized, existing);
    }
  }
  return index;
}

function resolveUnique(index, rawName) {
  const candidates = index.get(normalizeEntityName(rawName)) || [];
  return candidates.length === 1 ? { row: candidates[0], status: 'resolved', confidence: 1 }
    : candidates.length > 1 ? { row: null, status: 'ambiguous', confidence: 0 }
      : { row: null, status: 'not_in_universe', confidence: 0 };
}

async function fetchFundingEvents(since) {
  const rows = [];
  const pageSize = 1000;
  while (rows.length < limit) {
    const pageStart = rows.length;
    const start = offset + pageStart;
    const end = offset + Math.min(pageStart + pageSize, limit) - 1;
    const requested = end - start + 1;
    let query = db.from('startup_events')
      .select('id,event_id,event_type,subject,entities,amounts,round,occurred_at,source_url,source_title,source_publisher,source_published_at,frame_confidence,semantic_context,extraction_meta,created_at')
      .in('event_type', ['FUNDING', 'INVESTMENT'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (before) query = query.lte('created_at', before);
    const { data, error } = await query.range(start, end);
    if (error) throw new Error(`startup events query: ${error.message}`);
    rows.push(...(data || []));
    if (!data?.length || data.length < requested) break;
  }
  return rows;
}

async function fetchAllRows(table, select, configure = query => query) {
  const pageSize = 1000;
  const { count, error: countError } = await configure(
    db.from(table).select('*', { count: 'exact', head: true }),
  );
  if (countError) throw new Error(`${table} count: ${countError.message}`);
  if (!count) return [];
  const offsets = [];
  for (let pageOffset = 0; pageOffset < count; pageOffset += pageSize) offsets.push(pageOffset);
  const rows = [];
  for (let batchOffset = 0; batchOffset < offsets.length; batchOffset += 10) {
    const pages = await Promise.all(offsets.slice(batchOffset, batchOffset + 10).map(async pageOffset => {
      const { data, error } = await configure(db.from(table).select(select).order('id'))
        .range(pageOffset, pageOffset + pageSize - 1);
      if (error) throw new Error(`${table} query: ${error.message}`);
      return data || [];
    }));
    rows.push(...pages.flat());
  }
  return rows;
}

function resolveFirstUnique(index, names, normalize = normalizeEntityName) {
  for (const name of names) {
    const candidates = index.get(normalize(name)) || [];
    if (candidates.length === 1) return { row: candidates[0], status: 'resolved', confidence: 1, matchedName: name };
    if (candidates.length > 1) return { row: null, status: 'ambiguous', confidence: 0, matchedName: name };
  }
  return { row: null, status: 'not_in_universe', confidence: 0, matchedName: null };
}

async function upsertEvent(event, startup, startupNameRaw, participantNames, financingType, participantListComplete, inferredFunding = {}, existing = null) {
  const announcedAt = event.source_published_at || event.created_at || eventTimestamp(event);
  const occurredAt = event.occurred_at || null;
  const inferredAmount = Number(inferredFunding.funding_amount);
  const amount = Number.isFinite(inferredAmount) && inferredAmount > 0
    ? Math.round(inferredAmount)
    : amountUsd(event.amounts);
  const row = {
    source_event_id: event.id,
    source_event_key: `startup_event:${event.event_id}`,
    startup_id: startup?.id || null,
    startup_name_raw: startupNameRaw,
    financing_type: financingType,
    round_type: event.round || null,
    amount_usd: amount,
    canonical_round_key: canonicalRoundKey({ startupId: startup?.id, startupName: startupNameRaw, roundType: event.round, amountUsd: amount, announcedAt }),
    announced_at: announcedAt,
    occurred_at: occurredAt,
    occurred_at_precision: occurredAt ? 'day' : 'announcement_proxy',
    source_url: event.source_url,
    source_publisher: event.source_publisher,
    source_title: event.source_title,
    evidence_confidence: Math.max(0, Math.min(1, Number(event.frame_confidence || 0))),
    verification_status: existing?.verification_status || 'observed',
    extraction_version: extractionVersion,
    metadata: {
      ...(existing?.metadata || {}),
      participant_names_extracted: participantNames.length,
      participant_list_complete: participantListComplete || existing?.metadata?.participant_list_complete === true,
    },
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('funding_evidence_events')
    .upsert(row, { onConflict: 'source_event_key' }).select('id').single();
  if (error) throw new Error(`funding evidence upsert: ${error.message}`);
  return data.id;
}

async function evaluateEvent(fundingEventId, startupId, eventAt, participants) {
  if (!startupId) return { evaluations: 0, misses: 0 };
  const cutoff = new Date(new Date(eventAt).getTime() - 365 * 86_400_000).toISOString();
  const { data: impressions, error } = await db.from('ranking_impressions')
    .select('id, session_id, investor_id, model_version, rank_position, score, context, shown_at')
    .eq('startup_id', startupId).gte('shown_at', cutoff).lte('shown_at', eventAt).order('shown_at');
  if (error) throw new Error(`impression lookup: ${error.message}`);

  let evaluationCount = 0;
  let missCount = 0;
  const sessions = new Map();
  for (const row of impressions || []) {
    const key = `${row.session_id}\u0000${row.model_version}`;
    sessions.set(key, [...(sessions.get(key) || []), row]);
  }
  for (const rows of sessions.values()) {
    const { recommendations, misses } = evaluateRecommendationSet({ impressions: rows, participants, eventAt, topK: 5 });
    for (const recommendation of recommendations) {
      for (const horizon of recommendation.horizons) {
        const { error: evalError } = await db.from('funding_prediction_evaluations').upsert({
          funding_event_id: fundingEventId,
          session_id: recommendation.session_id,
          startup_id: startupId,
          investor_id: recommendation.investor_id,
          impression_id: recommendation.id,
          model_version: recommendation.model_version,
          rank_position: recommendation.rank_position,
          score: recommendation.score,
          predicted_probability: recommendation.predicted_probability,
          predicted_horizon_days: recommendation.predicted_horizon_days,
          shown_at: recommendation.shown_at,
          event_at: eventAt,
          days_to_event: recommendation.days_to_event,
          horizon_days: horizon,
          invested: recommendation.invested,
          participant_id: recommendation.participant_id,
          attribution_kind: recommendation.attribution_kind,
        }, { onConflict: 'funding_event_id,impression_id,horizon_days' });
        if (evalError) throw new Error(`prediction evaluation upsert: ${evalError.message}`);
        evaluationCount++;
      }
    }
    const sessionDaysToEvent = Math.min(...rows.map(row => Math.max(0, Math.floor((new Date(eventAt) - new Date(row.shown_at)) / 86_400_000))));
    const eligibleHorizons = HORIZONS.filter(horizon => sessionDaysToEvent <= horizon);
    for (const participant of misses) {
      for (const horizon of eligibleHorizons) {
        const rankedOutsideTopK = participant.investor_id && rows.some(row =>
          String(row.investor_id) === String(participant.investor_id) && row.rank_position > 5
        );
        const reason = !participant.investor_id ? 'unresolved_investor'
          : rankedOutsideTopK ? 'outside_top_k' : 'not_recommended';
        const { error: missError } = await db.from('funding_prediction_misses').upsert({
          funding_event_id: fundingEventId,
          participant_id: participant.id,
          session_id: rows[0].session_id,
          model_version: rows[0].model_version,
          horizon_days: horizon,
          reason,
        }, { onConflict: 'funding_event_id,participant_id,session_id,horizon_days' });
        if (missError) throw new Error(`prediction miss upsert: ${missError.message}`);
        missCount++;
      }
    }
  }
  return { evaluations: evaluationCount, misses: missCount };
}

async function main() {
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();
  const [events, startups, investors, existingEvidenceEvents] = await Promise.all([
    fetchFundingEvents(since),
    fetchAllRows('startup_uploads', 'id,name,status,source_type,discovery_event_id,entity_gate,lead_investor,extracted_data'),
    fetchAllRows('investors', 'id,name,firm'),
    fetchAllRows('funding_evidence_events', 'id,source_event_key,verification_status,metadata'),
  ]);
  const canonicalStartups = startups.filter(row => row.status === 'approved'
    && row.entity_gate !== 'junk'
    && normalizeStartupName(row.name).length >= 3
    && isPromotionSafeStartupName(row.name));
  const canonicalInvestors = investors
    .filter(row => isPlausibleInvestorEntityName(row.name) || isPlausibleInvestorEntityName(row.firm))
    .map(row => ({
      ...row,
      name: isPlausibleInvestorEntityName(row.name) ? row.name : null,
      firm: isPlausibleInvestorEntityName(row.firm) ? row.firm : null,
    }));
  const startupIndex = buildNameIndex(canonicalStartups, normalizeStartupName);
  const startupByEvent = new Map(canonicalStartups
    .filter(row => row.discovery_event_id && row.entity_gate !== 'junk')
    .map(row => [String(row.discovery_event_id), row]));
  const investorIndex = buildNameIndex(canonicalInvestors);
  const existingEvidenceByKey = new Map(existingEvidenceEvents.map(row => [row.source_event_key, row]));
  const preview = [];
  const resolvedPreview = [];
  let written = 0, evaluations = 0, misses = 0, eligible = 0;
  let startupsResolved = 0, eventsWithParticipants = 0, participantsResolved = 0, participantsTotal = 0;
  const skipped = {};

  for (const event of events || []) {
    if (selectedEventIds.size && !selectedEventIds.has(String(event.event_id))) continue;
    const startupName = eventStartupName(event);
    if (!startupName || !event.source_url || !eventTimestamp(event)) continue;
    const classification = classifyFundingEvidence(event);
    if (!classification.eligible) {
      skipped[classification.reason] = (skipped[classification.reason] || 0) + 1;
      continue;
    }
    if (equityOnly && !['equity', 'mixed'].includes(classification.financingType)) {
      skipped.non_equity = (skipped.non_equity || 0) + 1;
      continue;
    }
    eligible++;
    const inferredCompanyName = extractCompanyNameFromHeadline(event.source_title || '');
    const startupCandidates = startupNameCandidates(event, inferredCompanyName);
    const proposedStartupName = startupCandidates[0] || startupName;
    const linkedCandidate = startupByEvent.get(String(event.id));
    const linkedStartup = linkedCandidate && startupCandidates.some(name => normalizeStartupName(linkedCandidate.name) === normalizeStartupName(name))
      ? linkedCandidate : null;
    const startupResolution = linkedStartup
      ? { row: linkedStartup, status: 'resolved', confidence: 1 }
      : resolveFirstUnique(startupIndex, startupCandidates, normalizeStartupName);
    const preferredStartupName = startupResolution.row?.name || proposedStartupName;
    const resolverEvidence = linkedStartup?.extracted_data?.resolver || {};
    const evidenceEvent = {
      ...event,
      lead_investor: linkedStartup?.lead_investor,
      investors_mentioned: linkedStartup?.extracted_data?.investors || [],
      semantic_context: { ...(event.semantic_context || {}), resolver: resolverEvidence },
      inferred_funding: extractFunding(event.source_title || ''),
    };
    const evidenceText = event.semantic_context?.funding_evidence_excerpt || event.source_title || '';
    // A firm appearing somewhere in a long article is not evidence that it joined
    // this round. Only retain mentions whose local clause proves participation.
    const explicitMentions = extractExplicitParticipantMentions(evidenceText)
      .filter(mention => mention.relation && mention.role !== 'unknown');
    const candidateMentions = participantNamesFromEvent(evidenceEvent).map(name => ({
      investorNameRaw: name,
      ...classifyNamedInvestorParticipation(evidenceText, name),
    })).filter(mention => mention.relation && mention.role !== 'unknown');
    const mentionByNormalizedName = new Map([...candidateMentions, ...explicitMentions]
      .map(mention => [normalizeEntityName(mention.investorNameRaw), mention]));
    const names = [...new Set([...mentionByNormalizedName.values()].map(mention => mention.investorNameRaw))];
    const resolvedParticipants = names.map(name => {
      const mention = mentionByNormalizedName.get(normalizeEntityName(name));
      return { name, mention, ...resolveFirstUnique(investorIndex, [name]) };
    });
    if (startupResolution.status === 'resolved') startupsResolved++;
    if (resolvedParticipants.length) eventsWithParticipants++;
    participantsTotal += resolvedParticipants.length;
    participantsResolved += resolvedParticipants.filter(participant => participant.status === 'resolved').length;
    preview.push({ event: event.source_title, startup: preferredStartupName, startup_status: startupResolution.status, participants: resolvedParticipants.map(p => `${p.name}:${p.status}`) });
    if (startupResolution.status === 'resolved') {
      resolvedPreview.push({
        event_id: event.event_id,
        event: event.source_title,
        startup: preferredStartupName,
        startup_id: startupResolution.row.id,
        financing_type: classification.financingType,
        participants: resolvedParticipants.map(p => `${p.name}:${p.status}`),
      });
    }
    if (!apply) continue;
    if (resolvedOnly && startupResolution.status !== 'resolved') continue;

    const existingEvidence = existingEvidenceByKey.get(`startup_event:${event.event_id}`);
    const participantListComplete = resolverEvidence.participant_list_complete === true
      || existingEvidence?.metadata?.participant_list_complete === true;
    const fundingEventId = await upsertEvent(event, startupResolution.row, preferredStartupName, names, classification.financingType, participantListComplete, evidenceEvent.inferred_funding, existingEvidence);
    const participants = [];
    for (const participant of resolvedParticipants) {
      const role = participant.mention.role;
      const relation = participant.mention.relation;
      const { data, error } = await db.from('funding_evidence_participants').upsert({
        funding_event_id: fundingEventId,
        investor_name_raw: participant.name,
        investor_id: participant.row?.id || null,
        participant_role: role,
        participation_relation: relation,
        evidence_phrase: participant.mention?.evidencePhrase || event.source_title || null,
        resolution_status: participant.status,
        resolution_confidence: participant.confidence,
        evidence: { source_event_id: event.id, extraction_version: extractionVersion, resolution_match_kind: participant.matchKind },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'funding_event_id,investor_name_raw' }).select('id,investor_id').single();
      if (error) throw new Error(`participant upsert: ${error.message}`);
      participants.push(data);
    }
    const result = participantListComplete && ['equity', 'mixed'].includes(classification.financingType)
      ? await evaluateEvent(fundingEventId, startupResolution.row?.id, eventTimestamp(event), participants)
      : { evaluations: 0, misses: 0 };
    evaluations += result.evaluations;
    misses += result.misses;
    written++;
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    event_offset: offset,
    source_max_created_at: before,
    events_scanned: events?.length || 0,
    evidence_eligible: eligible,
    skipped,
    coverage: {
      startups_resolved: startupsResolved,
      startup_resolution_rate: eligible ? startupsResolved / eligible : null,
      events_with_participants: eventsWithParticipants,
      participant_extraction_rate: eligible ? eventsWithParticipants / eligible : null,
      participants_resolved: participantsResolved,
      participants_total: participantsTotal,
      participant_resolution_rate: participantsTotal ? participantsResolved / participantsTotal : null,
    },
    events_written: written,
    evaluation_rows: evaluations,
    miss_rows: misses,
    preview: preview.slice(0, 10),
    resolved_preview: resolvedPreview.slice(0, 100),
  }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
