#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractFunding } = require('../lib/inference-extractor.js');
const { canonicalRoundKey, classifyFundingEvidence, isPromotionSafeStartupName, normalizeStartupName, startupNameFromFundingEvent } = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
const fullPreview = process.argv.includes('--full-preview');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('funding_evidence_events')
      .select('id,startup_id,startup_name_raw,round_type,amount_usd,announced_at,source_title,verification_status,canonical_round_key,metadata')
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const startupIds = [...new Set(rows.map(row => row.startup_id).filter(Boolean))];
  const startups = [];
  for (let offset = 0; offset < startupIds.length; offset += 200) {
    const { data, error } = await db.from('startup_uploads').select('id,name').in('id', startupIds.slice(offset, offset + 200));
    if (error) throw error;
    startups.push(...(data || []));
  }
  const startupById = new Map(startups.map(row => [row.id, row]));
  const changes = [];
  for (const row of rows) {
    const inferred = extractFunding(row.source_title || '') || {};
    const inferredAmount = Number(inferred.funding_amount) > 0 ? Math.round(Number(inferred.funding_amount)) : null;
    const amount = row.amount_usd || inferredAmount;
    const inferredRound = inferred.funding_round || inferred.funding_stage || null;
    const round = row.round_type || inferredRound;
    const classification = classifyFundingEvidence({ event_type: 'FUNDING', source_title: row.source_title, frame_confidence: 1, extraction_meta: { decision: 'ACCEPT', graph_safe: true } });
    const patch = {};
    const reasons = [];
    const canonicalStartup = startupById.get(row.startup_id);
    const directionalPrefix = String(row.source_title || '').match(/^(.{2,100}?)\s+invest(?:s|ed)?\b.{0,40}?\s+in\s+/i)?.[1] || '';
    const directionalTitle = Boolean(directionalPrefix) && !/\b(?:raises?|raised|secures?|secured|closes?|closed)\b/i.test(directionalPrefix);
    const headlineStartup = startupNameFromFundingEvent({ source_title: row.source_title });
    const directionalMismatch = directionalTitle && headlineStartup && canonicalStartup
      && normalizeStartupName(headlineStartup) !== normalizeStartupName(canonicalStartup.name);
    const sourceTitle = String(row.source_title || '');
    const explicitBeforeAction = sourceTitle
      .match(/\b(?:startup|company)\s+(.{2,80}?)\s+(?:(?:has|have|had)\s+(?:now\s+)?)?(?:raises?|raised|secures?|secured|closes?|closed)\b/i);
    const explicitBeforeComma = sourceTitle
      .match(/\b(?:startup|company)\s+([A-Z][A-Za-z0-9.&+-]*(?:\s+[A-Z][A-Za-z0-9.&+-]*){0,3})(?=\s*[,;])/i);
    const explicitAtEnd = sourceTitle
      .match(/\b(?:startup|company)\s+([A-Za-z][A-Za-z0-9.&+-]*(?:\s+[A-Za-z][A-Za-z0-9.&+-]*){0,3})\s*$/);
    const explicitHeadlineCandidate = (explicitBeforeAction?.index ?? 999) < 60
      ? explicitBeforeAction?.[1]?.trim()
      : (explicitBeforeComma?.index ?? 999) < 65 ? explicitBeforeComma?.[1]?.trim()
        : explicitAtEnd?.[1]?.trim() || null;
    const explicitlyNamedHeadlineStartup = explicitHeadlineCandidate
      && !/[,;:]|\b(?:that|which|rebrands?|co-founded|founded|uses?|builds?|emerges?|targeting|behind|weekly|news|just|has|have|had|now|for|to|with|by)\b/i.test(explicitHeadlineCandidate)
      ? explicitHeadlineCandidate.replace(/[,;:]$/, '').trim() : null;
    const headlineMismatch = explicitlyNamedHeadlineStartup && canonicalStartup
      && isPromotionSafeStartupName(explicitlyNamedHeadlineStartup)
      && normalizeStartupName(explicitlyNamedHeadlineStartup) !== normalizeStartupName(canonicalStartup.name);
    const escapedCanonicalName = String(canonicalStartup?.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const descriptiveAffiliationMislink = canonicalStartup && escapedCanonicalName
      && new RegExp(`^(?:ex-|former\\s+)${escapedCanonicalName}\\b|\\bco-founded by\\b.{0,60}\\b${escapedCanonicalName}\\b`, 'i').test(sourceTitle);
    const previousRepairReasons = row.metadata?.derived_field_repair?.reasons || [];
    const wasClassifierQuarantined = previousRepairReasons.some(reason => String(reason).startsWith('non_funding_evidence_rejected:'));
    if (classification.eligible && row.verification_status === 'rejected' && wasClassifierQuarantined) {
      const method = row.metadata?.corroboration?.method;
      patch.verification_status = method === 'trusted_single_source' ? 'verified'
        : method === 'independent_sources' ? 'corroborated' : 'observed';
      reasons.push('classifier_quarantine_recovered');
    } else if (!classification.eligible) {
      let rejectedChanged = false;
      if (row.startup_id) { patch.startup_id = null; rejectedChanged = true; }
      if (row.verification_status !== 'rejected') { patch.verification_status = 'rejected'; rejectedChanged = true; }
      if (rejectedChanged) reasons.push(`non_funding_evidence_rejected:${classification.reason}`);
    } else if (directionalMismatch || headlineMismatch || descriptiveAffiliationMislink || (canonicalStartup && !isPromotionSafeStartupName(canonicalStartup.name))) {
      patch.startup_id = null;
      const correctedHeadlineStartup = headlineMismatch ? explicitlyNamedHeadlineStartup : headlineStartup;
      patch.startup_name_raw = isPromotionSafeStartupName(correctedHeadlineStartup) ? correctedHeadlineStartup : 'Unresolved funding target';
      reasons.push(directionalMismatch ? 'directional_startup_mislink'
        : headlineMismatch ? 'headline_startup_mislink'
          : descriptiveAffiliationMislink ? 'descriptive_affiliation_mislink' : 'unsafe_canonical_startup_unlinked');
    } else if (canonicalStartup && !isPromotionSafeStartupName(row.startup_name_raw)) {
      patch.startup_name_raw = canonicalStartup.name;
      reasons.push('startup_label_replaced_from_canonical');
    }
    const roundKey = canonicalRoundKey({
      startupId: Object.hasOwn(patch, 'startup_id') ? patch.startup_id : row.startup_id,
      startupName: patch.startup_name_raw || row.startup_name_raw,
      roundType: round,
      amountUsd: amount,
      announcedAt: row.announced_at,
    });
    if (classification.eligible) {
      if (!row.amount_usd && inferredAmount) { patch.amount_usd = inferredAmount; reasons.push('amount_from_headline'); }
      if (!row.round_type && inferredRound) { patch.round_type = inferredRound; reasons.push('round_from_headline'); }
      if (row.canonical_round_key !== roundKey) { patch.canonical_round_key = roundKey; reasons.push('round_key_rebuilt'); }
    }
    const repairedStartupName = patch.startup_name_raw || row.startup_name_raw;
    if (classification.eligible && (!isPromotionSafeStartupName(repairedStartupName) || Object.hasOwn(patch, 'startup_id')) && ['verified', 'corroborated'].includes(row.verification_status)) {
      patch.verification_status = 'observed';
      reasons.push(`unsafe_status_downgrade:${classification.eligible ? 'descriptive_startup_label' : classification.reason}`);
    }
    if (!reasons.length) continue;
    patch.metadata = {
      ...(row.metadata || {}),
      derived_field_repair: {
        version: 'v1', reasons, repaired_at: new Date().toISOString(),
        quarantine_previous: row.metadata?.derived_field_repair?.quarantine_previous || {
          startup_id: row.startup_id,
          verification_status: row.verification_status,
        },
      },
    };
    patch.updated_at = new Date().toISOString();
    changes.push({ row, patch, reasons });
  }
  if (apply) {
    for (const change of changes) {
      const { error } = await db.from('funding_evidence_events').update(change.patch).eq('id', change.row.id);
      if (error) throw error;
    }
  }
  const reasonCounts = {};
  for (const change of changes) for (const reason of change.reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', events_scanned: rows.length, events_changed: changes.length, reason_counts: reasonCounts, preview: changes.slice(0, fullPreview ? changes.length : 30).map(change => ({ startup: change.row.startup_name_raw, status: change.row.verification_status, reasons: change.reasons, title: change.row.source_title, patch: change.patch })) }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
