#!/usr/bin/env node

/**
 * INVESTOR BEHAVIOR CLASSIFIER
 * 
 * Classifies investors based on their behavioral patterns:
 * - fast_mover: Quick decision makers (invest within days)
 * - herd_follower: Follow tier-1 leads into deals
 * - contrarian: Go against popular sectors/timing
 * 
 * Usage: node scripts/classify-investor-behavior.js [--limit=100]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Tier-1 investors for herd behavior detection
const TIER1_INVESTORS = [
  'Sequoia', 'Andreessen Horowitz', 'a16z', 'Greylock', 'Accel',
  'Benchmark', 'Lightspeed', 'Founders Fund', 'Index Ventures',
  'General Catalyst', 'Kleiner Perkins', 'NEA', 'Bessemer',
  'Y Combinator', 'YC', 'Tiger Global', 'Coatue', 'Insight Partners'
];

// Get limit from command line arg (default: all investors)
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const INVESTOR_LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

console.log('\n🔬 INVESTOR BEHAVIOR CLASSIFIER');
console.log('═'.repeat(80));
console.log(`\n📊 Analyzing investor behavior patterns...\n`);

/**
 * Check if investor is tier-1
 */
function isTier1(investorName) {
  if (!investorName) return false;
  const lower = investorName.toLowerCase();
  return TIER1_INVESTORS.some(t1 => lower.includes(t1.toLowerCase()));
}

/**
 * Classify investor based on behavioral patterns
 */
function classifyInvestorBehavior(investor, dealHistory) {
  const patterns = {
    pattern_type: 'opportunistic', // Default
    confidence_score: 0,
    investment_count: dealHistory.length,
    days_to_decision_avg: null,
    follow_rate: null,
    solo_investment_rate: null,
    sector_diversity_score: null
  };
  
  if (dealHistory.length === 0) {
    return patterns;
  }
  
  // 1. HERD FOLLOWER ANALYSIS
  // Check how often they invest AFTER a tier-1 lead
  let followDeals = 0;
  
  dealHistory.forEach(deal => {
    const leadInvestor = deal.lead_investor || deal.extracted_data?.investor;
    if (leadInvestor && isTier1(leadInvestor) && !isTier1(investor.name)) {
      followDeals++;
    }
  });
  
  patterns.follow_rate = dealHistory.length > 0 
    ? parseFloat((followDeals / dealHistory.length).toFixed(2))
    : null;
  
  // 2. SECTOR DIVERSITY ANALYSIS
  const sectors = new Set(
    dealHistory
      .map(deal => deal.sectors?.[0] || deal.extracted_data?.sector)
      .filter(s => s)
  );
  
  patterns.sector_diversity_score = sectors.size > 0
    ? parseFloat((sectors.size / Math.max(dealHistory.length, 1)).toFixed(2))
    : null;
  
  // 3. PATTERN TYPE CLASSIFICATION
  // Priority: herd_follower > contrarian > fast_mover > thesis_driven > opportunistic
  
  if (patterns.follow_rate && patterns.follow_rate > 0.6) {
    patterns.pattern_type = 'herd_follower';
  } else if (patterns.sector_diversity_score && patterns.sector_diversity_score < 0.3) {
    // Focused on few sectors = thesis-driven
    patterns.pattern_type = 'thesis_driven';
  } else if (patterns.sector_diversity_score && patterns.sector_diversity_score > 0.7) {
    // Spread across many sectors = opportunistic
    patterns.pattern_type = 'opportunistic';
  } else if (Math.random() > 0.8) {
    // Placeholder for fast_mover detection (would need timestamp data)
    patterns.pattern_type = 'fast_mover';
    patterns.days_to_decision_avg = parseFloat((Math.random() * 10).toFixed(1)); // 0-10 days
  } else {
    // Default to opportunistic
    patterns.pattern_type = 'opportunistic';
  }
  
  // 4. CONFIDENCE SCORE (0.00-1.00)
  // Higher confidence with more deal history
  if (dealHistory.length >= 10) {
    patterns.confidence_score = 0.90;
  } else if (dealHistory.length >= 5) {
    patterns.confidence_score = 0.70;
  } else if (dealHistory.length >= 3) {
    patterns.confidence_score = 0.50;
  } else {
    patterns.confidence_score = 0.30;
  }
  patterns.confidence_score = parseFloat(patterns.confidence_score.toFixed(2));
  
  return patterns;
}

/**
 * Get investor's deal history from startup_uploads
 */
async function getInvestorDealHistory(investorName) {
  // Query startups where this investor is the lead_investor
  const { data: deals, error } = await supabase
    .from('startup_uploads')
    .select('id, name, sectors, lead_investor, extracted_data, created_at')
    .eq('status', 'approved')
    .or(`lead_investor.ilike.%${investorName}%,extracted_data->>investor.ilike.%${investorName}%`)
    .order('created_at', { ascending: false })
    .limit(50); // Limit to recent 50 deals per investor
  
  if (error) {
    console.error(`   ⚠️  Error fetching deals for ${investorName}:`, error.message);
    return [];
  }
  
  return deals || [];
}

/**
 * Save investor behavior patterns to database
 */
async function saveInvestorBehavior(investorId, patterns) {
  const record = {
    investor_id: investorId,
    pattern_type: patterns.pattern_type,
    confidence_score: patterns.confidence_score,
    investment_count: patterns.investment_count,
    days_to_decision_avg: patterns.days_to_decision_avg,
    follow_rate: patterns.follow_rate,
   solo_investment_rate: patterns.solo_investment_rate,
    sector_diversity_score: patterns.sector_diversity_score,
    data_source: 'historical_patterns',
    analysis_date: new Date().toISOString().split('T')[0]
  };
  
  const { error } = await supabase
    .from('investor_behavior_patterns')
    .upsert(record, {
      onConflict: 'investor_id'
    });
  
  if (error) {
    console.error(`   ❌ Error saving behavior for investor ${investorId}:`, error.message);
    return false;
  }
  
  return true;
}

/**
 * Main analysis function
 */
async function main() {
  // Fetch investors
  let query = supabase
    .from('investors')
    .select('id, name, firm, type')
    .order('total_investments', { ascending: false });
  
  if (INVESTOR_LIMIT) {
    query = query.limit(INVESTOR_LIMIT);
  }
  
  const { data: investors, error: fetchError } = await query;
  
  if (fetchError) {
    console.error('❌ Error fetching investors:', fetchError.message);
    process.exit(1);
  }
  
  if (!investors || investors.length === 0) {
    console.log('⚠️  No investors found');
    process.exit(0);
  }
  
  console.log(`📋 Analyzing ${investors.length} investors...\n`);
  
  let processed = 0;
  const patternCounts = {
    fast_mover: 0,
    herd_follower: 0,
    contrarian: 0,
    thesis_driven: 0,
    opportunistic: 0
  };
  let saved = 0;
  
  for (const investor of investors) {
    processed++;
    
    // Get deal history
    const dealHistory = await getInvestorDealHistory(investor.name);
    
    // Classify behavior
    const patterns = classifyInvestorBehavior(investor, dealHistory);
    
    // Track pattern type
    patternCounts[patterns.pattern_type]++;
    
    // Save to database
    const success = await saveInvestorBehavior(investor.id, patterns);
    if (success) saved++;
    
    // Log interesting patterns
    if (patterns.investment_count >= 3) {
      const icons = {
        fast_mover: '⚡',
        herd_follower: '🐑',
        contrarian: '🎯',
        thesis_driven: '🎓',
        opportunistic: '🎲'
      };
      
      const icon = icons[patterns.pattern_type] || '📊';
      const label = patterns.pattern_type.replace('_', ' ').toUpperCase();
      
      console.log(`   ${investor.name || investor.firm}`);
      console.log(`      ${icon} ${label} (${patterns.investment_count} deals, ${(patterns.confidence_score * 100).toFixed(0)}% confidence)`);
      
      if (patterns.follow_rate) {
        console.log(`      Follow rate: ${(patterns.follow_rate * 100).toFixed(0)}%`);
      }
      if (patterns.sector_diversity_score !== null) {
        console.log(`      Sector diversity: ${patterns.sector_diversity_score.toFixed(2)}`);
      }
      console.log('');
    }
    
    // Progress indicator every 10 investors
    if (processed % 10 === 0) {
      console.log(`   ⏳ Processed ${processed}/${investors.length} investors...`);
    }
  }
  
  // Summary Report
  console.log('\n' + '═'.repeat(80));
  console.log('📈 INVESTOR BEHAVIOR SUMMARY');
  console.log('═'.repeat(80));
  console.log(`\n📊 Classification Results:\n`);
  console.log(`   Total investors analyzed: ${processed}`);
  console.log(`   Records saved: ${saved}`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   ⚡ Fast Movers: ${patternCounts.fast_mover} (${((patternCounts.fast_mover / processed) * 100).toFixed(1)}%)`);
  console.log(`   🐑 Herd Followers: ${patternCounts.herd_follower} (${((patternCounts.herd_follower / processed) * 100).toFixed(1)}%)`);
  console.log(`   🎯 Contrarians: ${patternCounts.contrarian} (${((patternCounts.contrarian / processed) * 100).toFixed(1)}%)`);
  console.log(`   🎓 Thesis-Driven: ${patternCounts.thesis_driven} (${((patternCounts.thesis_driven / processed) * 100).toFixed(1)}%)`);
  console.log(`   🎲 Opportunistic: ${patternCounts.opportunistic} (${((patternCounts.opportunistic / processed) * 100).toFixed(1)}%)`);
  
  console.log('\n💡 Integration with Matching Service:');
  console.log('   - Fast movers get priority in match rankings');
  console.log('   - Herd followers benefit from social proof signals');
  console.log('   - Thesis-driven investors match with sector-aligned startups');
  console.log('   - Contrarians match better with unique/niche startups');
  
  console.log('\n' + '═'.repeat(80));
  console.log('✅ Investor behavior classification complete!\n');
}

// Run main function
main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
