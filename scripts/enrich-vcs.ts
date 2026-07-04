#!/usr/bin/env tsx

/**
 * Enrich VC data from websites, blogs, and news sources.
 * Daily rotation: processes batch-size firms from top ~100 pool (default 10/day).
 *
 * Run with:
 *   npx tsx scripts/enrich-vcs.ts
 *   npx tsx scripts/enrich-vcs.ts --batch-size=15 --all-today
 *   npx tsx scripts/enrich-vcs.ts --firm="Sequoia Capital"
 */

import { supabase } from '../src/lib/supabase';
import { InvestorEnrichmentService } from '../src/lib/investorEnrichmentService';
import { dailyVcBatch, TOP_VC_FIRM_NAMES } from '../lib/topVcFirms.mjs';

function requireServiceRoleKey(): void {
  const k =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  if (!k) {
    console.error(
      '❌ VC enrichment writes to investor_news / investor_partners / investor_investments / investor_advice (RLS).'
    );
    console.error('   Set SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY in .env (same as GitHub Actions).');
    process.exit(1);
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const batchArg = argv.find((a) => a.startsWith('--batch-size='));
  const firmArg = argv.find((a) => a.startsWith('--firm='));
  return {
    batchSize: batchArg ? parseInt(batchArg.split('=')[1], 10) : 10,
    allToday: argv.includes('--all-today'),
    firm: firmArg ? firmArg.split('=').slice(1).join('=').replace(/^"|"$/g, '') : null,
  };
}

function nameScore(candidate: string, canonical: string): number {
  const c = candidate.trim().toLowerCase();
  const t = canonical.trim().toLowerCase();
  if (c === t) return 100;
  if (c.startsWith(t) && c.length <= t.length + 4) return 80;
  if (c.includes(t) && c.length < t.length + 20) return 60;
  if (/\s{2,}/.test(candidate) || candidate.length > canonical.length + 25) return 10;
  return 30;
}

async function resolveInvestor(vcName: string) {
  const { data: exact, error: exactErr } = await supabase
    .from('investors')
    .select('id, name, investor_score, status, entity_gate')
    .ilike('name', vcName)
    .neq('status', 'inactive')
    .neq('entity_gate', 'junk')
    .limit(5);

  if (exactErr) throw new Error(`${vcName} query error: ${exactErr.message}`);

  const exactMatch = (exact || []).find((m) => m.name.trim().toLowerCase() === vcName.trim().toLowerCase());
  if (exactMatch) return exactMatch;

  const { data: matches, error } = await supabase
    .from('investors')
    .select('id, name, investor_score, status, entity_gate')
    .ilike('name', `%${vcName}%`)
    .neq('status', 'inactive')
    .neq('entity_gate', 'junk')
    .order('investor_score', { ascending: false, nullsFirst: false })
    .limit(12);

  if (error) throw new Error(`${vcName} query error: ${error.message}`);
  if (!matches?.length) return null;

  const ranked = [...matches].sort(
    (a, b) => nameScore(b.name, vcName) - nameScore(a.name, vcName) || (b.investor_score || 0) - (a.investor_score || 0)
  );
  const best = ranked[0];
  if (nameScore(best.name, vcName) < 40) {
    console.log(`⚠️  No strong match for "${vcName}" (best: "${best.name}") — skipping`);
    return null;
  }
  if (ranked.length > 1) {
    console.log(
      `⚠️  Multiple investors match "%${vcName}%": ${ranked.slice(0, 4).map((m) => m.name).join(' | ')} — using "${best.name}"`
    );
  }
  return best;
}

async function enrichFirm(vcName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Processing: ${vcName}`);
  console.log('='.repeat(60));

  const investor = await resolveInvestor(vcName);
  if (!investor) {
    console.log(`⚠️  ${vcName} not found in database, skipping...`);
    return { vc: vcName, status: 'not_found' as const };
  }

  const result = await InvestorEnrichmentService.enrichInvestor(investor.id, investor.name);
  return {
    vc: vcName,
    status: result.success ? ('success' as const) : ('failed' as const),
    ...result,
  };
}

async function enrichAllVCs() {
  requireServiceRoleKey();
  const { batchSize, allToday, firm } = parseArgs();

  const targets = firm
    ? [firm]
    : allToday
      ? TOP_VC_FIRM_NAMES
      : dailyVcBatch(batchSize);

  console.log('🚀 Starting VC enrichment process...');
  console.log(`   Pool: ${TOP_VC_FIRM_NAMES.length} firms · batch: ${targets.length}${firm ? ` · firm=${firm}` : ''}\n`);

  const results = [];

  for (const vcName of targets) {
    try {
      const result = await enrichFirm(vcName);
      results.push(result);
      console.log('\n⏳ Waiting 3 seconds before next VC...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`❌ Error processing ${vcName}:`, error);
      results.push({
        vc: vcName,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('📈 ENRICHMENT SUMMARY');
  console.log('='.repeat(60) + '\n');

  const successful = results.filter((r) => r.status === 'success');
  const failed = results.filter((r) => r.status === 'failed' || r.status === 'error');
  const notFound = results.filter((r) => r.status === 'not_found');

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⚠️  Not Found: ${notFound.length}`);
  console.log(`📊 Total: ${results.length}\n`);

  for (const result of results) {
    if (result.status === 'success' && 'news' in result) {
      console.log(`\n✨ ${result.vc}:`);
      console.log(`   News: ${result.news || 0} articles`);
      console.log(`   Partners: ${result.partners || 0}`);
      console.log(`   Investments: ${result.investments || 0}`);
      console.log(`   Advice: ${result.advice || 0}`);
    } else {
      console.log(`\n❌ ${result.vc}: ${result.status}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Enrichment complete!');
  console.log('='.repeat(60) + '\n');
}

enrichAllVCs().catch(console.error);
