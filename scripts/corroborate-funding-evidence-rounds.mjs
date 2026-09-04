#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

import { loadFundingEvidenceLedger } from '../lib/loadFundingLibs.mjs';

const require = createRequire(import.meta.url);
const {
  classifyFundingEvidence,
  isPromotionSafeStartupName,
  clusterCompatibleRoundEvents,
} = loadFundingEvidenceLedger();
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function independentSource(row) {
  return assessFundingSource(row).identity;
}

async function main() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('funding_evidence_events')
      .select('id,canonical_round_key,startup_name_raw,round_type,amount_usd,announced_at,source_url,source_title,source_publisher,verification_status,metadata')
      .in('verification_status', ['observed', 'corroborated']).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  // Soft-merge unknown vs typed round/amount keys so Pulse2+FinSMEs / TNW+Pulse2 can corroborate.
  const clustered = clusterCompatibleRoundEvents(rows.filter((row) => row.canonical_round_key));
  const eligible = [];
  for (const cluster of clustered) {
    const events = cluster.events;
    const canonicalRoundKey = cluster.key;
    if (!events.every(event => isPromotionSafeStartupName(event.startup_name_raw))) continue;
    const financingSafe = events.every(event => classifyFundingEvidence({
      event_type: 'FUNDING',
      source_title: event.source_title,
      frame_confidence: 1,
      extraction_meta: { decision: 'ACCEPT', graph_safe: true },
    }).eligible);
    if (!financingSafe) continue;
    const domains = [...new Set(events.map(independentSource).filter(Boolean))];
    const trusted = events.map(event => ({ event, assessment: assessFundingSource(event) })).filter(row => row.assessment.trusted);
    if (domains.length < 2 && trusted.length === 0) continue;
    eligible.push({ canonicalRoundKey, domains, trusted, events });
  }
  const updates = [];
  let alreadyCurrent = 0;
  for (const group of eligible) {
    const evidenceEventIds = group.events.map(row => row.id).sort();
    for (const event of group.events) {
      const trust = assessFundingSource(event);
      const desiredStatus = trust.trusted ? 'verified' : 'corroborated';
      const previousIds = [...(event.metadata?.corroboration?.evidence_event_ids || [])].sort();
      const sameEvidence = previousIds.length === evidenceEventIds.length
        && previousIds.every((id, index) => id === evidenceEventIds[index]);
      if (event.verification_status === desiredStatus && sameEvidence) {
        alreadyCurrent++;
        continue;
      }
      updates.push({ group, event, trust, desiredStatus, evidenceEventIds });
    }
  }
  if (apply) {
    const total = updates.length;
    for (let offset = 0; offset < updates.length; offset += 12) {
      const batch = updates.slice(offset, offset + 12);
      if (total > 12) {
        console.log(`[corroborate] updating ${Math.min(offset + batch.length, total)}/${total} events…`);
      }
      await Promise.all(batch.map(async ({ group, event, trust, desiredStatus, evidenceEventIds }) => {
        const updatePromise = db.from('funding_evidence_events').update({
          verification_status: desiredStatus,
          metadata: {
            ...(event.metadata || {}),
            corroboration: {
              method: trust.trusted ? 'trusted_single_source' : 'independent_sources',
              trusted_source_tier: trust.trusted ? trust.tier : null,
              canonical_round_key: group.canonicalRoundKey,
              source_domains: group.domains,
              evidence_event_ids: evidenceEventIds,
              corroborated_at: new Date().toISOString(),
            },
          },
          updated_at: new Date().toISOString(),
        }).eq('id', event.id);
        const timeoutMs = 45_000;
        const { error } = await Promise.race([
          updatePromise,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`supabase_update_timeout_${timeoutMs}ms event=${event.id}`)), timeoutMs);
          }),
        ]);
        if (error) throw error;
      }));
    }
  }
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    events_scanned: rows.length,
    corroborated_rounds: eligible.length,
    events_promoted: eligible.reduce((sum, group) => sum + group.events.length, 0),
    events_already_current: alreadyCurrent,
    events_updated: apply ? updates.length : 0,
    preview: eligible.slice(0, 20).map(group => ({
      startup: group.events[0].startup_name_raw,
      round: group.events[0].round_type,
      amount_usd: group.events[0].amount_usd,
      domains: group.domains,
      trusted_sources: group.trusted.map(row => ({ identity: row.assessment.identity, tier: row.assessment.tier })),
      sources: group.events.map(row => row.source_url),
    })),
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
