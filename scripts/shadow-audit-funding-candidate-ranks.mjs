#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { calculateMatch, selectTopInvestorCandidates, fetchAllInvestors, loadVerifiedHistoricalFeatures } = require('./matching/generate-matches.js');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const investorColumns = 'id,name,firm,url,sectors,stage,check_size_min,check_size_max,geography_focus,investor_score,investor_tier,last_investment_date,investment_pace_per_year,leads_rounds,follows_rounds,portfolio_companies,notable_investments,investment_thesis';

function thresholdFor(startup) {
  const score = startup.total_god_score || 50;
  if (score >= 80) return 25;
  if (score >= 70) return 20;
  if (score >= 60) return 18;
  if (score < 50) return 10;
  return 15;
}

function label(investor) {
  return String(investor?.firm || investor?.name || '').trim();
}

async function fetchAll(table, select) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from(table).select(select).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function main() {
  const { data: events, error: eventError } = await db.from('funding_evidence_events')
    .select('id,startup_id,startup_name_raw,announced_at,occurred_at')
    .eq('metadata->>audited', 'true').order('announced_at');
  if (eventError) throw eventError;
  const startupIds = [...new Set((events || []).map(row => row.startup_id).filter(Boolean))];
  const eventIds = (events || []).map(row => row.id);
  const [{ data: startups, error: startupError }, { data: participants, error: participantError }, investors, memberships, organizations, aliases] = await Promise.all([
    db.from('startup_uploads').select('id,name,description,sectors,stage,total_god_score,location,raise_amount,mrr,arr,growth_rate_monthly,customer_count,team_size,extracted_data').in('id', startupIds),
    db.from('funding_evidence_participants').select('id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status').in('funding_event_id', eventIds),
    fetchAllInvestors(db, investorColumns),
    fetchAll('investor_organization_memberships', 'investor_id,organization_id'),
    fetchAll('investor_organizations', 'id,canonical_name'),
    fetchAll('investor_organization_aliases', 'organization_id,normalized_alias'),
  ]);
  if (startupError) throw startupError;
  if (participantError) throw participantError;

  const startupById = new Map((startups || []).map(row => [row.id, row]));
  const investorById = new Map(investors.map(row => [row.id, row]));
  const membershipByInvestor = new Map(memberships.map(row => [row.investor_id, row.organization_id]));
  const organizationByAlias = new Map(aliases.map(row => [row.normalized_alias, row.organization_id]));
  const { normalizeEntityName } = require('../server/lib/fundingEvidenceLedger.js');
  for (const investor of investors) {
    if (membershipByInvestor.has(investor.id)) continue;
    const organizationId = [investor.firm, investor.name].map(normalizeEntityName).filter(Boolean)
      .map(value => organizationByAlias.get(value)).find(Boolean);
    if (organizationId) membershipByInvestor.set(investor.id, organizationId);
  }
  const membersByOrganization = new Map();
  for (const [investorId, organizationId] of membershipByInvestor) {
    membersByOrganization.set(organizationId, [...(membersByOrganization.get(organizationId) || []), investorId]);
  }
  const investorsByNormalizedLabel = new Map();
  for (const investor of investors) {
    for (const value of [investor.firm, investor.name]) {
      const normalized = normalizeEntityName(value);
      if (!normalized) continue;
      investorsByNormalizedLabel.set(normalized, [...(investorsByNormalizedLabel.get(normalized) || []), investor.id]);
    }
  }
  const organizationById = new Map(organizations.map(row => [row.id, row]));
  const participantsByEvent = new Map();
  for (const row of participants || []) {
    if (!row.participation_relation || row.participant_role === 'unknown') continue;
    participantsByEvent.set(row.funding_event_id, [...(participantsByEvent.get(row.funding_event_id) || []), row]);
  }

  const reports = [];
  for (const event of events || []) {
    const startup = startupById.get(event.startup_id);
    if (!startup) continue;
    const cutoffStartup = { ...startup, feature_cutoff_at: event.occurred_at || event.announced_at };
    const historicalFeatures = await loadVerifiedHistoricalFeatures(db, membershipByInvestor, cutoffStartup.feature_cutoff_at);
    for (const investor of investors) {
      const organizationId = membershipByInvestor.get(investor.id);
      investor.historical_features = historicalFeatures.get(organizationId ? `organization:${organizationId}` : `investor:${investor.id}`) || null;
    }
    const threshold = thresholdFor(cutoffStartup);
    const qualified = investors.map(investor => ({ investor, match: calculateMatch(cutoffStartup, investor) }))
      .filter(item => item.match.score > threshold);
    const firmRanked = selectTopInvestorCandidates(qualified, membershipByInvestor, investors.length);
    const rankByInvestor = new Map(firmRanked.map((item, index) => [item.investor.id, index + 1]));
    const rankByOrganization = new Map();
    firmRanked.forEach((item, index) => {
      const organizationId = membershipByInvestor.get(item.investor.id);
      if (organizationId && !rankByOrganization.has(organizationId)) rankByOrganization.set(organizationId, index + 1);
    });
    const topFiveCutoff = firmRanked[4]?.match.score ?? null;
    const actual = (participantsByEvent.get(event.id) || []).map(participant => {
      const normalizedRaw = normalizeEntityName(participant.investor_name_raw);
      const targetOrganizationId = participant.investor_organization_id
        || organizationByAlias.get(normalizedRaw)
        || (participant.investor_id ? membershipByInvestor.get(participant.investor_id) : null)
        || null;
      const organizationMembers = membersByOrganization.get(targetOrganizationId) || [];
      const exactLabelProfiles = investorsByNormalizedLabel.get(normalizedRaw) || [];
      const candidateIds = [...new Set([participant.investor_id, ...organizationMembers, ...exactLabelProfiles].filter(Boolean))];
      const ranks = candidateIds.map(id => rankByInvestor.get(id)).filter(Boolean);
      const organizationRank = targetOrganizationId ? rankByOrganization.get(targetOrganizationId) : null;
      const bestRank = organizationRank || (ranks.length ? Math.min(...ranks) : null);
      const bestMember = candidateIds.map(id => ({ id, rank: rankByInvestor.get(id), investor: investorById.get(id) }))
        .filter(row => row.rank).sort((a, b) => a.rank - b.rank)[0];
      return {
        investor: participant.investor_name_raw,
        role: participant.participant_role,
        canonical_organization: organizationById.get(targetOrganizationId)?.canonical_name || null,
        identity_resolution: participant.investor_organization_id
          ? 'canonical_organization'
          : targetOrganizationId ? 'reviewed_alias' : exactLabelProfiles.length ? 'exact_profile_label' : 'unresolved',
        candidate_profiles: candidateIds.length,
        corrected_firm_rank: bestRank,
        in_top_50: bestRank !== null && bestRank <= 50,
        in_top_5: bestRank !== null && bestRank <= 5,
        representative_profile: bestMember ? label(bestMember.investor) : null,
        representative_score: bestMember ? firmRanked[bestMember.rank - 1]?.match.score : null,
        score_gap_to_top_five: bestMember && topFiveCutoff !== null
          ? Math.round((topFiveCutoff - firmRanked[bestMember.rank - 1].match.score) * 10) / 10
          : null,
        representative_reasons: bestMember ? firmRanked[bestMember.rank - 1]?.match.reason.split('; ') : [],
        diagnosis: candidateIds.length === 0 ? 'missing_candidate_profile' : bestRank === null ? 'below_qualification_threshold' : bestRank <= 50 ? 'candidate_recovered' : 'ranked_below_top_50',
      };
    });
    reports.push({
      startup: startup.name,
      god_score: startup.total_god_score,
      investors_scored: investors.length,
      qualified_investors: qualified.length,
      unique_firms_ranked: firmRanked.length,
      top_five_cutoff: topFiveCutoff,
      corrected_top_five: firmRanked.slice(0, 5).map((item, index) => ({ rank: index + 1, investor: label(item.investor), score: item.match.score })),
      actual_investors: actual,
    });
  }
  console.log(JSON.stringify({ mode: 'shadow-read-only', generated_at: new Date().toISOString(), reports }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
