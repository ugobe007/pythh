#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEntityName, isPlausibleInvestorEntityName } = require('../server/lib/fundingEvidenceLedger.js');
const { isGarbageInvestorName, isHardJunkInvestorName } = require('../lib/investorNameHeuristics.js');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function investorLabel(row) {
  return String(row?.firm || row?.name || '').trim();
}

function eligibleInvestor(row) {
  const label = investorLabel(row);
  return isPlausibleInvestorEntityName(label) && !isGarbageInvestorName(label) && !isHardJunkInvestorName(label);
}

function uniqueTopFive(matches, investorById, membershipByInvestor) {
  const seen = new Set();
  return [...matches].sort((a, b) => Number(b.match_score || 0) - Number(a.match_score || 0)).filter(match => {
    const investor = investorById.get(match.investor_id);
    if (!eligibleInvestor(investor)) return false;
    const key = membershipByInvestor.get(match.investor_id)?.organization_id
      || normalizeEntityName(investorLabel(investor));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

function temporalStatus(topFive, eventAt) {
  if (!topFive.length) return 'no_legacy_matches';
  const before = topFive.filter(row => new Date(row.created_at) < eventAt).length;
  if (before === topFive.length) return 'all_top_five_pre_event';
  if (before > 0) return 'partial_top_five_pre_event';
  return 'event_precedes_top_five';
}

async function main() {
  console.error('[delta] loading audited events');
  const { data: events, error: eventError } = await db.from('funding_evidence_events')
    .select('id,startup_id,startup_name_raw,round_type,amount_usd,announced_at,occurred_at,source_url,verification_status,metadata')
    .eq('metadata->>audited', 'true').order('announced_at');
  if (eventError) throw eventError;
  console.error(`[delta] loaded ${(events || []).length} audited events`);
  const startupIds = [...new Set((events || []).map(row => row.startup_id).filter(Boolean))];
  const eventIds = (events || []).map(row => row.id);
  console.error('[delta] loading startups, participants, and matches');
  const [{ data: startups, error: startupError }, { data: participants, error: participantError }, { data: matches, error: matchError }] = await Promise.all([
    db.from('startup_uploads').select('id,name,total_god_score,sectors').in('id', startupIds),
    db.from('funding_evidence_participants').select('id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status,resolution_confidence,evidence_phrase').in('funding_event_id', eventIds),
    db.from('startup_investor_matches').select('id,startup_id,investor_id,match_score,algorithm_version,created_at,feature_snapshot,fit_analysis').in('startup_id', startupIds),
  ]);
  if (startupError) throw startupError;
  if (participantError) throw participantError;
  if (matchError) throw matchError;
  console.error('[delta] loaded cohort records');
  const investorIds = [...new Set([...(matches || []), ...(participants || [])].map(row => row.investor_id).filter(Boolean))];
  const investors = [];
  for (let offset = 0; offset < investorIds.length; offset += 200) {
    console.error(`[delta] loading investor profiles ${offset + 1}-${Math.min(offset + 200, investorIds.length)}`);
    const { data, error } = await db.from('investors').select('id,name,firm,sectors,stage,geography_focus,check_size_min,check_size_max,investment_thesis').in('id', investorIds.slice(offset, offset + 200));
    if (error) throw error;
    investors.push(...(data || []));
  }
  console.error('[delta] loading organization mappings');
  const memberships = [];
  for (let offset = 0; offset < investorIds.length; offset += 200) {
    const { data, error } = await db.from('investor_organization_memberships')
      .select('investor_id,organization_id,resolution_confidence')
      .in('investor_id', investorIds.slice(offset, offset + 200));
    if (error) throw error;
    memberships.push(...(data || []));
  }
  const { data: organizations, error: organizationError } = await db.from('investor_organizations')
    .select('id,canonical_name,normalized_name');
  if (organizationError) throw organizationError;
  const startupById = new Map((startups || []).map(row => [row.id, row]));
  const investorById = new Map(investors.map(row => [row.id, row]));
  const membershipByInvestor = new Map((memberships || []).map(row => [row.investor_id, row]));
  const organizationById = new Map((organizations || []).map(row => [row.id, row]));
  const participantsByEvent = new Map();
  for (const row of participants || []) {
    if (!row.participation_relation || row.participant_role === 'unknown') continue;
    participantsByEvent.set(row.funding_event_id, [...(participantsByEvent.get(row.funding_event_id) || []), row]);
  }
  const matchesByStartup = new Map();
  for (const row of matches || []) matchesByStartup.set(row.startup_id, [...(matchesByStartup.get(row.startup_id) || []), row]);

  const reports = [];
  const missReasons = {};
  for (const event of events || []) {
    const allMatches = matchesByStartup.get(event.startup_id) || [];
    const topFive = uniqueTopFive(allMatches, investorById, membershipByInvestor);
    const topIds = new Set(topFive.map(row => row.investor_id));
    const topOrganizationIds = new Set(topFive.map(row => membershipByInvestor.get(row.investor_id)?.organization_id).filter(Boolean));
    const topNames = new Set(topFive.map(row => normalizeEntityName(investorLabel(investorById.get(row.investor_id)))));
    const eventAt = new Date(event.occurred_at || event.announced_at);
    const actual = (participantsByEvent.get(event.id) || []).map(participant => {
      const normalizedRaw = normalizeEntityName(participant.investor_name_raw);
      const idHit = participant.investor_id && topIds.has(participant.investor_id);
      const organizationHit = participant.investor_organization_id && topOrganizationIds.has(participant.investor_organization_id);
      const nameHit = topNames.has(normalizedRaw);
      const anyLegacyMatch = allMatches.find(row =>
        (participant.investor_id && row.investor_id === participant.investor_id)
        || (participant.investor_organization_id
          && membershipByInvestor.get(row.investor_id)?.organization_id === participant.investor_organization_id)
      ) || null;
      let deltaReason;
      if (idHit || organizationHit || nameHit) deltaReason = 'top_five_hit';
      else if (!participant.investor_id && participant.resolution_status === 'not_in_universe') deltaReason = 'missing_from_investor_universe';
      else if (!participant.investor_id && participant.resolution_status === 'ambiguous') deltaReason = 'ambiguous_canonical_identity';
      else if (!participant.investor_id && participant.resolution_status !== 'resolved') deltaReason = 'unresolved_identity';
      else if (anyLegacyMatch) deltaReason = 'ranked_outside_top_five';
      else deltaReason = 'candidate_generation_miss';
      missReasons[deltaReason] = (missReasons[deltaReason] || 0) + 1;
      const canonical = participant.investor_id ? investorById.get(participant.investor_id) : null;
      return {
        investor_name: participant.investor_name_raw,
        role: participant.participant_role,
        relation: participant.participation_relation,
        canonical_organization: organizationById.get(participant.investor_organization_id)?.canonical_name || null,
        resolution_status: participant.resolution_status,
        delta_reason: deltaReason,
        legacy_match_score: anyLegacyMatch?.match_score ?? null,
        canonical_profile: canonical ? { sectors: canonical.sectors, stages: canonical.stage, geography: canonical.geography_focus, check_size_min: canonical.check_size_min, check_size_max: canonical.check_size_max, thesis: canonical.investment_thesis } : null,
        evidence_phrase: participant.evidence_phrase,
      };
    });
    reports.push({
      startup: startupById.get(event.startup_id)?.name || event.startup_name_raw,
      god_score: startupById.get(event.startup_id)?.total_god_score ?? null,
      startup_sectors: startupById.get(event.startup_id)?.sectors || [],
      funding_event: { round: event.round_type, amount_usd: event.amount_usd, announced_at: event.announced_at, source_url: event.source_url },
      temporal_status: temporalStatus(topFive, eventAt),
      top_five_matches: topFive.map((match, index) => ({
        rank: index + 1,
        investor: investorLabel(investorById.get(match.investor_id)),
        canonical_organization: organizationById.get(membershipByInvestor.get(match.investor_id)?.organization_id)?.canonical_name || null,
        score: match.match_score,
        created_at: match.created_at,
      })),
      actual_investors: actual,
      hit_at_5_directional: actual.some(row => row.delta_reason === 'top_five_hit'),
      comparison_is_formal: false,
    });
  }
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), methodology: 'Retrospective directional comparison only. Formal accuracy requires prospective snapshots.', events: reports.length, miss_reason_counts: missReasons, reports }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  if (error.cause) console.error('Cause:', error.cause);
  process.exitCode = 1;
});
