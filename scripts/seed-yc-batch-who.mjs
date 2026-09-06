#!/usr/bin/env node
/**
 * Wire a YC batch directory into the ledger with Y Combinator as "who".
 *
 * Fetches the public yc-oss batch JSON (mirror of ycombinator.com/companies).
 * Resolves startups by website host only. Creates missing uploads.
 * Writes observed (not verified) funding_evidence_events + one YC participant.
 *
 * Does NOT:
 *   - stamp verification_status=verified
 *   - mark participant_list_complete (other checks are unknown)
 *   - write investment_thesis
 *   - freeze served-first-top5 snapshots
 *   - add YC to frequentLedgerFunders
 *
 * Dry-run by default. --apply writes.
 *
 *   npm run funding:yc-batch:who
 *   npm run funding:yc-batch:who -- --apply --batch='Spring 2026'
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { supabaseResult } from '../lib/supabaseNetworkRetry.mjs';
import { resolveSupabaseRestUrl, resolveSupabaseServiceKey } from '../lib/supabaseEnv.mjs';
import { loadFundingEvidenceLedger } from '../lib/loadFundingLibs.mjs';
import {
  DEFAULT_YC_BATCH,
  YC_BATCH_WHO_VERSION,
  YC_FIRM_NAME,
  YC_OSS_BATCH_URL,
  batchToSlug,
  buildYcWhoExcerpt,
  buildYcWhoPhrase,
  buildYcWhoTitle,
  decideStartupAttach,
  namesCompatible,
  normalizeHost,
  sourceEventKey,
} from '../lib/ycBatchWho.mjs';

const require = createRequire(import.meta.url);
const { isJunkUrl, sanitiseWebsiteUrl } = require('../lib/junk-url-config.js');
const { canonicalRoundKey, resolveCanonicalEntity, isPlausibleStartupName } = loadFundingEvidenceLedger();

const apply = process.argv.includes('--apply');
const batchArg = process.argv.find((arg) => arg.startsWith('--batch='));
const batch = batchArg ? batchArg.slice('--batch='.length).trim() : DEFAULT_YC_BATCH;
const batchSlug = batchToSlug(batch);

const { url } = resolveSupabaseRestUrl();
const key = resolveSupabaseServiceKey();
const db = createClient(url, key, { auth: { persistSession: false } });

const ANNOUNCED_AT = {
  'spring-2026': '2026-03-01T00:00:00.000Z',
};

async function fetchBatchCompanies() {
  const endpoint = YC_OSS_BATCH_URL(batchSlug);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`yc-oss ${response.status} ${endpoint}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('yc-oss batch payload is not an array');
  return rows.filter((row) => row && row.name && row.slug);
}

async function allInvestors() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabaseResult(`investors page ${offset}`, () =>
      db.from('investors').select('id,name,firm,url,is_individual,type,status').range(offset, offset + 999),
    );
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows.filter((row) => !['inactive', 'rejected', 'deleted'].includes(String(row.status || '').toLowerCase()));
}

async function loadUploadsByHost() {
  const byHost = new Map();
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabaseResult(`uploads page ${offset}`, () =>
      db.from('startup_uploads')
        .select('id,name,website,company_domain,entity_gate,status')
        .range(offset, offset + 999),
    );
    for (const row of data || []) {
      const host = normalizeHost(row.website) || normalizeHost(row.company_domain);
      if (!host) continue;
      const list = byHost.get(host) || [];
      list.push(row);
      byHost.set(host, list);
    }
    if (!data || data.length < 1000) break;
  }
  return byHost;
}

function pickExistingForHost(byHost, host, companyName) {
  const list = byHost.get(host) || [];
  if (!list.length) return null;
  const compatible = list.find((row) => namesCompatible(row.name, companyName));
  return compatible || list[0];
}

async function createUpload(company, host) {
  const website = sanitiseWebsiteUrl(company.website) || `https://${host}`;
  const payload = {
    name: company.name,
    website,
    company_domain: host,
    tagline: company.one_liner || null,
    description: company.long_description || company.one_liner || null,
    location: company.all_locations || null,
    team_size: Number.isFinite(Number(company.team_size)) ? Number(company.team_size) : null,
    sectors: Array.isArray(company.industries) && company.industries.length ? company.industries : null,
    source_type: 'yc_directory',
    source_url: company.url || `https://www.ycombinator.com/companies/${company.slug}`,
    status: 'approved',
    entity_gate: 'qualified',
    extracted_data: {
      yc_batch: batch,
      yc_slug: company.slug,
      yc_who_version: YC_BATCH_WHO_VERSION,
    },
    updated_at: new Date().toISOString(),
  };
  if (!apply) return { id: `dry-run:${host}`, dry_run: true, name: company.name };
  let { data, error } = await db.from('startup_uploads').insert(payload).select('id,name,website').single();
  if (error && (String(error.message || '').includes('unique') || error.code === '23505')) {
    payload.name = `${company.name} (${host})`;
    const retry = await db.from('startup_uploads').insert(payload).select('id,name,website').single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return data;
}

async function upsertEvent(company, startupId, yc) {
  const title = buildYcWhoTitle(company.name, batch);
  const phrase = buildYcWhoPhrase(company.name, batch);
  const key = sourceEventKey(batch, company.slug);
  const announcedAt = ANNOUNCED_AT[batchSlug] || `${batchSlug.replace(/.*-/, '')}-01-01T00:00:00.000Z`;
  const roundKey = canonicalRoundKey({
    startupId,
    startupName: company.name,
    roundType: 'Seed',
    amountUsd: null,
    announcedAt,
  });
  const sourceUrl = company.url || `https://www.ycombinator.com/companies/${company.slug}`;
  if (!apply) {
    return { source_event_key: key, dry_run: true, startup_id: startupId };
  }
  const { data: event, error } = await db.from('funding_evidence_events').upsert({
    source_event_key: key,
    startup_id: startupId,
    startup_name_raw: company.name,
    financing_type: 'equity',
    round_type: 'Seed',
    amount_usd: null,
    announced_at: announcedAt,
    occurred_at: announcedAt,
    occurred_at_precision: 'month',
    canonical_round_key: roundKey,
    source_url: sourceUrl,
    source_publisher: 'Y Combinator',
    source_title: title,
    evidence_confidence: 0.9,
    verification_status: 'observed',
    extraction_version: YC_BATCH_WHO_VERSION,
    metadata: {
      yc_batch: batch,
      yc_slug: company.slug,
      issuer_first_party: true,
      hit5_claim_ready: false,
      no_served_first_top5_snapshot: true,
      participant_list_complete: false,
      who_source: 'yc_directory',
      funding_evidence_excerpt: buildYcWhoExcerpt(company, batch),
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'source_event_key' }).select('id').single();
  if (error) throw error;

  const { error: participantError } = await db.from('funding_evidence_participants').upsert({
    funding_event_id: event.id,
    investor_name_raw: YC_FIRM_NAME,
    investor_id: yc.row?.id || null,
    participant_role: 'participant',
    participation_relation: 'PARTICIPATED_IN_ROUND',
    evidence_phrase: phrase,
    resolution_status: yc.status,
    resolution_confidence: yc.confidence || 1,
    evidence: {
      extraction_version: YC_BATCH_WHO_VERSION,
      source_url: sourceUrl,
      source_publisher: 'Y Combinator',
      source_title: title,
      resolution_match_kind: yc.matchKind || null,
      yc_batch: batch,
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'funding_event_id,investor_name_raw' });
  if (participantError) throw participantError;
  return { id: event.id, source_event_key: key, startup_id: startupId };
}

async function main() {
  const companies = await fetchBatchCompanies();
  const investors = await allInvestors();
  const yc = resolveCanonicalEntity(investors, YC_FIRM_NAME);
  if (yc.status !== 'resolved' || !yc.row?.id) {
    throw new Error('Y Combinator firm profile did not resolve');
  }
  const byHost = await loadUploadsByHost();
  const stats = {
    batch,
    companies: companies.length,
    created: 0,
    reused: 0,
    skipped_junk_website: 0,
    skipped_no_website: 0,
    skipped_implausible_name: 0,
    skipped_website_taken: 0,
    events: 0,
    errors: 0,
  };
  const preview = [];

  for (const company of companies) {
    if (!isPlausibleStartupName(company.name)) {
      stats.skipped_implausible_name += 1;
      preview.push({ name: company.name, action: 'skip', reason: 'implausible_name' });
      continue;
    }
    const host = normalizeHost(company.website);
    if (!host) {
      stats.skipped_no_website += 1;
      preview.push({ name: company.name, action: 'skip', reason: 'missing_website' });
      continue;
    }
    if (isJunkUrl(company.website) || isJunkUrl(`https://${host}`)) {
      stats.skipped_junk_website += 1;
      preview.push({ name: company.name, host, action: 'skip', reason: 'junk_website' });
      continue;
    }
    const existing = pickExistingForHost(byHost, host, company.name);
    const decision = decideStartupAttach({ companyHost: host, companyName: company.name, existing });
    let startupId = null;
    try {
      if (decision.action === 'skip') {
        if (decision.reason === 'website_taken_other_name') stats.skipped_website_taken += 1;
        else if (decision.reason === 'missing_website') stats.skipped_no_website += 1;
        preview.push({ name: company.name, host, action: 'skip', reason: decision.reason, existing: existing?.name });
        continue;
      }
      if (decision.action === 'reuse') {
        startupId = decision.startupId;
        stats.reused += 1;
      } else {
        const created = await createUpload(company, host);
        startupId = created.id;
        stats.created += 1;
        if (apply && created.id) {
          const list = byHost.get(host) || [];
          list.push({ id: created.id, name: created.name, website: created.website, company_domain: host });
          byHost.set(host, list);
        }
      }
      const event = await upsertEvent(company, startupId, yc);
      stats.events += 1;
      preview.push({
        name: company.name,
        host,
        action: decision.action,
        startup_id: startupId,
        event: event.source_event_key,
        yc: `${yc.row.name}:${yc.status}`,
      });
    } catch (error) {
      stats.errors += 1;
      preview.push({ name: company.name, host, action: 'error', error: error.message });
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    version: YC_BATCH_WHO_VERSION,
    yc_investor_id: yc.row.id,
    stats,
    preview: preview.slice(0, 25),
    notes: [
      'verification_status is observed only',
      'participant_list_complete is false — YC is known, other checks are not',
      'investment_thesis is never written',
      'name-only matching is rejected',
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
