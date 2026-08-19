#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mergeReviewedOrganizationProfiles, profileCompleteness } = require('../server/lib/investorOrganizationProfile.js');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

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

function compactProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    firm: profile.firm,
    completeness: profileCompleteness(profile),
    sectors: profile.sectors || [],
    stage: profile.stage || [],
    geography_focus: profile.geography_focus || [],
    check_size_min: profile.check_size_min,
    check_size_max: profile.check_size_max,
    has_thesis: Boolean(profile.investment_thesis),
    portfolio_count: profile.portfolio_companies?.length || 0,
    membership_reviewed: profile.membership_reviewed,
  };
}

async function main() {
  const events = await fetchAll('funding_evidence_events', 'id,verification_status,metadata');
  const auditedEventIds = new Set(events.filter(row => row.metadata?.audited === true
    && ['verified', 'corroborated'].includes(row.verification_status)).map(row => row.id));
  const [participantRows, investors, memberships, organizations] = await Promise.all([
    fetchAll('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status'),
    fetchAll('investors', 'id,name,firm,sectors,stage,geography_focus,check_size_min,check_size_max,investment_thesis,portfolio_companies,notable_investments,investor_score,investor_tier,last_investment_date,investment_pace_per_year,leads_rounds,follows_rounds'),
    fetchAll('investor_organization_memberships', 'investor_id,organization_id,resolution_confidence,reviewed_at,resolution_method,metadata'),
    fetchAll('investor_organizations', 'id,canonical_name,normalized_name,metadata'),
  ]);
  const participants = participantRows.filter(row => auditedEventIds.has(row.funding_event_id)
    && row.participation_relation && row.participant_role !== 'unknown');
  const investorById = new Map(investors.map(row => [row.id, row]));
  const organizationById = new Map(organizations.map(row => [row.id, row]));
  const outcomeOrganizationIds = new Set(participants.map(row => row.investor_organization_id).filter(Boolean));
  const membershipsByOrganization = new Map();
  for (const membership of memberships) {
    if (!outcomeOrganizationIds.has(membership.organization_id)) continue;
    membershipsByOrganization.set(membership.organization_id, [...(membershipsByOrganization.get(membership.organization_id) || []), membership]);
  }

  const reports = [];
  for (const organizationId of outcomeOrganizationIds) {
    const organization = organizationById.get(organizationId);
    const memberProfiles = (membershipsByOrganization.get(organizationId) || []).map(membership => ({
      ...investorById.get(membership.investor_id),
      membership_reviewed: Boolean(membership.reviewed_at) && Number(membership.resolution_confidence) >= 0.95,
      membership_confidence: membership.resolution_confidence,
      membership_method: membership.resolution_method,
    })).filter(profile => profile.id);
    const merge = mergeReviewedOrganizationProfiles(memberProfiles);
    reports.push({
      organization_id: organizationId,
      canonical_name: organization?.canonical_name || null,
      proven_participations: participants.filter(row => row.investor_organization_id === organizationId).length,
      member_profiles: memberProfiles.map(compactProfile),
      reviewed_member_count: memberProfiles.filter(row => row.membership_reviewed).length,
      representative_profile: merge.representative ? compactProfile(merge.representative) : null,
      merged_profile: merge.merged ? compactProfile({ ...merge.merged, membership_reviewed: true }) : null,
      fields_gained_by_reviewed_merge: merge.fields_gained,
      field_provenance: merge.provenance,
      structural_merge_candidate: merge.fields_gained.length > 0 && memberProfiles.filter(row => row.membership_reviewed).length > 1,
    });
  }
  const resolvedIndividuals = participants.filter(row => row.investor_id && !row.investor_organization_id);
  const unresolved = participants.filter(row => !row.investor_organization_id && !row.investor_id).map(row => ({
    participant_id: row.id,
    investor_name: row.investor_name_raw,
    investor_id: row.investor_id,
    resolution_status: row.resolution_status,
  }));
  console.log(JSON.stringify({
    mode: 'read-only',
    generated_at: new Date().toISOString(),
    summary: {
      audited_events: auditedEventIds.size,
      proven_participants: participants.length,
      outcome_organizations: outcomeOrganizationIds.size,
      resolved_individual_investors: resolvedIndividuals.length,
      multi_profile_organizations: reports.filter(row => row.member_profiles.length > 1).length,
      structural_merge_candidates: reports.filter(row => row.structural_merge_candidate).length,
      unresolved_participants: unresolved.length,
    },
    organizations: reports,
    unresolved_participants: unresolved,
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
