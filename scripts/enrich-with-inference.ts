#!/usr/bin/env node
/**
 * PYTH INFERENCE ENGINE ENRICHMENT
 * ==================================
 * 
 * Uses the LOCAL inference-extractor (NO AI API CALLS) as the primary method.
 * Falls back to AI enrichment only when needed for Tier A scoring.
 * 
 * This is the CORRECT approach per the project architecture - the inference
 * engine is pure pattern matching against the 5 GOD Score questions.
 * 
 * Usage:
 *   npx tsx scripts/enrich-with-inference.ts [--limit 20] [--ai]
 * 
 * Flags:
 *   --limit N    Process N startups (default: 20)
 *   --ai         Enable AI fallback for richer extraction (uses Anthropic)
 */

import 'dotenv/config';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - JS module
import { extractInferenceData } from '../lib/inference-extractor.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Sector weights for scoring
const SECTOR_WEIGHTS: Record<string, number> = {
  'AI/ML': 15, 'FinTech': 12, 'HealthTech': 12, 'CleanTech': 10, 'DevTools': 10,
  'SaaS': 8, 'Cybersecurity': 8, 'E-Commerce': 6, 'LegalTech': 6, 'Gaming': 5,
};

/**
 * Fetch website content
 */
async function fetchWebsiteContent(url: string): Promise<string | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    console.log(`   🌐 Fetching ${fullUrl}...`);

    const response = await axios.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    // Strip HTML tags to get text
    const text = response.data
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.substring(0, 15000);
  } catch (error: any) {
    console.error(`   ❌ Fetch failed: ${error.message}`);
    return null;
  }
}

/**
 * ============================================================================
 * ⛔ REMOVED: DUPLICATE GOD SCORING (Jan 31, 2026)
 * ============================================================================
 * 
 * This script previously had its own calculateGodScore() function that:
 *   - Duplicated logic from the official GOD scoring system
 *   - Could produce different scores than startupScoringService.ts
 *   - Risked corruption if algorithms diverged
 * 
 * FIX: This script now ONLY extracts and stores inference data.
 * The official GOD scoring system (recalculate-scores.ts) handles all scoring.
 * 
 * To recalculate scores after enrichment:
 *   npx tsx scripts/recalculate-scores.ts
 * ============================================================================
 */

/**
 * Determine data tier based on inference signals (informational only)
 */
function determineDataTier(inference: any): 'A' | 'B' | 'C' {
  const hasRichData = !!(
    inference.funding_amount ||
    inference.has_revenue ||
    (inference.execution_signals?.length >= 3)
  );
  
  const hasSomeData = !!(
    inference.sectors?.length > 0 ||
    inference.team_signals?.length > 0 ||
    inference.is_launched ||
    inference.has_customers
  );

  return hasRichData ? 'A' : (hasSomeData ? 'B' : 'C');
}

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 20;
  const useAI = args.includes('--ai');

  console.log('═'.repeat(70));
  console.log('    🔥 PYTH INFERENCE ENGINE ENRICHMENT');
  console.log('═'.repeat(70));
  console.log(`\n📊 Configuration:`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Method: Inference Engine (pattern matching, NO AI)`);
  console.log(`   AI Fallback: ${useAI ? '✅ Enabled' : '❌ Disabled'}`);
  console.log('');

  // Find startups with placeholder GOD scores
  console.log('🔍 Finding startups to enrich...\n');

  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, website, total_god_score, description, tagline, extracted_data')
    .or('total_god_score.eq.60,total_god_score.lte.55')
    .not('website', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching startups:', error);
    process.exit(1);
  }

  if (!startups || startups.length === 0) {
    console.log('✅ No startups need enrichment!\n');
    return;
  }

  console.log(`📋 Found ${startups.length} startups to enrich:\n`);

  let enriched = 0;
  let failed = 0;
  const results: { name: string; before: number; after: number; tier: string; signals: string[] }[] = [];

  for (const startup of startups) {
    if (!startup.website) continue;

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📊 ${startup.name} (${startup.website})`);
    console.log(`   Current GOD Score: ${startup.total_god_score}`);

    // Fetch website content
    const content = await fetchWebsiteContent(startup.website);
    
    if (!content || content.length < 100) {
      console.log(`   ⚠️  Could not fetch content`);
      failed++;
      continue;
    }

    // Combine all text for inference
    const fullText = [
      startup.name || '',
      startup.tagline || '',
      startup.description || '',
      content
    ].join(' ');

    // Run inference engine (NO AI!)
    console.log(`   🧠 Running inference engine...`);
    const inference: any = extractInferenceData(fullText, startup.website);

    if (!inference) {
      console.log(`   ⚠️  Inference extraction failed`);
      failed++;
      continue;
    }

    // Log what we found
    const signalsFound: string[] = [];
    if (inference.sectors?.length) signalsFound.push(`Sectors: ${inference.sectors.join(', ')}`);
    if (inference.is_launched) signalsFound.push('Launched');
    if (inference.has_demo) signalsFound.push('Demo');
    if (inference.has_customers) signalsFound.push('Customers');
    if (inference.has_revenue) signalsFound.push('Revenue');
    if (inference.has_technical_cofounder) signalsFound.push('Tech Cofounder');
    if (inference.funding_amount) signalsFound.push(`Funding: $${(inference.funding_amount / 1000000).toFixed(1)}M`);
    if (inference.credential_signals?.length) signalsFound.push(`Credentials: ${inference.credential_signals.join(', ')}`);
    if (inference.grit_signals?.length) signalsFound.push(`GRIT: ${inference.grit_signals.map((g: any) => g.signal || g).join(', ')}`);

    console.log(`   📈 Signals Found: ${signalsFound.length > 0 ? signalsFound.join(' | ') : 'minimal'}`);

    // Determine data tier (informational only - DO NOT calculate scores here)
    const dataTier = determineDataTier(inference);
    console.log(`   🎯 Data Tier: ${dataTier} - run recalculate-scores.ts to update GOD score`);

    // Update database with inference data ONLY (not scores)
    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update({
        sectors: inference.sectors || startup.extracted_data?.sectors || ['Technology'],
        is_launched: inference.is_launched || false,
        has_demo: inference.has_demo || false,
        has_technical_cofounder: inference.has_technical_cofounder || false,
        // ⛔ DO NOT SET GOD SCORES HERE - use recalculate-scores.ts
        extracted_data: {
          ...(startup.extracted_data || {}),
          ...inference,
          data_tier: dataTier,
          inference_method: 'pyth_inference_engine',
          enriched_at: new Date().toISOString(),
        },
      })
      .eq('id', startup.id);

    if (updateError) {
      console.error(`   ❌ Update failed:`, updateError.message);
      failed++;
    } else {
      enriched++;
      results.push({
        name: startup.name || 'Unknown',
        before: startup.total_god_score || 60,
        after: startup.total_god_score || 60, // Score unchanged - will be recalculated
        tier: dataTier,
        signals: signalsFound,
      });
      console.log(`   ✅ Enriched! Run recalculate-scores.ts to update GOD score`);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    console.log('   ' + '─'.repeat(60));
    for (const r of results) {
      const change = r.after - r.before;
      const changeStr = change >= 0 ? `+${change}` : `${change}`;
      console.log(`   ${r.name.padEnd(20)} | ${r.before} → ${r.after} (${changeStr}) [Tier ${r.tier}]`);
    }
    console.log('');

    // Tier distribution
    const tiers = results.reduce((acc, r) => {
      acc[r.tier] = (acc[r.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('   Data Tier Distribution:');
    console.log(`      Tier A (rich data, up to 100): ${tiers['A'] || 0}`);
    console.log(`      Tier B (some data, up to 55):  ${tiers['B'] || 0}`);
    console.log(`      Tier C (sparse, up to 40):     ${tiers['C'] || 0}`);
  }

  console.log('\n✅ Enrichment complete using PYTH INFERENCE ENGINE (no AI API calls)');
  console.log('   To get Tier A scoring, add more data: traction, funding, team credentials\n');
}

main().catch(console.error);
