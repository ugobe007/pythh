#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEntityName, isPlausibleInvestorEntityName } = require('../server/lib/fundingEvidenceLedger.js');
const apply = process.argv.includes('--apply');
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

function domainFrom(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

function profileMatchesOrganization(profile, normalizedAliases) {
  return [profile?.name, profile?.firm].map(normalizeEntityName).filter(Boolean)
    .some(value => normalizedAliases.has(value));
}

async function main() {
  const [events, participants, investors, organizations, aliases, memberships] = await Promise.all([
    fetchAll('funding_evidence_events', 'id,verification_status,metadata'),
    fetchAll('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status,evidence'),
    fetchAll('investors', 'id,name,firm,url,is_individual,type'),
    fetchAll('investor_organizations', 'id,canonical_name,normalized_name,website_domain,metadata'),
    fetchAll('investor_organization_aliases', 'organization_id,alias,normalized_alias,source'),
    fetchAll('investor_organization_memberships', 'investor_id,organization_id,resolution_confidence,reviewed_at'),
  ]);
  const auditedEventIds = new Set(events.filter(row => row.metadata?.audited === true
    && ['verified', 'corroborated'].includes(row.verification_status)).map(row => row.id));
  const targetParticipants = participants.filter(row => auditedEventIds.has(row.funding_event_id)
    && row.participation_relation && row.participant_role !== 'unknown' && !row.investor_organization_id);
  // Participants already linked to an org, but the investor profile lacks membership —
  // Hit@5 predictions on duplicate firm rows otherwise fail to share organization keys.
  const membershipBackfillParticipants = participants.filter((row) => auditedEventIds.has(row.funding_event_id)
    && row.participation_relation && row.participant_role !== 'unknown'
    && row.investor_id && row.investor_organization_id);
  const investorById = new Map(investors.map(row => [row.id, row]));
  const organizationById = new Map(organizations.map(row => [row.id, row]));
  const membershipByInvestor = new Map(memberships.map(row => [row.investor_id, row]));
  const aliasesByOrganization = new Map();
  const organizationByAlias = new Map();
  for (const alias of aliases) {
    aliasesByOrganization.set(alias.organization_id, new Set([...(aliasesByOrganization.get(alias.organization_id) || []), alias.normalized_alias]));
    organizationByAlias.set(alias.normalized_alias, alias.organization_id);
  }
  for (const organization of organizations) {
    const names = aliasesByOrganization.get(organization.id) || new Set();
    names.add(organization.normalized_name);
    aliasesByOrganization.set(organization.id, names);
    organizationByAlias.set(organization.normalized_name, organization.id);
  }

  const membershipBackfillPlans = [];
  const seenBackfillInvestors = new Set();
  for (const participant of membershipBackfillParticipants) {
    if (seenBackfillInvestors.has(participant.investor_id)) continue;
    const existingMembership = membershipByInvestor.get(participant.investor_id);
    if (existingMembership?.organization_id === participant.investor_organization_id) continue;
    if (existingMembership && existingMembership.organization_id !== participant.investor_organization_id) {
      membershipBackfillPlans.push({
        participant,
        profile: investorById.get(participant.investor_id),
        organization_id: participant.investor_organization_id,
        action: 'withhold',
        reason: 'conflicting existing organization membership',
      });
      seenBackfillInvestors.add(participant.investor_id);
      continue;
    }
    const profile = investorById.get(participant.investor_id);
    const allowedAliases = aliasesByOrganization.get(participant.investor_organization_id) || new Set();
    if (!profile || !profileMatchesOrganization(profile, allowedAliases)) {
      membershipBackfillPlans.push({
        participant,
        profile,
        organization_id: participant.investor_organization_id,
        action: 'withhold',
        reason: 'resolved investor profile does not match reviewed organization aliases',
      });
      seenBackfillInvestors.add(participant.investor_id);
      continue;
    }
    membershipBackfillPlans.push({
      participant,
      profile,
      organization_id: participant.investor_organization_id,
      action: 'backfill_membership_from_participant',
      reason: 'participant already linked to reviewed organization; investor membership missing',
    });
    seenBackfillInvestors.add(participant.investor_id);
  }

  const plans = [];
  for (const participant of targetParticipants) {
    const profile = investorById.get(participant.investor_id);
    const raw = normalizeEntityName(participant.investor_name_raw);
    const existingMembership = profile ? membershipByInvestor.get(profile.id) : null;
    let organizationId = organizationByAlias.get(raw) || existingMembership?.organization_id || null;
    let action = 'withhold';
    let reason = 'no exact organization alias or resolved profile';
    let createOrganization = null;

    if (profile && organizationId) {
      const allowedAliases = aliasesByOrganization.get(organizationId) || new Set();
      if (existingMembership && existingMembership.organization_id !== organizationId) {
        reason = 'conflicting existing organization membership';
      } else if (!profileMatchesOrganization(profile, allowedAliases)) {
        reason = 'resolved investor profile does not match reviewed organization aliases';
      } else {
        action = 'link_existing_organization';
        reason = 'exact reviewed alias plus resolved investor profile';
      }
    } else if (profile && !organizationId) {
      const profileName = normalizeEntityName(profile.name);
      const profileFirm = normalizeEntityName(profile.firm);
      const exactFirmRow = raw && profileName === raw && profileFirm === raw && profile.is_individual !== true;
      if (exactFirmRow && isPlausibleInvestorEntityName(participant.investor_name_raw)) {
        action = 'create_and_link_organization';
        reason = 'proven participant resolves to an exact non-individual firm profile';
        createOrganization = {
          canonical_name: participant.investor_name_raw.trim(),
          normalized_name: raw,
          website_domain: domainFrom(profile.url),
        };
      } else {
        reason = 'profile is not an exact non-individual firm identity';
      }
    } else if (!profile) {
      reason = participant.resolution_status === 'not_in_universe'
        ? 'participant is not in the investor universe'
        : 'participant has no resolved investor profile';
    }
    plans.push({ participant, profile, organization_id: organizationId, create_organization: createOrganization, action, reason });
  }

  const allPlans = [...plans, ...membershipBackfillPlans];

  if (apply) {
    for (const plan of allPlans.filter(row => row.action !== 'withhold')) {
      let organizationId = plan.organization_id;
      if (plan.create_organization) {
        const now = new Date().toISOString();
        const { data: organization, error: organizationError } = await db.from('investor_organizations').upsert({
          ...plan.create_organization,
          metadata: {
            source: 'audited_funding_outcome',
            reviewed: true,
            evidence_participant_id: plan.participant.id,
          },
          updated_at: now,
        }, { onConflict: 'normalized_name' }).select('id').single();
        if (organizationError) throw organizationError;
        organizationId = organization.id;
        const { error: aliasError } = await db.from('investor_organization_aliases').upsert({
          organization_id: organizationId,
          alias: plan.create_organization.canonical_name,
          normalized_alias: plan.create_organization.normalized_name,
          source: 'audited_funding_outcome',
        }, { onConflict: 'normalized_alias' });
        if (aliasError) throw aliasError;
      }
      const now = new Date().toISOString();
      const { error: membershipError } = await db.from('investor_organization_memberships').upsert({
        investor_id: plan.profile.id,
        organization_id: organizationId,
        resolution_method: plan.action === 'backfill_membership_from_participant'
          ? 'participant_organization_membership_backfill'
          : 'exact_audited_funding_alias',
        resolution_confidence: 1,
        reviewed_at: now,
        metadata: {
          source: 'audited_funding_outcome',
          evidence_participant_id: plan.participant.id,
          preserved_historical_investor_row: true,
        },
        updated_at: now,
      }, { onConflict: 'investor_id' });
      if (membershipError) throw membershipError;
      membershipByInvestor.set(plan.profile.id, { investor_id: plan.profile.id, organization_id: organizationId });
      if (plan.action !== 'backfill_membership_from_participant') {
        const { error: participantError } = await db.from('funding_evidence_participants').update({
          investor_organization_id: organizationId,
          evidence: {
            ...(plan.participant.evidence || {}),
            organization_resolution: {
              version: 'funding-outcome-organization-repair-v1',
              method: plan.action,
              confidence: 1,
              reviewed_at: now,
            },
          },
          updated_at: now,
        }).eq('id', plan.participant.id);
        if (participantError) throw participantError;
      }
      plan.applied_organization_id = organizationId;
    }

    // Link exact firm-name investor profiles whose name/firm equal a reviewed org's
    // normalized_name (not short aliases) — predicted-side duplicates like Insight Partners.
    const linkedInvestorIds = new Set(membershipByInvestor.keys());
    const organizationByNormalized = new Map(organizations.map((row) => [row.normalized_name, row]));
    for (const investor of investors) {
      if (linkedInvestorIds.has(investor.id) || investor.is_individual === true) continue;
      const nameNorm = normalizeEntityName(investor.name);
      const firmNorm = normalizeEntityName(investor.firm);
      if (!nameNorm || nameNorm !== firmNorm) continue;
      const organization = organizationByNormalized.get(nameNorm);
      if (!organization) continue;
      const allowedAliases = aliasesByOrganization.get(organization.id) || new Set();
      if (!profileMatchesOrganization(investor, allowedAliases)) continue;
      const now = new Date().toISOString();
      const { error: membershipError } = await db.from('investor_organization_memberships').upsert({
        investor_id: investor.id,
        organization_id: organization.id,
        resolution_method: 'exact_firm_alias_prediction_side',
        resolution_confidence: 1,
        reviewed_at: now,
        metadata: {
          source: 'audited_funding_outcome',
          preserved_historical_investor_row: true,
          prediction_side_link: true,
        },
        updated_at: now,
      }, { onConflict: 'investor_id' });
      if (membershipError) throw membershipError;
      membershipByInvestor.set(investor.id, { investor_id: investor.id, organization_id: organization.id });
      linkedInvestorIds.add(investor.id);
      allPlans.push({
        participant: { id: null, investor_name_raw: investor.firm || investor.name, investor_id: investor.id },
        profile: investor,
        organization_id: organization.id,
        action: 'link_prediction_side_firm',
        reason: 'exact non-individual firm profile matches reviewed organization normalized_name',
        applied_organization_id: organization.id,
      });
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    audited_events: auditedEventIds.size,
    missing_organization_links: targetParticipants.length,
    membership_backfills: membershipBackfillPlans.filter((row) => row.action !== 'withhold').length,
    safe_links: allPlans.filter(row => row.action !== 'withhold').length,
    withheld: allPlans.filter(row => row.action === 'withhold').length,
    plans: allPlans.map(plan => ({
      participant_id: plan.participant?.id || null,
      investor_name: plan.participant?.investor_name_raw || plan.profile?.name || null,
      investor_id: plan.participant?.investor_id || plan.profile?.id || null,
      profile: plan.profile ? { name: plan.profile.name, firm: plan.profile.firm, is_individual: plan.profile.is_individual } : null,
      organization: plan.organization_id ? organizationById.get(plan.organization_id)?.canonical_name || null : plan.create_organization?.canonical_name || null,
      action: plan.action,
      reason: plan.reason,
      applied_organization_id: plan.applied_organization_id || null,
    })),
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
