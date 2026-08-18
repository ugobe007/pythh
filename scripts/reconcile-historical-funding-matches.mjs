#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { classifyFundingEvidence, isPlausibleInvestorEntityName, normalizeEntityName } = require('../server/lib/fundingEvidenceLedger.js');
const { isFirmLevelOracleRow, isGarbageInvestorName, isHardJunkInvestorName } = require('../lib/investorNameHeuristics.js');

const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 5000), 1), 25000);
const summaryOnly = process.argv.includes('--summary');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

async function all(table, select, configure = query => query) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await configure(db.from(table).select(select)).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function byIds(table, select, column, ids, batchSize = 100) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    const { data, error } = await db.from(table).select(select).in(column, ids.slice(offset, offset + batchSize));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

function investorLabel(row) {
  return String(row?.firm || row?.name || '').trim();
}

function eligibleInvestor(row) {
  const label = investorLabel(row);
  const type = `${row?.type || ''} ${row?.investor_type || ''}`;
  return row && row.is_individual !== true
    && !/\b(?:angel|individual|person|founder)\b/i.test(type)
    && isPlausibleInvestorEntityName(label)
    && !isGarbageInvestorName(label)
    && !isHardJunkInvestorName(label)
    && isFirmLevelOracleRow({ name: label, firm: row.firm, url: row.url });
}

function uniqueTopFive(matches, investorById, organizationByInvestor) {
  const seen = new Set();
  return [...matches]
    .sort((a, b) => Number(b.match_score || 0) - Number(a.match_score || 0))
    .filter(match => {
      const investor = investorById.get(match.investor_id);
      if (!eligibleInvestor(investor)) return false;
      const keys = [
        organizationByInvestor.get(match.investor_id) ? `organization:${organizationByInvestor.get(match.investor_id)}` : null,
        `label:${normalizeEntityName(investorLabel(investor))}`,
      ].filter(key => key && key !== 'label:');
      if (!keys.length || keys.some(key => seen.has(key))) return false;
      keys.forEach(key => seen.add(key));
      return true;
    })
    .slice(0, 5);
}

function eventAt(row) {
  return new Date(row.occurred_at || row.announced_at);
}

function participantKeys(row) {
  const label = normalizeEntityName(row.investor_name_raw);
  return [
    row.investor_organization_id ? `organization:${row.investor_organization_id}` : null,
    row.investor_id ? `investor:${row.investor_id}` : null,
    label ? `label:${label}` : null,
  ].filter(Boolean);
}

function firmLevelParticipant(row, investorById) {
  const investor = investorById.get(row.investor_id);
  if (investor) return eligibleInvestor(investor);
  const label = String(row.investor_name_raw || '').trim();
  return isPlausibleInvestorEntityName(label)
    && !isGarbageInvestorName(label)
    && !isHardJunkInvestorName(label)
    && isFirmLevelOracleRow({ name: label, firm: label });
}

function matchKeys(row, organizationByInvestor, investorById) {
  const investor = investorById.get(row.investor_id);
  const label = normalizeEntityName(investorLabel(investor));
  return [
    `investor:${row.investor_id}`,
    organizationByInvestor.get(row.investor_id) ? `organization:${organizationByInvestor.get(row.investor_id)}` : null,
    label ? `label:${label}` : null,
  ].filter(Boolean);
}

function validFundingEvent(row) {
  return row.startup_id && ['verified', 'corroborated'].includes(row.verification_status)
    && classifyFundingEvidence({
      event_type: 'FUNDING', source_title: row.source_title, frame_confidence: 1,
      extraction_meta: { decision: 'ACCEPT', graph_safe: true },
    }).eligible;
}

function groupRounds(events, participantsByEvent) {
  const groups = new Map();
  for (const event of events.filter(validFundingEvent)) {
    const key = event.canonical_round_key || `event:${event.id}`;
    const current = groups.get(key) || { key, events: [], participants: [] };
    current.events.push(event);
    current.participants.push(...(participantsByEvent.get(event.id) || []));
    groups.set(key, current);
  }
  return [...groups.values()].map(group => {
    const earliestEvent = [...group.events].sort((a, b) => eventAt(a) - eventAt(b))[0];
    const uniqueParticipants = new Map();
    for (const participant of group.participants) {
      if (!participant.participation_relation || participant.participant_role === 'unknown') continue;
      const key = participantKeys(participant)[0] || `raw:${normalizeEntityName(participant.investor_name_raw)}`;
      if (key && !uniqueParticipants.has(key)) uniqueParticipants.set(key, participant);
    }
    return {
      ...group,
      event: earliestEvent,
      participants: [...uniqueParticipants.values()],
      participant_list_complete: group.events.some(row => row.metadata?.participant_list_complete === true),
    };
  });
}

async function main() {
  const [events, participants, investors, memberships, organizations] = await Promise.all([
    all('funding_evidence_events', 'id,startup_id,startup_name_raw,canonical_round_key,announced_at,occurred_at,verification_status,source_url,source_title,metadata', query => query.in('verification_status', ['verified', 'corroborated']).limit(limit)),
    all('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status,evidence_phrase'),
    all('investors', 'id,name,firm,url,is_individual,type,investor_type'),
    all('investor_organization_memberships', 'investor_id,organization_id'),
    all('investor_organizations', 'id,canonical_name'),
  ]);
  const participantsByEvent = new Map();
  for (const row of participants) participantsByEvent.set(row.funding_event_id, [...(participantsByEvent.get(row.funding_event_id) || []), row]);
  const rounds = groupRounds(events, participantsByEvent);
  const startupIds = [...new Set(rounds.map(row => row.event.startup_id))];
  const [startups, matches] = await Promise.all([
    byIds('startup_uploads', 'id,name,total_god_score,sectors', 'id', startupIds, 150),
    byIds('startup_investor_matches', 'id,startup_id,investor_id,match_score,algorithm_version,created_at,updated_at,feature_snapshot', 'startup_id', startupIds, 20),
  ]);
  const startupById = new Map(startups.map(row => [row.id, row]));
  const investorById = new Map(investors.map(row => [row.id, row]));
  const organizationById = new Map(organizations.map(row => [row.id, row]));
  const organizationByInvestor = new Map(memberships.map(row => [row.investor_id, row.organization_id]));
  const matchesByStartup = new Map();
  for (const row of matches) matchesByStartup.set(row.startup_id, [...(matchesByStartup.get(row.startup_id) || []), row]);

  const reasonCounts = {};
  const reports = [];
  for (const round of rounds) {
    const cutoff = eventAt(round.event);
    const allMatches = matchesByStartup.get(round.event.startup_id) || [];
    const preEventMatches = allMatches.filter(row => new Date(row.created_at) < cutoff);
    const postEventMatches = allMatches.filter(row => new Date(row.created_at) >= cutoff);
    const topFive = uniqueTopFive(preEventMatches, investorById, organizationByInvestor);
    const topKeys = new Set(topFive.flatMap(row => matchKeys(row, organizationByInvestor, investorById)));
    const firmParticipants = round.participants.filter(participant => firmLevelParticipant(participant, investorById));
    const actual = firmParticipants.map(participant => {
      const keys = participantKeys(participant);
      const topHit = keys.some(key => topKeys.has(key));
      const preMatch = preEventMatches.find(match => matchKeys(match, organizationByInvestor, investorById).some(key => keys.includes(key))) || null;
      const postMatch = postEventMatches.find(match => matchKeys(match, organizationByInvestor, investorById).some(key => keys.includes(key))) || null;
      let reason;
      if (!keys.length) reason = 'unresolved_actual_investor';
      else if (topHit) reason = 'top_five_hit';
      else if (preMatch) reason = 'ranked_outside_top_five';
      else if (postMatch) reason = 'post_event_match_not_prediction';
      else reason = 'candidate_generation_miss';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      return {
        investor_name: participant.investor_name_raw,
        canonical_organization: organizationById.get(participant.investor_organization_id)?.canonical_name || null,
        role: participant.participant_role,
        relation: participant.participation_relation,
        resolution_status: participant.resolution_status,
        delta_reason: reason,
        historical_match_score: preMatch?.match_score ?? null,
      };
    });
    const hit = actual.some(row => row.delta_reason === 'top_five_hit');
    const resolvedActual = actual.filter(row => row.delta_reason !== 'unresolved_actual_investor');
    const outcome = !topFive.length ? 'censored_no_pre_event_top_five'
      : !resolvedActual.length ? 'unresolved_actual_investors'
        : hit ? 'directional_hit_at_5'
          : round.participant_list_complete ? 'auditable_miss_at_5'
            : 'directional_miss_incomplete_participant_list';
    reports.push({
      canonical_round_key: round.key,
      startup_id: round.event.startup_id,
      startup: startupById.get(round.event.startup_id)?.name || round.event.startup_name_raw,
      god_score: startupById.get(round.event.startup_id)?.total_god_score ?? null,
      event_at: cutoff.toISOString(),
      source_count: round.events.length,
      participant_list_complete: round.participant_list_complete,
      excluded_non_firm_participants: round.participants.length - firmParticipants.length,
      pre_event_match_count: preEventMatches.length,
      outcome,
      top_five_matches: topFive.map((match, index) => ({
        rank: index + 1,
        investor: investorLabel(investorById.get(match.investor_id)),
        canonical_organization: organizationById.get(organizationByInvestor.get(match.investor_id))?.canonical_name || null,
        score: match.match_score,
        algorithm_version: match.algorithm_version,
        match_created_at: match.created_at,
      })),
      actual_investors: actual,
    });
  }

  const evaluable = reports.filter(row => !row.outcome.startsWith('censored_') && row.outcome !== 'unresolved_actual_investors');
  const directionalHits = evaluable.filter(row => row.outcome === 'directional_hit_at_5').length;
  const auditable = reports.filter(row => ['directional_hit_at_5', 'auditable_miss_at_5'].includes(row.outcome));
  const payload = {
    generated_at: new Date().toISOString(),
    methodology: 'Retrospective directional reconstruction. Only matches created before each funding event are eligible. Legacy scores may have been updated later, so this is diagnostic evidence, not prospective accuracy.',
    totals: {
      verified_source_events: events.filter(validFundingEvent).length,
      canonical_funding_rounds: rounds.length,
      startups_with_verified_rounds: startupIds.length,
      rounds_with_pre_event_top_five: reports.filter(row => row.top_five_matches.length === 5).length,
      rounds_with_resolved_actual_investors: reports.filter(row => row.actual_investors.some(item => item.delta_reason !== 'unresolved_actual_investor')).length,
      directional_hits_at_5: directionalHits,
      auditable_misses_at_5: reports.filter(row => row.outcome === 'auditable_miss_at_5').length,
      incomplete_directional_misses: reports.filter(row => row.outcome === 'directional_miss_incomplete_participant_list').length,
      censored_rounds: reports.filter(row => row.outcome.startsWith('censored_')).length,
    },
    directional_hit_rate_at_5: evaluable.length ? directionalHits / evaluable.length : null,
    audited_hit_rate_at_5: auditable.length ? directionalHits / auditable.length : null,
    actual_investor_delta_reasons: reasonCounts,
    ...(summaryOnly ? {
      examples: reports.filter(row => row.top_five_matches.length === 5).slice(0, 10),
    } : { reports }),
  };
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
