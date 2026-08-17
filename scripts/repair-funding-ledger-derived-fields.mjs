#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractFunding } = require('../lib/inference-extractor.js');
const { canonicalRoundKey, classifyFundingEvidence, isPromotionSafeStartupName } = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
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
  const changes = [];
  for (const row of rows) {
    const inferred = extractFunding(row.source_title || '') || {};
    const inferredAmount = Number(inferred.funding_amount) > 0 ? Math.round(Number(inferred.funding_amount)) : null;
    const amount = row.amount_usd || inferredAmount;
    const inferredRound = inferred.funding_round || inferred.funding_stage || null;
    const round = row.round_type || inferredRound;
    const roundKey = canonicalRoundKey({ startupId: row.startup_id, startupName: row.startup_name_raw, roundType: round, amountUsd: amount, announcedAt: row.announced_at });
    const classification = classifyFundingEvidence({ event_type: 'FUNDING', source_title: row.source_title, frame_confidence: 1, extraction_meta: { decision: 'ACCEPT', graph_safe: true } });
    const patch = {};
    const reasons = [];
    if (classification.eligible) {
      if (!row.amount_usd && inferredAmount) { patch.amount_usd = inferredAmount; reasons.push('amount_from_headline'); }
      if (!row.round_type && inferredRound) { patch.round_type = inferredRound; reasons.push('round_from_headline'); }
      if (row.canonical_round_key !== roundKey) { patch.canonical_round_key = roundKey; reasons.push('round_key_rebuilt'); }
    }
    if ((!classification.eligible || !isPromotionSafeStartupName(row.startup_name_raw)) && ['verified', 'corroborated'].includes(row.verification_status)) {
      patch.verification_status = 'observed';
      reasons.push(`unsafe_status_downgrade:${classification.eligible ? 'descriptive_startup_label' : classification.reason}`);
    }
    if (!reasons.length) continue;
    patch.metadata = { ...(row.metadata || {}), derived_field_repair: { version: 'v1', reasons, repaired_at: new Date().toISOString() } };
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
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', events_scanned: rows.length, events_changed: changes.length, reason_counts: reasonCounts, preview: changes.slice(0, 30).map(change => ({ startup: change.row.startup_name_raw, status: change.row.verification_status, reasons: change.reasons, title: change.row.source_title, patch: change.patch })) }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
