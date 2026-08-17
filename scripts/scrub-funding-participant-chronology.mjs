#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isHistoricalRoundReference, classifyNamedInvestorParticipation } = require('../server/lib/fundingParticipationOntology.js');
const { isPlausibleInvestorEntityName, normalizeEntityName } = require('../server/lib/fundingEvidenceLedger.js');
const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('funding_evidence_participants')
      .select('id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status,resolution_confidence,evidence_phrase,evidence').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const contaminated = rows.map(row => {
    const local = classifyNamedInvestorParticipation(row.evidence_phrase, row.investor_name_raw);
    const directionalPrefix = String(row.evidence_phrase || '').match(/^(.{2,160}?)\s+invests?\s+in\s+/i)?.[1] || '';
    const directionalName = directionalPrefix.split(/\bas\b/i).at(-1)?.replace(/^.*[;:]/, '').trim();
    const directionalSubjectDrift = row.investor_name_raw.includes(' as ')
      && isPlausibleInvestorEntityName(directionalName)
      && normalizeEntityName(directionalName) !== normalizeEntityName(row.investor_name_raw);
    const historical = ['lead', 'co_lead'].includes(row.participant_role) && isHistoricalRoundReference(row.evidence_phrase);
    const ambiguousBacking = Boolean(row.participation_relation) && !local.relation && /\bbacked by\b/i.test(row.evidence_phrase || '');
    const relationMismatch = Boolean(row.participation_relation && local.relation && row.participation_relation !== local.relation);
    if (!directionalSubjectDrift && !historical && !ambiguousBacking && !relationMismatch) return null;
    return {
      ...row,
      repaired_name: directionalSubjectDrift ? directionalName : row.investor_name_raw,
      repaired_role: historical || ambiguousBacking ? 'unknown' : directionalSubjectDrift ? 'participant' : local.role,
      repaired_relation: historical || ambiguousBacking ? null : directionalSubjectDrift ? 'INVESTED_IN' : local.relation,
      clear_identity: directionalSubjectDrift,
      exclusion_reason: directionalSubjectDrift ? 'directional_subject_prefix' : historical ? 'historical_round_reference' : ambiguousBacking ? 'ambiguous_backing_language' : 'local_clause_relation_mismatch',
    };
  }).filter(Boolean);
  if (apply) {
    for (const row of contaminated) {
      const update = {
        investor_name_raw: row.repaired_name,
        participant_role: row.repaired_role,
        participation_relation: row.repaired_relation,
        resolution_confidence: row.repaired_relation ? row.resolution_confidence : 0,
        evidence: { ...(row.evidence || {}), ontology_repaired: true, ontology_repair_reason: row.exclusion_reason, ontology_scrub_version: 'v2' },
        updated_at: new Date().toISOString(),
      };
      if (row.clear_identity) Object.assign(update, {
        investor_id: null,
        investor_organization_id: null,
        resolution_status: 'not_in_universe',
        resolution_confidence: 0,
      });
      const { error } = await db.from('funding_evidence_participants').update(update).eq('id', row.id);
      if (error) throw error;
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', participants_scanned: rows.length, ontology_repairs: contaminated.length, preview: contaminated.map(row => ({ id: row.id, event_id: row.funding_event_id, investor_before: row.investor_name_raw, investor_after: row.repaired_name, role_before: row.participant_role, relation_before: row.participation_relation, role_after: row.repaired_role, relation_after: row.repaired_relation, reason: row.exclusion_reason, evidence_phrase: row.evidence_phrase })) }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
