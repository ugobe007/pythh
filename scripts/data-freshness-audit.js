#!/usr/bin/env node
'use strict';

/**
 * Detect stale investor/startup records and enqueue for remediation.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/data-freshness-audit.js
 */

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function ageDays(value) {
  if (!value) return 9999;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return 9999;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

async function fetchSlaMap() {
  const { data, error } = await supabase
    .from('freshness_sla_targets')
    .select('entity_type, max_age_days');
  if (error) throw error;
  const out = { investor: 30, startup: 14 };
  for (const row of data || []) out[row.entity_type] = row.max_age_days;
  return out;
}

async function enqueue(entityType, rows, maxAgeDays) {
  const stale = rows
    .map((r) => ({ id: r.id, staleDays: ageDays(r.updated_at) }))
    .filter((r) => r.staleDays > maxAgeDays);

  if (stale.length === 0) return 0;

  const payload = stale.map((r) => ({
    entity_type: entityType,
    entity_id: r.id,
    reason: `older_than_${maxAgeDays}d`,
    stale_days: r.staleDays,
    status: 'queued',
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('stale_data_queue').upsert(payload, {
    onConflict: 'entity_type,entity_id,reason',
  });
  if (error) throw error;
  return payload.length;
}

async function main() {
  const sla = await fetchSlaMap();

  const [investorsRes, startupsRes] = await Promise.all([
    supabase.from('investors').select('id, updated_at').limit(5000),
    supabase.from('startup_uploads').select('id, updated_at').eq('status', 'approved').limit(5000),
  ]);

  if (investorsRes.error) throw investorsRes.error;
  if (startupsRes.error) throw startupsRes.error;

  const investorQueued = await enqueue('investor', investorsRes.data || [], sla.investor || 30);
  const startupQueued = await enqueue('startup', startupsRes.data || [], sla.startup || 14);

  console.log(`Stale queue updated. investors=${investorQueued}, startups=${startupQueued}`);
}

main().catch((err) => {
  console.error('[data-freshness-audit] failed:', err.message || err);
  process.exit(1);
});
