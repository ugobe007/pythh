#!/usr/bin/env node
/**
 * Sync vc_intelligence LLM profiles → investors.investment_thesis + sectors/stage.
 * Only overwrites when vc_intelligence confidence is higher than existing sparse thesis.
 *
 * Usage:
 *   node scripts/sync-vc-intelligence-to-investors.mjs
 *   node scripts/sync-vc-intelligence-to-investors.mjs --apply --limit=100
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { parseLimitArg } from '../lib/investorUniverse.mjs';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const LIMIT = parseLimitArg(process.argv.slice(2), { defaultZero: true });

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function shouldOverwrite(investor, intel) {
  const existing = (investor.investment_thesis || '').trim();
  const conf = Number(intel.confidence) || 0;
  if (!existing || existing.length < 40) return conf >= 0.35;
  if (conf >= 0.65) return true;
  return false;
}

async function main() {
  console.log(`\n🔗 Sync vc_intelligence → investors`);
  console.log(`   mode: ${APPLY ? 'APPLY' : 'dry-run'} · limit ${LIMIT > 0 ? LIMIT : 'ALL'}\n`);

  let query = sb
    .from('vc_intelligence')
    .select('investor_id, firm_name, thesis_summary, sector_preferences, stage_preferences, confidence, profiled_at')
    .not('thesis_summary', 'is', null)
    .order('confidence', { ascending: false });

  if (LIMIT > 0) query = query.limit(LIMIT);

  const { data: intelRows, error } = await query;

  if (error) throw new Error(error.message);
  if (!intelRows?.length) {
    console.log('No profiled vc_intelligence rows.');
    return;
  }

  let synced = 0;
  for (const intel of intelRows) {
    const { data: investor } = await sb
      .from('investors')
      .select('id, name, investment_thesis, sectors, stage')
      .eq('id', intel.investor_id)
      .maybeSingle();

    if (!investor) continue;
    if (!shouldOverwrite(investor, intel)) continue;

    const patch = {
      investment_thesis: intel.thesis_summary,
      updated_at: new Date().toISOString(),
    };
    if (Array.isArray(intel.sector_preferences) && intel.sector_preferences.length) {
      patch.sectors = intel.sector_preferences.map((s) => String(s).toLowerCase());
    }
    if (Array.isArray(intel.stage_preferences) && intel.stage_preferences.length) {
      patch.stage = intel.stage_preferences.map((s) => String(s).toLowerCase());
    }

    console.log(`  ${investor.name} (conf ${Number(intel.confidence).toFixed(2)})`);
    if (APPLY) {
      const { error: upErr } = await sb.from('investors').update(patch).eq('id', investor.id);
      if (!upErr) synced++;
    } else {
      synced++;
    }
  }

  console.log(`\n✅ ${APPLY ? 'Synced' : 'Would sync'} ${synced} investors\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
