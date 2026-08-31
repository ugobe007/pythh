#!/usr/bin/env node
/**
 * Mark megacorp-parent / solo-VC-brand rows as entity_gate=junk so they stop
 * entering matching and funded-cohort calibration.
 *
 * Targets:
 *   - Alphabet* (Google parent abc.xyz; Alphabet Ventures → GV)
 *   - Solo VC brands scraped as startups (Andreessen, a16z, Sequoia, …)
 *
 * Relies on evaluateStartupNameForPipeline() after the name-gate ship.
 *
 * Usage:
 *   node scripts/mark-megacorp-startup-junk.mjs
 *   node scripts/mark-megacorp-startup-junk.mjs --apply
 *   node scripts/mark-megacorp-startup-junk.mjs --apply --limit=500
 */
import 'dotenv/config';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const { evaluateStartupNameForPipeline } = require('../lib/startupNameGate.js');

const APPLY = process.argv.includes('--apply');
const LIMIT = Math.max(
  1,
  Number(process.argv.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) || 500),
);

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const EXACT_VC_SOLO = new Set([
  'andreessen',
  'a16z',
  'sequoia',
  'greylock',
  'bessemer',
  'felicis',
  'coatue',
  'softbank',
  'ycombinator',
  'alphabet',
]);

function isMegacorpOrVcJunkName(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  const lower = n.toLowerCase();
  // Word-boundary Alphabet (not "Alphabetical …")
  if (/(^|[^a-z])alphabet([^a-z]|$)/i.test(n)) return true;
  if (EXACT_VC_SOLO.has(lower)) return true;
  const gate = evaluateStartupNameForPipeline(n);
  return !gate.ok && /alphabet|solo-vc-brand|public-parent|investor|non_startup_entity/i.test(String(gate.reason || ''));
}

async function main() {
  const candidates = [];

  // Alphabet anywhere in name (prefix, trailing, mid-compound).
  // PostgREST .neq('junk') excludes nulls — include null gates explicitly.
  const { data: alphRows, error: alphErr } = await sb
    .from('startup_uploads')
    .select('id,name,entity_gate,total_god_score,website')
    .ilike('name', '%alphabet%')
    .or('entity_gate.is.null,entity_gate.neq.junk')
    .limit(LIMIT);
  if (alphErr) throw alphErr;
  for (const r of alphRows || []) candidates.push(r);

  // Solo VC brand exact names
  for (const brand of EXACT_VC_SOLO) {
    if (brand === 'alphabet') continue;
    const { data, error } = await sb
      .from('startup_uploads')
      .select('id,name,entity_gate,total_god_score,website')
      .ilike('name', brand)
      .or('entity_gate.is.null,entity_gate.neq.junk')
      .limit(50);
    if (error) throw error;
    for (const r of data || []) {
      if (!candidates.some((c) => c.id === r.id)) candidates.push(r);
    }
  }

  const toMark = candidates.filter((r) => isMegacorpOrVcJunkName(r.name));
  const skipped = candidates.filter((r) => !isMegacorpOrVcJunkName(r.name));

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    scanned: candidates.length,
    to_mark_junk: toMark.length,
    skipped_not_junk_by_gate: skipped.length,
    sample: toMark.slice(0, 25).map((r) => ({
      name: r.name,
      god: r.total_god_score,
      gate: r.entity_gate,
      website: r.website,
      reason: evaluateStartupNameForPipeline(r.name).reason,
    })),
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to set entity_gate=junk.');
    return;
  }

  const reason = 'megacorp_or_vc_brand_not_startup';
  const now = new Date().toISOString();
  let updated = 0;
  for (let i = 0; i < toMark.length; i += 50) {
    const chunk = toMark.slice(i, i + 50);
    const ids = chunk.map((r) => r.id);
    const { error } = await sb
      .from('startup_uploads')
      .update({
        entity_gate: 'junk',
        entity_gate_reason: reason,
        entity_gate_at: now,
      })
      .in('id', ids);
    if (error) throw error;
    updated += ids.length;
  }
  console.log(`\nMarked ${updated} startups entity_gate=junk (${reason}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
