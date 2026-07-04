#!/usr/bin/env node
/**
 * Firm-centric sync: investor_partners table → investors.partners JSON + is_individual=false.
 *
 * Usage:
 *   node scripts/sync-investor-partners-json.mjs
 *   node scripts/sync-investor-partners-json.mjs --apply --limit=200
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { parseLimitArg, parseCohortArg } from '../lib/investorUniverse.mjs';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const LIMIT = parseLimitArg(process.argv.slice(2), { defaultZero: true });
const COHORT = parseCohortArg(process.argv.slice(2));

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  console.log(`\n👥 Sync investor_partners → investors.partners JSON`);
  console.log(`   mode: ${APPLY ? 'APPLY' : 'dry-run'} · cohort ${COHORT} · limit ${LIMIT > 0 ? LIMIT : 'ALL'}\n`);

  const { data: goodInvestors } = await sb
    .from('investors')
    .select('id, name')
    .neq('status', 'inactive')
    .neq('entity_gate', 'junk');
  const goodIds = new Set((goodInvestors || []).map((i) => i.id));

  const { data: partnerRows } = await sb
    .from('investor_partners')
    .select('investor_id, name, title, bio, linkedin_url, twitter_handle, focus_areas, stage_preference, is_active')
    .eq('is_active', true)
    .limit(5000);

  const byInvestor = new Map();
  for (const p of partnerRows || []) {
    if (!goodIds.has(p.investor_id)) continue;
    if (!byInvestor.has(p.investor_id)) byInvestor.set(p.investor_id, []);
    byInvestor.get(p.investor_id).push({
      name: p.name,
      title: p.title,
      bio: p.bio,
      linkedin_url: p.linkedin_url,
      twitter_handle: p.twitter_handle,
      focus_areas: p.focus_areas,
      stage_preference: p.stage_preference,
    });
  }

  const investorIds = [...byInvestor.keys()].slice(0, LIMIT > 0 ? LIMIT : undefined);
  let synced = 0;

  for (const id of investorIds) {
    const partners = byInvestor.get(id);
    const { data: inv } = await sb.from('investors').select('name').eq('id', id).maybeSingle();
    if (!inv) continue;
    console.log(`  ${inv.name}: ${partners.length} partners`);
    if (APPLY) {
      const { error } = await sb
        .from('investors')
        .update({
          partners,
          is_individual: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (!error) synced++;
    } else {
      synced++;
    }
  }

  console.log(`\n✅ ${APPLY ? 'Synced' : 'Would sync'} ${synced} firm records\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
