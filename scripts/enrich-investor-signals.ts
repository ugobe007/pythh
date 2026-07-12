#!/usr/bin/env tsx

/**
 * Enrich ALL venture + angel investors from the database (not just top-100 registry).
 * Pulls news (Google News RSS), partners/investments when registry match exists.
 *
 * Usage:
 *   npx tsx scripts/enrich-investor-signals.ts
 *   npx tsx scripts/enrich-investor-signals.ts --limit=0          # all (~4.7k)
 *   npx tsx scripts/enrich-investor-signals.ts --limit=200 --offset=400
 *   npx tsx scripts/enrich-investor-signals.ts --cohort=venture
 *   npx tsx scripts/enrich-investor-signals.ts --id=<uuid>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase';
import { InvestorEnrichmentService } from '../src/lib/investorEnrichmentService';
import {
  fetchInvestorUniverse,
  countInvestorUniverse,
  parseLimitArg,
  parseOffsetArg,
  parseCohortArg,
} from '../lib/investorUniverse.mjs';

dotenv.config();

function requireServiceRoleKey(): void {
  const k = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!k) {
    console.error('❌ Set SUPABASE_SERVICE_KEY for investor_news / partner writes.');
    process.exit(1);
  }
}

const argv = process.argv.slice(2);
const LIMIT = parseLimitArg(argv, { defaultZero: true });
const OFFSET = parseOffsetArg(argv);
const COHORT = parseCohortArg(argv);
const DELAY_MS = parseInt((argv.find((a) => a.startsWith('--delay=')) || '--delay=2000').split('=')[1], 10);
const idArg = argv.find((a) => a.startsWith('--id='));
const TARGET_ID = idArg ? idArg.split('=')[1] : null;

async function enrichOne(investor: { id: string; name: string; url?: string | null; blog_url?: string | null; linkedin_url?: string | null }) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 ${investor.name}`);
  return InvestorEnrichmentService.enrichInvestor(investor.id, investor.name, {
    url: investor.url,
    blog_url: investor.blog_url,
    linkedin_url: investor.linkedin_url,
  });
}

async function main() {
  requireServiceRoleKey();

  if (TARGET_ID) {
    const { data } = await supabase.from('investors').select('id, name').eq('id', TARGET_ID).maybeSingle();
    if (!data) {
      console.error('Investor not found:', TARGET_ID);
      process.exit(1);
    }
    await enrichOne(data);
    return;
  }

  const counts = await countInvestorUniverse(
    createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    ),
    COHORT
  );

  const investors = await fetchInvestorUniverse(supabase, {
    limit: LIMIT,
    offset: OFFSET,
    cohort: COHORT,
    needsEnrichment: true,
    staleFirst: true,
  });

  console.log('🚀 Investor signal enrichment (full universe)');
  console.log(`   cohort: ${COHORT} · universe ${counts.total} (VC ${counts.venture} · angel ${counts.angel})`);
  console.log(
    `   batch: ${investors.length}${LIMIT > 0 ? ` (limit ${LIMIT})` : ' (ALL)'}${OFFSET ? ` · offset ${OFFSET}` : ''}`
  );
  console.log(`   delay: ${DELAY_MS}ms between investors\n`);

  if (!investors.length) {
    console.log('Nothing to process.');
    return;
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    try {
      const result = await enrichOne(inv);
      if (result.success) {
        ok++;
        console.log(`   ✅ news=${result.news} partners=${result.partners} investments=${result.investments}`);
      } else {
        fail++;
        console.log(`   ❌ ${result.error || 'failed'}`);
      }
    } catch (e) {
      fail++;
      console.error(`   ❌ ${e instanceof Error ? e.message : e}`);
    }
    if (i < investors.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n✅ Done — ${ok} ok · ${fail} failed · ${investors.length} total\n`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
