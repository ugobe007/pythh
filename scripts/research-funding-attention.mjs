#!/usr/bin/env node
/**
 * Funding-attention agent (observed thesis from verified announcements).
 *
 * Reads trusted funding_evidence_events + participants, extracts announcement
 * aspects (customer growth, hiring, unique tech, board, partners, product),
 * and writes:
 *   - investors.signals.observed_thesis + union into top_themes (additive)
 *   - pythh_signal_events for startups that already have a pythh_entities row
 *
 * Does NOT:
 *   - retune GOD / fit weights
 *   - overwrite investment_thesis / bio / check size
 *   - create pythh_entities
 *   - emit co-invest notes from unverified co-mentions
 *   - call Anthropic / OpenAI
 *
 * Dry-run by default. --apply writes.
 *
 *   npm run funding:attention
 *   npm run funding:attention -- --apply --limit=100
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import {
  announcementTextFromEvent,
  extractFundingAttentionAspects,
  FUNDING_ATTENTION_VERSION,
} from '../lib/fundingAttentionAspects.mjs';
import { investorSignalsPatch } from '../lib/fundingAttentionObservedThesis.mjs';

const require = createRequire(import.meta.url);
const { buildSignalEvent } = require('../lib/signalEventBuilder.js');
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');
const jsonOut = process.argv.includes('--json');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const eventIdsArg = process.argv.find((arg) => arg.startsWith('--event-ids='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 100), 1), 2000);
const selectedEventIds = new Set(
  (eventIdsArg?.slice('--event-ids='.length) || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const TRUSTED_STATUSES = new Set(['verified', 'corroborated']);
const REJECTED_STATUSES = new Set(['rejected', 'junk', 'false_positive']);

function argFlag(name, fallback) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return raw ? raw.slice(name.length + 1) : fallback;
}

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
  return Boolean(assessFundingSource(event).trusted);
}

function alreadyExtracted(event) {
  const meta = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  return Boolean(meta.funding_attention_extracted_at) && !force;
}

function participantPhraseText(rows) {
  return (rows || [])
    .map((row) => row.evidence_phrase)
    .filter(Boolean)
    .join(' ');
}

function verifiedCoInvestors(participants, selfInvestorId) {
  return (participants || [])
    .filter((row) => row.resolution_status === 'resolved' && (row.investor_id || row.investor_name_raw))
    .filter((row) => !selfInvestorId || row.investor_id !== selfInvestorId)
    .map((row) => ({
      investor_id: row.investor_id || null,
      name: row.investor_name_raw || null,
    }));
}

function buildStartupSignal(entityId, event, aspect, text) {
  const detectedAt = event.announced_at || event.occurred_at || event.created_at || new Date().toISOString();
  const sig = {
    primary_signal: aspect.primary_signal,
    signal_type: 'funding_attention',
    signal_strength: Math.min(0.55 + (aspect.confidence || 0.5) * 0.3, 0.85),
    confidence: aspect.confidence || 0.6,
    evidence_quality: TRUSTED_STATUSES.has(event.verification_status) ? 'observed' : 'inferred',
    raw_text: text.slice(0, 400),
    inference: { likely_stage: event.round_type || null, likely_need: [], urgency: null },
    _actions: [{ action_tag: `attention_${aspect.id}`, meaning: aspect.label }],
  };
  return buildSignalEvent(sig, {
    entityId,
    rawSentence: `${aspect.theme}: ${text.slice(0, 240)}`,
    sourceType: 'news_article',
    source: 'funding-attention-agent',
    sourceUrl: event.source_url || null,
    detectedAt,
  });
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

async function loadExistingAttentionSignals(entityIds) {
  const seen = new Set();
  if (!entityIds.length) return seen;
  for (let offset = 0; offset < entityIds.length; offset += 200) {
    const chunk = entityIds.slice(offset, offset + 200);
    const { data, error } = await db
      .from('pythh_signal_events')
      .select('entity_id, source_url, primary_signal')
      .eq('source', 'funding-attention-agent')
      .in('entity_id', chunk);
    if (error) throw error;
    for (const row of data || []) {
      seen.add(`${row.entity_id}|${row.source_url || ''}|${row.primary_signal}`);
    }
  }
  return seen;
}

async function loadInvestors(ids) {
  const map = new Map();
  if (!ids.length) return map;
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    const { data, error } = await db
      .from('investors')
      .select('id, name, firm, signals')
      .in('id', chunk);
    if (error) throw error;
    for (const row of data || []) map.set(row.id, row);
  }
  return map;
}

async function main() {
  const mode = apply ? 'apply' : 'dry-run';
  console.log(`funding-attention  ${mode}  version=${FUNDING_ATTENTION_VERSION}  limit=${limit}`);

  const eventColumns = 'id,startup_id,startup_name_raw,verification_status,source_url,source_publisher,source_title,announced_at,occurred_at,created_at,round_type,metadata';
  const events = [];
  const stats = {
    scanned: 0,
    skipped_untrusted: 0,
    skipped_already: 0,
    skipped_no_signal: 0,
    skipped_no_entity: 0,
    investor_patches: 0,
    signal_events: 0,
    stamped: 0,
    errors: 0,
  };

  if (selectedEventIds.size) {
    const rawEvents = await pageSelect('funding_evidence_events', eventColumns, (q) => q.in('id', [...selectedEventIds]));
    for (const event of rawEvents) {
      stats.scanned += 1;
      if (!eventEligible(event)) { stats.skipped_untrusted += 1; continue; }
      if (alreadyExtracted(event)) { stats.skipped_already += 1; continue; }
      events.push(event);
    }
  } else {
    const pageSize = 200;
    let offset = 0;
    while (events.length < limit) {
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
        if (alreadyExtracted(event)) { stats.skipped_already += 1; continue; }
        events.push(event);
        if (events.length >= limit) break;
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }
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
  const existingSignals = await loadExistingAttentionSignals([...new Set(entityByUpload.values())]);

  const resolvedInvestorIds = [...new Set(
    events.flatMap((event) => (participantsByEvent.get(event.id) || [])
      .filter((row) => row.investor_id && row.resolution_status === 'resolved')
      .map((row) => row.investor_id)),
  )];
  const investors = await loadInvestors(resolvedInvestorIds);

  const preview = [];
  const investorUpdates = new Map();
  const signalInserts = [];
  const stampUpdates = [];

  for (const event of events) {
    const participants = participantsByEvent.get(event.id) || [];
    const extracted = extractFundingAttentionAspects([
      announcementTextFromEvent(event),
      participantPhraseText(participants),
    ]);
    const resolved = participants.filter((row) => row.investor_id && row.resolution_status === 'resolved');
    const canCoInvest = TRUSTED_STATUSES.has(event.verification_status) && resolved.length >= 2;
    const stampMeta = event.metadata && typeof event.metadata === 'object' ? { ...event.metadata } : {};
    const stampRow = {
      id: event.id,
      metadata: {
        ...stampMeta,
        funding_attention_extracted_at: new Date().toISOString(),
        funding_attention_version: FUNDING_ATTENTION_VERSION,
        funding_attention_aspects: extracted.aspects.map((a) => a.id),
      },
    };
    if (!extracted.aspects.length && !canCoInvest) {
      stats.skipped_no_signal += 1;
      stampUpdates.push(stampRow);
      continue;
    }

    const entityId = event.startup_id ? entityByUpload.get(event.startup_id) : null;
    if (event.startup_id && !entityId) stats.skipped_no_entity += 1;

    const rowPreview = {
      event_id: event.id,
      startup: event.startup_name_raw,
      status: event.verification_status,
      title: event.source_title,
      aspects: extracted.aspects.map((a) => a.id),
      cited: extracted.cited,
      investors: resolved.map((row) => row.investor_name_raw),
      entity_id: entityId || null,
    };
    preview.push(rowPreview);

    for (const participant of resolved) {
      const investor = investors.get(participant.investor_id);
      if (!investor) continue;
      const current = investorUpdates.get(investor.id)?.signals || investor.signals;
      const patch = investorSignalsPatch(current, {
        eventId: event.id,
        aspects: extracted.aspects,
        coInvestors: canCoInvest ? verifiedCoInvestors(resolved, investor.id) : [],
        sourceUrl: event.source_url,
        announcedAt: event.announced_at || event.occurred_at,
        startupName: event.startup_name_raw,
        cited: extracted.cited,
      });
      investorUpdates.set(investor.id, {
        id: investor.id,
        name: investor.firm || investor.name,
        signals: patch.signals,
      });
    }

    if (entityId) {
      for (const aspect of extracted.aspects) {
        const key = `${entityId}|${event.source_url || ''}|${aspect.primary_signal}`;
        if (existingSignals.has(key)) continue;
        existingSignals.add(key);
        const row = buildStartupSignal(entityId, event, aspect, extracted.text);
        if (row) signalInserts.push(row);
      }
    }

    stampUpdates.push(stampRow);
  }

  stats.investor_patches = investorUpdates.size;
  stats.signal_events = signalInserts.length;

  if (apply) {
    for (const update of investorUpdates.values()) {
      const { error } = await db.from('investors').update({
        signals: update.signals,
        updated_at: new Date().toISOString(),
      }).eq('id', update.id);
      if (error) {
        stats.errors += 1;
        console.error(`  investor ${update.id}: ${error.message}`);
      }
    }
    for (let i = 0; i < signalInserts.length; i += 100) {
      const batch = signalInserts.slice(i, i + 100);
      const { error } = await db.from('pythh_signal_events').insert(batch);
      if (error) {
        stats.errors += batch.length;
        console.error(`  signal insert @${i}: ${error.message}`);
      }
    }
    for (const stamp of stampUpdates) {
      const { error } = await db.from('funding_evidence_events').update({
        metadata: stamp.metadata,
        updated_at: new Date().toISOString(),
      }).eq('id', stamp.id);
      if (error) {
        stats.errors += 1;
        console.error(`  stamp ${stamp.id}: ${error.message}`);
      } else {
        stats.stamped += 1;
      }
    }
  }

  const report = {
    mode,
    version: FUNDING_ATTENTION_VERSION,
    eligible_events: events.length,
    preview: preview.slice(0, 25),
    stats,
    notes: [
      'investment_thesis is never written',
      'co-investors require verified/corroborated same-event resolved participants',
      'startup signal rows require an existing pythh_entities link',
          'startup GOD weights are unchanged',
    ],
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(JSON.stringify({ mode, stats, preview: report.preview }, null, 2));
    if (!apply) console.log('\nDRY RUN — no writes. Re-run with --apply to commit.');
  }

  const reportPath = argFlag('--report', '');
  if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
