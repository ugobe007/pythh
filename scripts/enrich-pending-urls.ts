#!/usr/bin/env node
/**
 * ENRICH PENDING STARTUPS WITH REAL GOD SCORES
 * =============================================
 * 
 * This script finds startups with placeholder GOD scores (60) and:
 * 1. Scrapes their website
 * 2. Extracts structured data with AI
 * 3. Calculates REAL GOD scores using the tiered system
 * 4. Updates the database
 * 
 * Usage:
 *   npx tsx scripts/enrich-pending-urls.ts [--limit 20]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { scrapeAndScoreStartup, updateStartupWithScrapedData } from '../server/services/urlScrapingService';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 20;

  console.log('═'.repeat(70));
  console.log('    🔥 ENRICH PENDING STARTUPS WITH REAL GOD SCORES');
  console.log('═'.repeat(70));
  console.log(`\n📊 Configuration:`);
  console.log(`   Limit: ${limit}`);
  console.log(`   OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log('');

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-openai-key') {
    console.error('❌ OPENAI_API_KEY is required for AI extraction');
    console.error('   Set it in .env or as environment variable');
    process.exit(1);
  }

  // Find startups with placeholder GOD score (60) that have websites
  console.log('🔍 Finding startups with websites that need enrichment...\n');
  
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, website, total_god_score, extracted_data, created_at')
    .eq('status', 'approved')
    .not('website', 'is', null)
    .is('extracted_data', null)  // No extracted data yet
    .order('total_god_score', { ascending: false })  // Prioritize higher potential
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching startups:', error);
    process.exit(1);
  }

  if (!startups || startups.length === 0) {
    console.log('✅ No startups needing enrichment found!');
    console.log('   All startups with websites have been enriched.\n');
    return;
  }

  console.log(`📋 Found ${startups.length} startups to enrich:\n`);
  
  // Display what we're about to process
  for (const s of startups.slice(0, 10)) {
    console.log(`   • ${s.name} (${s.website}) - Current GOD: ${s.total_god_score}`);
  }
  if (startups.length > 10) console.log(`   ... and ${startups.length - 10} more`);
  console.log('');

  // Process each startup
  let enriched = 0;
  let failed = 0;
  const results: { name: string; before: number; after: number; tier: string }[] = [];

  for (const startup of startups) {
    if (!startup.website) continue;

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📊 Processing: ${startup.name}`);
    console.log(`   Website: ${startup.website}`);
    console.log(`   Current GOD Score: ${startup.total_god_score}`);

    try {
      // Scrape and score
      const { data, scores } = await scrapeAndScoreStartup(startup.website);

      console.log(`   📈 Extracted Data:`);
      console.log(`      Name: ${data.name}`);
      console.log(`      Tagline: ${data.tagline || '(none)'}`);
      console.log(`      Sectors: ${data.sectors?.join(', ') || '(none)'}`);
      console.log(`      MRR: ${data.mrr ? '$' + data.mrr.toLocaleString() : '(none)'}`);
      console.log(`      Customers: ${data.customer_count || '(none)'}`);
      console.log(`      Has Tech Cofounder: ${data.has_technical_cofounder || false}`);
      console.log(`      Is Launched: ${data.is_launched || false}`);

      console.log(`   🎯 GOD Score Breakdown:`);
      console.log(`      Data Tier: ${scores.data_tier}`);
      console.log(`      Vision: ${scores.vision_score}`);
      console.log(`      Market: ${scores.market_score}`);
      console.log(`      Traction: ${scores.traction_score}`);
      console.log(`      Team: ${scores.team_score}`);
      console.log(`      Product: ${scores.product_score}`);
      console.log(`      TOTAL: ${scores.total_god_score}`);

      // Update database
      const updated = await updateStartupWithScrapedData(startup.id, data, scores);

      if (updated) {
        enriched++;
        results.push({
          name: startup.name || data.name,
          before: startup.total_god_score || 60,
          after: scores.total_god_score,
          tier: scores.data_tier,
        });
        console.log(`   ✅ Updated! GOD Score: ${startup.total_god_score} → ${scores.total_god_score}`);
      } else {
        failed++;
        console.log(`   ❌ Failed to update database`);
      }

    } catch (err: any) {
      failed++;
      console.error(`   ❌ Error: ${err.message}`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('    📊 ENRICHMENT SUMMARY');
  console.log('═'.repeat(70));
  console.log(`\n   ✅ Enriched: ${enriched}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total: ${startups.length}\n`);

  if (results.length > 0) {
    console.log('   Score Changes:');
    console.log('   ' + '─'.repeat(45));
    for (const r of results) {
      const change = r.after - r.before;
      const changeStr = change >= 0 ? `+${change}` : `${change}`;
      console.log(`   ${r.name.padEnd(20)} | ${r.before} → ${r.after} (${changeStr}) [Tier ${r.tier}]`);
    }
    console.log('');
  }

  // Tier distribution
  const tierCounts = results.reduce((acc, r) => {
    acc[r.tier] = (acc[r.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('   Data Tier Distribution:');
  console.log(`      Tier A (rich data): ${tierCounts['A'] || 0}`);
  console.log(`      Tier B (some data): ${tierCounts['B'] || 0}`);
  console.log(`      Tier C (sparse):    ${tierCounts['C'] || 0}`);
  console.log('');

  // Average score
  if (results.length > 0) {
    const avgBefore = results.reduce((sum, r) => sum + r.before, 0) / results.length;
    const avgAfter = results.reduce((sum, r) => sum + r.after, 0) / results.length;
    console.log(`   Average GOD Score: ${avgBefore.toFixed(1)} → ${avgAfter.toFixed(1)}`);
    console.log('');
  }

  console.log('🎯 Next Steps:');
  console.log('   1. Review scores in admin dashboard: /admin/scoring');
  console.log('   2. Regenerate matches: node match-regenerator.js');
  console.log('   3. View in matching engine: /matching\n');
}

main().catch(console.error);
