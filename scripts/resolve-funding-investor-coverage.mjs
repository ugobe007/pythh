#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEntityName, resolveCanonicalEntity, stripInvestorHeadlineNoise } = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
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

async function main() {
  const [participants, investors, organizations, aliases, memberships] = await Promise.all([
    all('funding_evidence_participants', 'id,investor_name_raw,participant_role,participation_relation,resolution_status,resolution_confidence', query => query.is('investor_id', null).not('participation_relation', 'is', null).neq('participant_role', 'unknown')),
    all('investors', 'id,name,firm,status,is_verified,is_individual'),
    all('investor_organizations', 'id,canonical_name,normalized_name,status'),
    all('investor_organization_aliases', 'organization_id,alias,normalized_alias'),
    all('investor_organization_memberships', 'investor_id,organization_id,resolution_confidence'),
  ]);
  const activeInvestors = investors.filter(row => !['inactive', 'rejected', 'deleted'].includes(String(row.status || '').toLowerCase()));
  const organizationByNormalized = new Map(organizations.map(row => [row.normalized_name, row]));
  const organizationById = new Map(organizations.map(row => [row.id, row]));
  for (const alias of aliases) {
    const organization = organizationById.get(alias.organization_id);
    if (organization) organizationByNormalized.set(alias.normalized_alias, organization);
  }
  const membershipsByOrganization = new Map();
  const membershipByInvestor = new Map();
  for (const membership of memberships) {
    membershipByInvestor.set(membership.investor_id, membership);
    membershipsByOrganization.set(membership.organization_id, [...(membershipsByOrganization.get(membership.organization_id) || []), membership]);
  }

  const plan = participants.map(participant => {
    const direct = resolveCanonicalEntity(activeInvestors, participant.investor_name_raw);
    if (direct.row) {
      const membership = membershipByInvestor.get(direct.row.id);
      return { participant, investor: direct.row, organization: organizationById.get(membership?.organization_id) || null, method: direct.matchKind, confidence: direct.confidence };
    }
    const organization = organizationByNormalized.get(normalizeEntityName(participant.investor_name_raw));
    const organizationMemberships = organization ? membershipsByOrganization.get(organization.id) || [] : [];
    if (organizationMemberships.length === 1) {
      const investor = activeInvestors.find(row => row.id === organizationMemberships[0].investor_id);
      if (investor) return { participant, investor, organization, method: 'unique_canonical_organization_member', confidence: 1 };
    }
    return { participant, investor: null, organization: organization || null, method: organizationMemberships.length > 1 ? 'ambiguous_organization_members' : null, confidence: 0 };
  });

  // Short aliases like "Menlo" → "Menlo Ventures" resolve as method=normalized (0.92).
  // Apply only when the matched profile is a firm and expands/equals the raw label.
  const isFirmSafeNormalized = (item) => {
    const method = String(item.method || '');
    if (!/^(?:headline_cleaned_)?normalized(?:_firm_preferred)?$/.test(method)) return false;
    const inv = item.investor;
    if (!inv || inv.is_individual === true) return false;
    const raw = String(item.participant.investor_name_raw || '').trim();
    const cleaned = stripInvestorHeadlineNoise(raw);
    const label = String(cleaned || raw).trim().toLowerCase();
    const name = String(inv.name || '').trim().toLowerCase();
    const firm = String(inv.firm || '').trim().toLowerCase();
    if (!label) return false;
    if (name === label || firm === label) return true;
    // Short alias expands to "Label Ventures/Capital/…"
    if (name.startsWith(`${label} `) || firm.startsWith(`${label} `)) return true;
    // Longer raw collapses to shorter canonical firm ("EQT Ventures" → "EQT").
    if ((name && label.startsWith(`${name} `)) || (firm && label.startsWith(`${firm} `))) return true;
    // Do NOT treat "Circle Ventures" ≈ "Circle Partners" (same core after suffix strip).
    // Only allow suffix-stripped equality when the raw label itself has no org token
    // (e.g. "Menlo" → "Menlo Ventures", "F-Prime" → "F-Prime Capital").
    const rawHasOrgToken = /\b(?:ventures?|capital|partners?|fund)\b/i.test(label);
    if (rawHasOrgToken) return false;
    const labelNorm = normalizeEntityName(label);
    const nameNorm = normalizeEntityName(name);
    const firmNorm = normalizeEntityName(firm);
    const hasOrgToken = /\b(?:ventures?|capital|partners?|fund)\b/i.test(`${inv.name || ''} ${inv.firm || ''}`);
    return Boolean(hasOrgToken && labelNorm && (nameNorm === labelNorm || firmNorm === labelNorm));
  };

  // Funding outcomes become training labels. Apply exact identities, firm-preferred
  // disambiguation (partner/person collisions), headline-cleaned firm matches
  // ("Firm - Publisher" / "Person’s Firm"), firm-safe normalized short aliases,
  // or a unique reviewed organization membership.
  const resolvable = plan.filter(item => item.investor && (
    item.confidence === 1
    || item.method === 'exact_firm_preferred'
    || item.method === 'normalized_firm_preferred'
    || item.method === 'unique_canonical_organization_member'
    || /^headline_cleaned_(?:exact|exact_firm_preferred|normalized|normalized_firm_preferred)$/.test(String(item.method || ''))
    || isFirmSafeNormalized(item)
  ));

  if (apply) {
    for (const item of resolvable) {
      const { error } = await db.from('funding_evidence_participants').update({
        investor_id: item.investor.id,
        investor_organization_id: item.organization?.id || null,
        resolution_status: 'resolved',
        resolution_confidence: item.confidence,
        updated_at: new Date().toISOString(),
      }).eq('id', item.participant.id).is('investor_id', null);
      if (error) throw error;
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    unresolved_proven_participants: participants.length,
    resolved_existing_profiles: resolvable.length,
    remaining_unresolved: participants.length - resolvable.length,
    preview: resolvable.map(item => ({
      participant_id: item.participant.id,
      raw_name: item.participant.investor_name_raw,
      investor_id: item.investor.id,
      investor_name: item.investor.firm || item.investor.name,
      organization: item.organization?.canonical_name || null,
      method: item.method,
      confidence: item.confidence,
    })),
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
