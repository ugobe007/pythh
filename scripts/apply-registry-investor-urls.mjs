#!/usr/bin/env node
/**
 * Bulk-apply curated VC_WEBSITES registry URLs to investors missing a homepage.
 * No API calls — instant wins before Gemini URL discovery.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fetchInvestorUniverse } from '../lib/investorUniverse.mjs';
import { resolveInvestorUrls } from '../lib/investorUrlResolver.mjs';

dotenv.config();

const APPLY = process.argv.includes('--apply');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function needsUrl(inv) {
  const u = (inv.url || '').trim();
  if (!u) return true;
  return /crunchbase|linkedin|twitter|pitchbook|wikipedia/i.test(u);
}

async function main() {
  const all = await fetchInvestorUniverse(sb, { limit: 0 });
  const pool = all.filter(needsUrl);
  let matched = 0;
  let written = 0;

  console.log(`\n📚 Registry URL backfill · ${pool.length} missing · mode ${APPLY ? 'APPLY' : 'dry-run'}\n`);

  for (const inv of pool) {
    for (const label of [inv.firm, inv.name].filter(Boolean)) {
      const resolved = resolveInvestorUrls({ ...inv, name: label });
      if (resolved.source !== 'registry' || !resolved.config?.website) continue;
      matched++;
      console.log(`  ${inv.name} → ${resolved.config.website} (${resolved.key})`);
      if (APPLY) {
        const { error } = await sb.from('investors').update({ url: resolved.config.website }).eq('id', inv.id);
        if (!error) written++;
      } else {
        written++;
      }
      break;
    }
  }

  console.log(`\n✅ Registry — matched ${matched} · written ${written}\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
