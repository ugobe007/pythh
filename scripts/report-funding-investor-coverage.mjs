#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEntityName } = require('../server/lib/fundingEvidenceLedger.js');

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
  const [participants, events, organizations, aliases] = await Promise.all([
    all('funding_evidence_participants', 'id,funding_event_id,investor_id,investor_organization_id,investor_name_raw,participant_role,participation_relation,resolution_status,evidence_phrase'),
    all('funding_evidence_events', 'id,startup_id,startup_name_raw,round_type,amount_usd,announced_at,verification_status,source_url,canonical_round_key'),
    all('investor_organizations', 'id,canonical_name,normalized_name,website_domain'),
    all('investor_organization_aliases', 'organization_id,alias,normalized_alias'),
  ]);
  const eventById = new Map(events.map(row => [row.id, row]));
  const organizationById = new Map(organizations.map(row => [row.id, row]));
  const organizationByNormalized = new Map(organizations.map(row => [row.normalized_name, row]));
  for (const alias of aliases) {
    const organization = organizationById.get(alias.organization_id);
    if (organization) organizationByNormalized.set(alias.normalized_alias, organization);
  }

  const groups = new Map();
  const eligible = participants.filter(row => !row.investor_id && row.participation_relation && row.participant_role !== 'unknown');
  for (const participant of eligible) {
    const normalized = normalizeEntityName(participant.investor_name_raw);
    if (!normalized) continue;
    const event = eventById.get(participant.funding_event_id);
    if (!event || event.verification_status === 'rejected') continue;
    const current = groups.get(normalized) || {
      normalized_name: normalized,
      display_names: new Set(),
      event_ids: new Set(),
      startups: new Set(),
      roles: new Set(),
      relations: new Set(),
      statuses: new Set(),
      evidence: [],
      canonical_organization: organizationByNormalized.get(normalized) || null,
    };
    current.display_names.add(participant.investor_name_raw);
    current.event_ids.add(event.id);
    current.startups.add(event.startup_name_raw);
    current.roles.add(participant.participant_role);
    current.relations.add(participant.participation_relation);
    current.statuses.add(event.verification_status);
    if (current.evidence.length < 5) current.evidence.push({
      startup: event.startup_name_raw,
      announced_at: event.announced_at,
      source_url: event.source_url,
      phrase: participant.evidence_phrase,
    });
    groups.set(normalized, current);
  }

  const priority = [...groups.values()].map(item => ({
    normalized_name: item.normalized_name,
    display_names: [...item.display_names],
    event_count: item.event_ids.size,
    startup_count: item.startups.size,
    roles: [...item.roles],
    relations: [...item.relations],
    evidence_statuses: [...item.statuses],
    canonical_organization: item.canonical_organization ? {
      id: item.canonical_organization.id,
      name: item.canonical_organization.canonical_name,
      website_domain: item.canonical_organization.website_domain,
    } : null,
    next_action: item.canonical_organization ? 'create_or_map_reviewed_investor_profile' : 'review_and_create_canonical_organization',
    evidence: item.evidence,
  })).sort((a, b) => {
    const leadA = a.roles.some(role => role === 'lead' || role === 'co_lead') ? 1 : 0;
    const leadB = b.roles.some(role => role === 'lead' || role === 'co_lead') ? 1 : 0;
    return b.event_count - a.event_count || leadB - leadA || a.normalized_name.localeCompare(b.normalized_name);
  });

  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    unresolved_proven_participants: eligible.length,
    distinct_missing_investors: priority.length,
    already_have_canonical_organization: priority.filter(item => item.canonical_organization).length,
    priority,
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
