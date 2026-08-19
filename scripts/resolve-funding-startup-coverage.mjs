#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  canonicalRoundKey,
  isPlausibleStartupName,
  resolveCanonicalStartup,
} = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
const allStatuses = process.argv.includes('--all-statuses');
const allowNameOnly = process.argv.includes('--allow-name-only');
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

function usableStartup(row) {
  return isPlausibleStartupName(row.name)
    && row.entity_gate !== 'junk'
    && !['rejected', 'deleted'].includes(String(row.status || '').toLowerCase());
}

async function main() {
  const events = await all(
    'funding_evidence_events',
    'id,source_event_id,source_url,startup_id,startup_name_raw,round_type,amount_usd,announced_at,verification_status,canonical_round_key,metadata',
    query => {
      let scoped = query.is('startup_id', null).neq('verification_status', 'rejected');
      if (!allStatuses) scoped = scoped.in('verification_status', ['verified', 'corroborated']);
      return scoped.order('announced_at', { ascending: false });
    },
  );
  const startupNames = [...new Set(events.map(event => event.startup_name_raw).filter(Boolean))];
  const startups = [];
  for (let offset = 0; offset < startupNames.length; offset += 75) {
    const { data, error } = await db.from('startup_uploads')
      .select('id,name,status,entity_gate,website,company_domain,company_website,canonical_key,extracted_data,discovery_event_id,discovery_source_url,source_url')
      .in('name', startupNames.slice(offset, offset + 75));
    if (error) throw error;
    startups.push(...(data || []));
  }

  const canonicalStartups = startups.filter(usableStartup);
  const resolutions = events.map(event => {
    const resolution = resolveCanonicalStartup(canonicalStartups, event.startup_name_raw);
    if (resolution.row) {
      const sameSourceEvent = event.source_event_id
        && String(resolution.row.discovery_event_id || '') === String(event.source_event_id);
      const startupSourceUrls = [resolution.row.discovery_source_url, resolution.row.source_url].filter(Boolean);
      const sameSourceUrl = event.source_url && startupSourceUrls.includes(event.source_url);
      if (sameSourceEvent) resolution.matchKind = 'source_event_id';
      else if (sameSourceUrl) resolution.matchKind = 'source_url';
      else resolution.matchKind = `${resolution.matchKind}_name_only`;
    }
    return { event, resolution };
  });
  const resolvable = resolutions.filter(item => item.resolution.status === 'resolved');
  const automaticallyResolvable = resolvable.filter(item => allowNameOnly || !item.resolution.matchKind.endsWith('_name_only'));
  const nameOnlyReview = resolvable.filter(item => item.resolution.matchKind.endsWith('_name_only'));
  const ambiguous = resolutions.filter(item => item.resolution.status === 'ambiguous');

  if (apply) {
    for (const { event, resolution } of automaticallyResolvable) {
      const now = new Date().toISOString();
      const { error } = await db.from('funding_evidence_events').update({
        startup_id: resolution.row.id,
        canonical_round_key: canonicalRoundKey({
          startupId: resolution.row.id,
          startupName: event.startup_name_raw,
          roundType: event.round_type,
          amountUsd: event.amount_usd,
          announcedAt: event.announced_at,
        }),
        metadata: {
          ...(event.metadata || {}),
          startup_resolution: {
            method: resolution.matchKind,
            confidence: resolution.confidence,
            canonical_name: resolution.row.name,
            resolved_at: now,
            version: 'funding-startup-resolution-v1',
          },
        },
        updated_at: now,
      }).eq('id', event.id).is('startup_id', null);
      if (error) throw error;
    }
  }

  const unresolvedCounts = new Map();
  for (const { event } of resolutions.filter(item => item.resolution.status === 'not_in_universe')) {
    const mapKey = event.startup_name_raw;
    const current = unresolvedCounts.get(mapKey) || { startup: mapKey, event_count: 0, statuses: new Set() };
    current.event_count++;
    current.statuses.add(event.verification_status);
    unresolvedCounts.set(mapKey, current);
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    scope: allStatuses ? 'all_non_rejected' : 'verified_or_corroborated',
    unresolved_events_scanned: events.length,
    resolved_events: automaticallyResolvable.length,
    name_only_review_events: nameOnlyReview.length,
    ambiguous_events: ambiguous.length,
    not_in_universe_events: resolutions.filter(item => item.resolution.status === 'not_in_universe').length,
    resolved_preview: automaticallyResolvable.slice(0, 100).map(({ event, resolution }) => ({
      event_id: event.id,
      raw_name: event.startup_name_raw,
      canonical_name: resolution.row.name,
      startup_id: resolution.row.id,
      confidence: resolution.confidence,
      method: resolution.matchKind,
      status: event.verification_status,
    })),
    name_only_review_preview: nameOnlyReview.slice(0, 100).map(({ event, resolution }) => ({
      event_id: event.id,
      raw_name: event.startup_name_raw,
      candidate_name: resolution.row.name,
      startup_id: resolution.row.id,
      method: resolution.matchKind,
      status: event.verification_status,
    })),
    ambiguous_preview: ambiguous.slice(0, 50).map(({ event }) => ({ event_id: event.id, raw_name: event.startup_name_raw })),
    missing_startups: [...unresolvedCounts.values()]
      .map(item => ({ ...item, statuses: [...item.statuses] }))
      .sort((a, b) => b.event_count - a.event_count || a.startup.localeCompare(b.startup))
      .slice(0, 100),
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
