#!/usr/bin/env node
/**
 * Funding-event researchers — structured intelligence from trusted announcements.
 *
 * Four specialists (round economics, why funded, problem/team, participation)
 * read funding_evidence_events + participants and write:
 *   - metadata.funding_intelligence (full briefing)
 *   - amount_usd / round_type only when those columns are still null
 *   - pythh_signal_events for team/product/problem when a pythh_entities row exists
 *
 * Does NOT:
 *   - retune GOD / fit weights
 *   - overwrite investment_thesis, bio, or check size
 *   - create pythh_entities
 *   - call Anthropic / OpenAI unless --provider=cascade and the briefing is empty
 *
 * Dry-run by default. --apply writes.
 *
 * Duplicate raises (same startup + amount within 5 days) keep the richest
 * headline (purpose / valuation), not the newest roundup copy. The canonical
 * row stores the briefing; siblings get metadata.raise_cluster pointers.
 *
 *   npm run funding:research
 *   npm run funding:research -- --apply --limit=100
 *
 * Safe from repo root or site/ (Vite cwd). Always loads root .env.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import {
  FUNDING_INTEL_VERSION,
  researchFundingEvent,
  eventPatchFromBriefing,
  briefingHasSignal,
  selectResearchEvents,
  raiseClusterPatches,
  uniquePreview,
  formatPreviewRow,
} from '../lib/fundingEventResearchers.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(repoRoot);
dotenv.config({ path: path.join(repoRoot, '.env') });

const require = createRequire(import.meta.url);
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const { buildSignalEvent } = require('../lib/signalEventBuilder.js');

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');
const jsonOut = process.argv.includes('--json');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const eventIdsArg = process.argv.find((arg) => arg.startsWith('--event-ids='));
const providerArg = process.argv.find((arg) => arg.startsWith('--provider='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 80), 1), 2000);
const selectedEventIds = new Set(
  (eventIdsArg?.slice('--event-ids='.length) || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const provider = providerArg?.split('=')[1] || 'free';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const TRUSTED_STATUSES = new Set(['verified', 'corroborated']);
const REJECTED_STATUSES = new Set(['rejected', 'junk', 'false_positive']);

async function pageSelect(table, columns, build) {
  const out = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    let query = db.from(table).select(columns).range(offset, offset + pageSize - 1);
    if (build) query = build(query);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

function eventEligible(event) {
  if (REJECTED_STATUSES.has(event.verification_status)) return false;
  if (TRUSTED_STATUSES.has(event.verification_status)) return true;
  return assessFundingSource(event).trusted;
}

function alreadyResearched(event) {
  const meta = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  if (force) return false;
  return meta.funding_intelligence_version === FUNDING_INTEL_VERSION;
}

async function loadEntitiesByUpload(startupIds) {
  const map = new Map();
  if (!startupIds.length) return map;
  for (let offset = 0; offset < startupIds.length; offset += 200) {
    const chunk = startupIds.slice(offset, offset + 200);
    const { data, error } = await db
      .from('pythh_entities')
      .select('id, startup_upload_id')
      .in('startup_upload_id', chunk);
    if (error) throw error;
    for (const row of data || []) {
      if (row.startup_upload_id) map.set(row.startup_upload_id, row.id);
    }
  }
  return map;
}

function signalFromBriefing(entityId, event, briefing) {
  const rows = [];
  const detectedAt = event.announced_at || event.occurred_at || event.created_at || new Date().toISOString();
  const specs = [];
  if (briefing.startup?.problem || briefing.startup?.value_proposition) {
    specs.push({
      primary_signal: 'product_signal',
      raw: briefing.startup.problem || briefing.startup.value_proposition,
      tag: 'research_problem',
    });
  }
  if (briefing.startup?.founders?.length || briefing.startup?.has_technical_cofounder) {
    specs.push({
      primary_signal: 'hiring_signal',
      raw: briefing.startup.founders?.length
        ? `Founders cited: ${briefing.startup.founders.join(', ')}`
        : 'Technical cofounder cited in the raise announcement',
      tag: 'research_team',
    });
  }
  if (briefing.round?.amount_usd || briefing.round?.valuation_usd) {
    specs.push({
      primary_signal: 'fundraising_signal',
      raw: [
        briefing.round.amount_usd ? `raised ${briefing.round.amount_usd}` : null,
        briefing.round.valuation_usd ? `valued ${briefing.round.valuation_usd}` : null,
      ].filter(Boolean).join(' · '),
      tag: 'research_round',
    });
  }
  for (const spec of specs) {
    const row = buildSignalEvent({
      primary_signal: spec.primary_signal,
      signal_type: 'funding_intelligence',
      signal_strength: 0.62,
      confidence: 0.64,
      evidence_quality: TRUSTED_STATUSES.has(event.verification_status) ? 'observed' : 'inferred',
      raw_text: String(spec.raw || '').slice(0, 400),
      inference: { likely_stage: briefing.round?.round_type || event.round_type || null, likely_need: [], urgency: null },
      _actions: [{ action_tag: spec.tag, meaning: spec.tag }],
    }, {
      entityId,
      rawSentence: String(spec.raw || '').slice(0, 240),
      sourceType: 'news_article',
      source: 'funding-event-researchers',
      sourceUrl: event.source_url || null,
      detectedAt,
    });
    if (row) rows.push(row);
  }
  return rows;
}

async function main() {
  const mode = apply ? 'apply' : 'dry-run';
  console.log(`funding-research  ${mode}  version=${FUNDING_INTEL_VERSION}  limit=${limit}  provider=${provider}`);
  if (provider === 'cascade') {
    console.log('   cascade is last-resort only; free researchers run first. Paid fill is skipped unless a briefing is empty AND a key is set.');
  }

  const eventColumns = 'id,startup_id,startup_name_raw,verification_status,source_url,source_publisher,source_title,announced_at,occurred_at,created_at,round_type,amount_usd,metadata';
  const events = [];
  let clusters = [];
  const stats = {
    scanned: 0,
    skipped_untrusted: 0,
    skipped_already: 0,
    skipped_duplicate: 0,
    clusters: 0,
    siblings_pointed: 0,
    skipped_empty: 0,
    why_found: 0,
    unique_startups: 0,
    briefings: 0,
    amount_filled: 0,
    signal_events: 0,
    paid_skipped: 0,
    errors: 0,
  };

  if (selectedEventIds.size) {
    const rawEvents = await pageSelect('funding_evidence_events', eventColumns, (q) => q.in('id', [...selectedEventIds]));
    for (const event of rawEvents) {
      stats.scanned += 1;
      if (!eventEligible(event)) { stats.skipped_untrusted += 1; continue; }
      if (alreadyResearched(event)) { stats.skipped_already += 1; continue; }
      events.push(event);
    }
    if (events.length) {
      clusters = selectResearchEvents(events, { limit: events.length, isDone: () => false }).clusters;
    }
  } else {
    const pageSize = 200;
    let offset = 0;
    const candidates = [];
    while (true) {
      const { data, error } = await db
        .from('funding_evidence_events')
        .select(eventColumns)
        .in('verification_status', ['verified', 'corroborated'])
        .not('source_title', 'is', null)
        .order('announced_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (!data?.length) break;
      for (const event of data) {
        stats.scanned += 1;
        if (!eventEligible(event)) { stats.skipped_untrusted += 1; continue; }
        candidates.push(event);
      }
      const pending = selectResearchEvents(candidates, { limit, isDone: alreadyResearched });
      if (pending.selected.length >= limit || data.length < pageSize) break;
      offset += pageSize;
    }
    const selection = selectResearchEvents(candidates, {
      limit,
      isDone: alreadyResearched,
    });
    stats.skipped_already = selection.skipped_already;
    stats.skipped_duplicate = selection.skipped_duplicate;
    clusters = selection.clusters;
    stats.clusters = clusters.length;
    events.push(...selection.selected);
  }

  const eventIds = events.map((row) => row.id);
  const participantsByEvent = new Map();
  for (let offset = 0; offset < eventIds.length; offset += 200) {
    const chunk = eventIds.slice(offset, offset + 200);
    if (!chunk.length) break;
    const { data, error } = await db
      .from('funding_evidence_participants')
      .select('id,funding_event_id,investor_id,investor_name_raw,participant_role,resolution_status,evidence_phrase')
      .in('funding_event_id', chunk);
    if (error) throw error;
    for (const row of data || []) {
      const list = participantsByEvent.get(row.funding_event_id) || [];
      list.push(row);
      participantsByEvent.set(row.funding_event_id, list);
    }
  }

  const startupIds = [...new Set(events.map((row) => row.startup_id).filter(Boolean))];
  const entityByUpload = await loadEntitiesByUpload(startupIds);

  const preview = [];
  const briefingById = new Map();
  const signalInserts = [];

  for (const event of events) {
    const participants = participantsByEvent.get(event.id) || [];
    const briefing = researchFundingEvent(event, participants);
    briefingById.set(event.id, briefing);
    if (provider === 'cascade' && !briefingHasSignal(briefing)) {
      stats.paid_skipped += 1;
    }
    if (!briefingHasSignal(briefing)) {
      stats.skipped_empty += 1;
      continue;
    }
    stats.briefings += 1;
    if (!event.amount_usd && briefing.round?.amount_usd) stats.amount_filled += 1;
    if (briefing.why?.primary && briefing.why.primary !== 'unspecified') stats.why_found += 1;
    preview.push({
      event_id: event.id,
      startup: event.startup_name_raw,
      amount_usd: briefing.round.amount_usd,
      amount_raw: briefing.round.amount_raw,
      currency: briefing.round.currency,
      valuation_usd: briefing.round.valuation_usd,
      round_type: briefing.round.round_type,
      why: briefing.why.primary,
      problem: briefing.startup.problem,
      founders: briefing.startup.founders,
      lead: briefing.syndicate.lead?.name || null,
      completeness: briefing.completeness.score,
    });

    const entityId = event.startup_id ? entityByUpload.get(event.startup_id) : null;
    if (entityId) {
      signalInserts.push(...signalFromBriefing(entityId, event, briefing));
    }
  }

  const updatesById = new Map();
  for (const cluster of clusters) {
    const briefing = briefingById.get(cluster.canonical?.id) || null;
    for (const patch of raiseClusterPatches(cluster, briefing)) {
      updatesById.set(patch.id, patch);
    }
  }
  for (const event of events) {
    if (updatesById.has(event.id)) continue;
    const briefing = briefingById.get(event.id);
    if (briefing) updatesById.set(event.id, { id: event.id, ...eventPatchFromBriefing(event, briefing) });
  }
  const eventUpdates = [...updatesById.values()];
  stats.siblings_pointed = eventUpdates.filter((row) => row.metadata?.raise_cluster?.role === 'sibling').length;
  stats.clusters = clusters.length;
  stats.signal_events = signalInserts.length;
  stats.unique_startups = new Set(events.map((row) => String(row.startup_name_raw || '').toLowerCase())).size;

  if (apply) {
    for (const row of eventUpdates) {
      const { id, ...fields } = row;
      const { error } = await db.from('funding_evidence_events').update({
        ...fields,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) {
        stats.errors += 1;
        console.error(`  event ${id}: ${error.message}`);
      }
    }
    for (let i = 0; i < signalInserts.length; i += 100) {
      const chunk = signalInserts.slice(i, i + 100);
      const { error } = await db.from('pythh_signal_events').insert(chunk);
      if (error) {
        stats.errors += 1;
        console.error(`  signals: ${error.message}`);
      }
    }
  }

  const report = { mode, version: FUNDING_INTEL_VERSION, provider, stats, preview: preview.slice(0, 25) };
  console.log(JSON.stringify(report.stats, null, 2));
  if (preview.length) {
    console.log('sample');
    for (const row of uniquePreview(preview, 8)) {
      console.log(`  ${formatPreviewRow(row)}`);
    }
  }
  if (jsonOut) {
    const dest = path.join(repoRoot, 'reports', `funding-event-research-${new Date().toISOString().slice(0, 10)}.json`);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(report, null, 2));
    console.log(`wrote ${dest}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
