#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEntityName } = require('../server/lib/fundingEvidenceLedger.js');
const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const organizations = [
  ['Gradient Ventures', 'gradient.com', ['Gradient', 'Gradient Ventures']],
  ['Horizon', null, ['Horizon', 'Horizon Ventures']],
  ['Y Combinator', 'ycombinator.com', ['Y Combinator', 'YC']],
  ['Citius', null, ['Citius']],
  ['BTG Pactual', 'btgpactual.com', ['BTG Pactual']],
  ['GIC', 'gic.com.sg', ['GIC']],
  ['Monashees', 'monashees.com.br', ['Monashees']],
  ['Pacific Alliance Ventures', null, ['Pacific Alliance Ventures', 'PAV']],
  ['Portage', null, ['Portage', 'Portage Ventures']],
  ['Apollo Global Management', 'apollo.com', ['Apollo', 'Apollo Global Management']],
  ['Hamilton Lane', 'hamiltonlane.com', ['Hamilton Lane']],
  ['Broadhaven Ventures', null, ['Broadhaven', 'Broadhaven Ventures']],
];

// Reviewed from the read-only reference audit. Do not infer organization membership
// merely because a noisy investor row happens to contain the same firm text.
const reviewedMemberIds = new Set([
  '16be1301-e649-4fd4-b57a-047f6b528255', // Wen-Wen Lam / Gradient Ventures; 649 matches
  '6bfdd2c0-b583-4b0f-848d-d96d4655d049', // Gradient Ventures organization row
  '1725b4a5-ca22-452d-b96b-ce80a6fec6b8', // Michael Seibel / YC; verified, 1000 matches
  '5e2fc5ff-af06-4823-929c-5b78fc83ebec', // Y Combinator organization row
  '62799323-ce23-4c8c-b43d-fc9509e477ce', // GIC organization row
  '35e2664c-2c7e-4442-829c-4f53af872d1f', // Monashees organization row
  '1eb3c02a-d8e9-4495-91e8-07d669218f1b', // Portage Ventures; referenced by matches
  '65662c8c-410a-4357-b896-122422cc670a', // Apollo Global Management; referenced by matches
]);

async function allRows(table, select) {
  const rows = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const { data, error } = await db.from(table).select(select).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function main() {
  const [investors, participants] = await Promise.all([
    allRows('investors', 'id,name,firm,url'),
    allRows('funding_evidence_participants', 'id,investor_name_raw,investor_id,investor_organization_id'),
  ]);
  const plan = organizations.map(([canonicalName, websiteDomain, aliases]) => {
    const normalizedAliases = new Set(aliases.map(normalizeEntityName));
    const aliasCandidates = investors.filter(row =>
      [row.name, row.firm].some(value => normalizedAliases.has(normalizeEntityName(value)))
    );
    const members = aliasCandidates.filter(row => reviewedMemberIds.has(row.id));
    const evidenceParticipants = participants.filter(row =>
      normalizedAliases.has(normalizeEntityName(row.investor_name_raw))
    );
    const withheldCandidates = aliasCandidates.filter(row => !reviewedMemberIds.has(row.id));
    return { canonicalName, websiteDomain, aliases, members, withheldCandidates, evidenceParticipants };
  });

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', organizations: plan.map(item => ({
      canonical_name: item.canonicalName,
      aliases: item.aliases,
      investor_rows_to_link: item.members.map(row => ({ id: row.id, name: row.name, firm: row.firm })),
      unreviewed_rows_withheld: item.withheldCandidates.map(row => ({ id: row.id, name: row.name, firm: row.firm })),
      evidence_participants_to_link: item.evidenceParticipants.map(row => ({ id: row.id, investor_name_raw: row.investor_name_raw })),
    })) }, null, 2));
    return;
  }

  const results = [];
  for (const item of plan) {
    const normalizedName = normalizeEntityName(item.canonicalName);
    const { data: organization, error: organizationError } = await db.from('investor_organizations').upsert({
      canonical_name: item.canonicalName,
      normalized_name: normalizedName,
      website_domain: item.websiteDomain,
      metadata: { source: 'audited_funding_evidence', reviewed: true },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'normalized_name' }).select('id').single();
    if (organizationError) throw organizationError;

    const aliasRows = [...new Map(item.aliases.map(alias => {
      const normalizedAlias = normalizeEntityName(alias);
      return [normalizedAlias, {
        organization_id: organization.id,
        alias,
        normalized_alias: normalizedAlias,
        source: 'audited_funding_evidence',
      }];
    })).values()];
    const { error: aliasError } = await db.from('investor_organization_aliases')
      .upsert(aliasRows, { onConflict: 'normalized_alias' });
    if (aliasError) throw aliasError;

    if (item.members.length) {
      const membershipRows = item.members.map(row => ({
        investor_id: row.id,
        organization_id: organization.id,
        resolution_method: 'exact_normalized_firm_alias',
        resolution_confidence: 1,
        reviewed_at: new Date().toISOString(),
        metadata: { preserved_historical_investor_row: true },
        updated_at: new Date().toISOString(),
      }));
      const { error: membershipError } = await db.from('investor_organization_memberships')
        .upsert(membershipRows, { onConflict: 'investor_id' });
      if (membershipError) throw membershipError;
    }

    if (item.evidenceParticipants.length) {
      const participantIds = item.evidenceParticipants.map(row => row.id);
      const { error: participantError } = await db.from('funding_evidence_participants')
        .update({ investor_organization_id: organization.id, updated_at: new Date().toISOString() })
        .in('id', participantIds);
      if (participantError) throw participantError;
    }
    results.push({ canonical_name: item.canonicalName, member_rows_linked: item.members.length, evidence_participants_linked: item.evidenceParticipants.length });
  }
  console.log(JSON.stringify({ mode: 'apply', results }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
