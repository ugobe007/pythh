#!/usr/bin/env tsx

/**
 * Enrich VC data from their websites, blogs, and news sources
 * Run with: npx tsx scripts/enrich-vcs.ts
 */

import { supabase } from '../src/lib/supabase';
import { InvestorEnrichmentService } from '../src/lib/investorEnrichmentService';

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

// Target VCs to enrich (top 10 from your database)
const TARGET_VCS = [
  'Y Combinator',
  'Sequoia Capital',
  'Andreessen Horowitz',
  'Accel',
  'Benchmark',
  'Founders Fund',
  'Greylock Partners',
  'Lightspeed Venture Partners',
  'NEA',
  'Kleiner Perkins'
];

async function enrichAllVCs() {
  requireServiceRoleKey();
  console.log('🚀 Starting VC enrichment process...\n');
  
  const results = [];
  
  for (const vcName of TARGET_VCS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Processing: ${vcName}`);
    console.log('='.repeat(60));
    
    try {
      // Find investor in database (avoid .single(): multiple ILIKE matches → PGRST116)
      const { data: matches, error } = await supabase
        .from('investors')
        .select('id, name')
        .ilike('name', `%${vcName}%`)
        .limit(8);
      
      if (error) {
        console.log(`⚠️  ${vcName} query error: ${error.message}`);
        results.push({ vc: vcName, status: 'query_error', error: error.message });
        continue;
      }
      if (!matches?.length) {
        console.log(`⚠️  ${vcName} not found in database, skipping...`);
        results.push({ vc: vcName, status: 'not_found' });
        continue;
      }
      if (matches.length > 1) {
        console.log(
          `⚠️  Multiple investors match "%${vcName}%": ${matches.map((m) => m.name).join(' | ')} — using first: "${matches[0].name}"`
        );
      }
      const investor = matches[0];
      
      // Enrich investor data
      const result = await InvestorEnrichmentService.enrichInvestor(
        investor.id,
        investor.name
      );
      
      results.push({
        vc: vcName,
        status: result.success ? 'success' : 'failed',
        ...result
      });
      
      // Rate limiting: wait 3 seconds between VCs
      console.log('\n⏳ Waiting 3 seconds before next VC...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`❌ Error processing ${vcName}:`, error);
      results.push({ 
        vc: vcName, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📈 ENRICHMENT SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error');
  const notFound = results.filter(r => r.status === 'not_found');
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⚠️  Not Found: ${notFound.length}`);
  console.log(`📊 Total: ${results.length}\n`);
  
  // Detailed results
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

// Run enrichment
enrichAllVCs().catch(console.error);
