#!/usr/bin/env node

/**
 * SECTOR MOMENTUM ANALYZER
 * 
 * Analyzes investment activity by sector to detect "hot sector" cascades.
 * Tracks tier-1 investor activity, deal velocity, and momentum scores.
 * 
 * Usage: node scripts/analyze-sector-momentum.js [--weeks=4]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Tier-1 investors (based on lib/inference-extractor.js)
const TIER1_INVESTORS = [
  'Sequoia', 'Andreessen Horowitz', 'a16z', 'Greylock', 'Accel',
  'Benchmark', 'Lightspeed', 'Founders Fund', 'Index Ventures',
  'General Catalyst', 'Kleiner Perkins', 'NEA', 'Bessemer',
  'Y Combinator', 'YC', 'Tiger Global', 'Coatue', 'Insight Partners'
];

// Get number of weeks from command line arg (default: 4)
const weeksArg = process.argv.find(arg => arg.startsWith('--weeks='));
const NUM_WEEKS = weeksArg ? parseInt(weeksArg.split('=')[1]) : 4;

console.log('\n🔬 SECTOR MOMENTUM ANALYZER');
console.log('═'.repeat(80));
console.log(`\n📊 Analyzing ${NUM_WEEKS} weeks of investment activity...\n`);

/**
 * Check if investor name matches tier-1 list
 */
function isTier1Investor(investorName) {
  if (!investorName) return false;
  const lower = investorName.toLowerCase();
  return TIER1_INVESTORS.some(t1 => 
    lower.includes(t1.toLowerCase())
  );
}

/**
 * Get week boundaries (Monday to Sunday)
 */
function getWeekBoundaries(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return {
    start: weekStart,
    end: weekEnd
  };
}

/**
 * Calculate momentum score (0.00 to 1.00)
 * Based on: deal velocity, tier-1 activity, deal sizes
 */
function calculateMomentumScore(metrics) {
  const {
    signal_velocity,
    tier1_investor_count,
    total_deal_count,
    avg_deal_size_millions
  } = metrics;
  
  // Velocity factor (0-0.4): Deals per week
  // 0 deals = 0, 10+ deals/week = 0.4
  const velocityFactor = Math.min((signal_velocity / 10) * 0.4, 0.4);
  
  // Tier-1 factor (0-0.3): Presence of top VCs
  // 0 tier-1 = 0, 3+ tier-1 = 0.3
  const tier1Factor = Math.min((tier1_investor_count / 3) * 0.3, 0.3);
  
  // Volume factor (0-0.2): Total deal count
  // 0 deals = 0, 15+ deals = 0.2
  const volumeFactor = Math.min((total_deal_count / 15) * 0.2, 0.2);
  
  // Size factor (0-0.1): Average deal size
  // $0M = 0, $50M+ = 0.1
  const sizeFactor = avg_deal_size_millions 
    ? Math.min((avg_deal_size_millions / 50) * 0.1, 0.1)
    : 0;
  
  return Math.min(velocityFactor + tier1Factor + volumeFactor + sizeFactor, 1.0);
}

/**
 * Extract sector from startup data
 */
function extractSector(startup) {
  // Priority: sectors[0] > extracted_data.sector > description parsing
  
  // sectors is an array in the database
  if (startup.sectors && Array.isArray(startup.sectors) && startup.sectors.length > 0) {
    return startup.sectors[0]; // Take first sector
  }
  
  if (startup.extracted_data?.sector) return startup.extracted_data.sector;
  
  // Fallback: parse from description
  const text = (startup.description || startup.pitch || startup.tagline || '').toLowerCase();
  
  if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning')) {
    return 'AI/ML';
  } else if (text.includes('fintech') || text.includes('financial') || text.includes('banking')) {
    return 'Fintech';
  } else if (text.includes('health') || text.includes('medical') || text.includes('biotech')) {
    return 'Healthcare';
  } else if (text.includes('crypto') || text.includes('blockchain') || text.includes('web3')) {
    return 'Crypto/Web3';
  } else if (text.includes('saas') || text.includes('enterprise') || text.includes('software')) {
    return 'Enterprise SaaS';
  } else if (text.includes('climate') || text.includes('energy') || text.includes('sustainability')) {
    return 'Climate Tech';
  }
  
  return 'Other';
}

/**
 * Extract funding amount from startup data
 */
function extractFundingAmount(startup) {
  // Try latest_funding_amount field
  if (startup.latest_funding_amount) {
    return parseFloat(startup.latest_funding_amount);
  }
  
  // Try extracted_data
  if (startup.extracted_data?.funding_amount) {
    const amount = startup.extracted_data.funding_amount;
    if (typeof amount === 'number') return amount;
    
    // Parse string like "$5M" or "5 million"
    const match = amount.match(/(\d+(?:\.\d+)?)\s*(?:M|million)/i);
    if (match) return parseFloat(match[1]);
  }
  
  return null;
}

/**
 * Extract investor name from startup data
 */
function extractInvestor(startup) {
  // Try lead_investor field
  if (startup.lead_investor) return startup.lead_investor;
  
  // Try extracted_data
  if (startup.extracted_data?.investor) return startup.extracted_data.investor;
  if (startup.extracted_data?.investors && Array.isArray(startup.extracted_data.investors)) {
    return startup.extracted_data.investors[0]; // First investor
  }
  
  return null;
}

/**
 * Analyze sector momentum for given week
 */
async function analyzeSectorForWeek(weekStart, weekEnd) {
  // Fetch startups discovered/updated in this week
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, sectors, description, pitch, tagline, extracted_data, latest_funding_amount, lead_investor, created_at')
    .gte('created_at', weekStart.toISOString())
    .lte('created_at', weekEnd.toISOString())
    .eq('status', 'approved');
  
  if (error) {
    console.error('❌ Error fetching startups:', error.message);
    return [];
  }
  
  if (!startups || startups.length === 0) {
    return [];
  }
  
  // Group by sector
  const sectorData = {};
  
  startups.forEach(startup => {
    const sector = extractSector(startup);
    const investor = extractInvestor(startup);
    const fundingAmount = extractFundingAmount(startup);
    
    if (!sectorData[sector]) {
      sectorData[sector] = {
        sector,
        deals: [],
        tier1_investors: new Set(),
        total_deal_count: 0,
        funding_amounts: []
      };
    }
    
    sectorData[sector].deals.push(startup);
    sectorData[sector].total_deal_count++;
    
    if (fundingAmount) {
      sectorData[sector].funding_amounts.push(fundingAmount);
    }
    
    if (investor && isTier1Investor(investor)) {
      sectorData[sector].tier1_investors.add(investor);
    }
  });
  
  // Calculate metrics for each sector
  const sectorMetrics = Object.values(sectorData).map(data => {
    const daysInWeek = 7;
    // Signal velocity: deals per day (not per week to avoid overflow)
    const signal_velocity = data.total_deal_count / daysInWeek;
    
    const avg_deal_size_millions = data.funding_amounts.length > 0
      ? data.funding_amounts.reduce((sum, amt) => sum + amt, 0) / data.funding_amounts.length
      : null;
    
    // Cap avg_deal_size to prevent overflow (DECIMAL(8,2) max is 999,999.99)
    // Realistic max: $100B deal = 100,000
    const capped_avg_deal_size = avg_deal_size_millions !== null
      ? Math.min(avg_deal_size_millions, 99999)
      : null;
    
    const tier1_investor_count = data.tier1_investors.size;
    const tier1_investors_array = Array.from(data.tier1_investors);
    
    // For momentum score calculation, use weekly velocity
    const weekly_velocity = data.total_deal_count;
    const momentum_score = calculateMomentumScore({
      signal_velocity: weekly_velocity,
      tier1_investor_count,
      total_deal_count: data.total_deal_count,
      avg_deal_size_millions: capped_avg_deal_size
    });
    
    return {
      sector: data.sector,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      signal_velocity: parseFloat(signal_velocity.toFixed(2)), // Deals per day
      tier1_investor_count,
      total_deal_count: data.total_deal_count,
      avg_deal_size_millions: capped_avg_deal_size ? parseFloat(capped_avg_deal_size.toFixed(2)) : null,
      momentum_score: parseFloat(momentum_score.toFixed(2)),
      momentum_change_pct: null, // Calculate later
      tier1_investors: tier1_investors_array
    };
  });
  
  return sectorMetrics;
}

/**
 * Calculate momentum change vs previous week
 */
async function calculateMomentumChange(sector, weekStart, currentScore) {
  // Get previous week's score
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  
  const { data: prevData, error } = await supabase
    .from('sector_momentum')
    .select('momentum_score')
    .eq('sector', sector)
    .eq('week_start', prevWeekStart.toISOString().split('T')[0])
    .single();
  
  if (error || !prevData) return null;
  
  const prevScore = prevData.momentum_score;
  if (prevScore === 0) return null;
  
  const changePercent = ((currentScore - prevScore) / prevScore) * 100;
  return parseFloat(changePercent.toFixed(2));
}

/**
 * Save sector momentum to database
 */
async function saveSectorMomentum(metrics) {
  // Cap momentum_change_pct to prevent overflow (DECIMAL(5,2) max is 999.99)
  if (metrics.momentum_change_pct !== null) {
    metrics.momentum_change_pct = Math.max(-999, Math.min(999, metrics.momentum_change_pct));
  }
  
  const { error } = await supabase
    .from('sector_momentum')
    .upsert(metrics, {
      onConflict: 'sector,week_start'
    });
  
  if (error) {
    console.error(`❌ Error saving ${metrics.sector}:`, error.message);
    // Debug: log the problematic data
    console.error('   Data:', JSON.stringify(metrics, null, 2));
    return false;
  }
  
  return true;
}

/**
 * Main analysis function
 */
async function main() {
  const now = new Date();
  const allMetrics = [];
  
  // Analyze each of the past N weeks
  for (let i = 0; i < NUM_WEEKS; i++) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    
    const { start, end } = getWeekBoundaries(weekDate);
    
    console.log(`\n⏳ Week ${i + 1}: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
    
    const weekMetrics = await analyzeSectorForWeek(start, end);
    
    if (weekMetrics.length === 0) {
      console.log('   No deals found this week');
      continue;
    }
    
    // Calculate momentum change for each sector
    for (const metrics of weekMetrics) {
      const change = await calculateMomentumChange(metrics.sector, start, metrics.momentum_score);
      metrics.momentum_change_pct = change;
    }
    
    // Save to database
    let savedCount = 0;
    for (const metrics of weekMetrics) {
      const success = await saveSectorMomentum(metrics);
      if (success) savedCount++;
    }
    
    console.log(`   ✅ Analyzed ${weekMetrics.length} sectors, saved ${savedCount} records`);
    allMetrics.push(...weekMetrics);
  }
  
  // Summary Report
  console.log('\n' + '═'.repeat(80));
  console.log('📈 SECTOR MOMENTUM SUMMARY');
  console.log('═'.repeat(80));
  
  // Get latest week's hottest sectors
  const latestWeek = getWeekBoundaries(now);
  const { data: topSectors, error: topError } = await supabase
    .from('sector_momentum')
    .select('*')
    .eq('week_start', latestWeek.start.toISOString().split('T')[0])
    .order('momentum_score', { ascending: false })
    .limit(5);
  
  if (!topError && topSectors && topSectors.length > 0) {
    console.log('\n🔥 TOP 5 HOTTEST SECTORS (Latest Week):\n');
    
    topSectors.forEach((sector, i) => {
      const changeIcon = sector.momentum_change_pct > 0 ? '📈' : sector.momentum_change_pct < 0 ? '📉' : '➡️';
      const changeText = sector.momentum_change_pct !== null 
        ? ` ${changeIcon} ${sector.momentum_change_pct > 0 ? '+' : ''}${sector.momentum_change_pct}%`
        : '';
      
      console.log(`${i + 1}. ${sector.sector}`);
      console.log(`   Momentum Score: ${sector.momentum_score.toFixed(2)}/1.00${changeText}`);
      console.log(`   Deal Velocity: ${sector.signal_velocity} deals/week`);
      console.log(`   Tier-1 Investors: ${sector.tier1_investor_count} (${sector.tier1_investors.join(', ')})`);
      console.log(`   Total Deals: ${sector.total_deal_count}`);
      if (sector.avg_deal_size_millions) {
        console.log(`   Avg Deal Size: $${sector.avg_deal_size_millions}M`);
      }
      console.log('');
    });
  }
  
  // Overall stats
  const uniqueSectors = new Set(allMetrics.map(m => m.sector));
  const totalDeals = allMetrics.reduce((sum, m) => sum + m.total_deal_count, 0);
  const totalTier1 = new Set(allMetrics.flatMap(m => m.tier1_investors)).size;
  
  console.log('─'.repeat(80));
  console.log(`\n📊 Overall Statistics:`);
  console.log(`   Weeks analyzed: ${NUM_WEEKS}`);
  console.log(`   Unique sectors: ${uniqueSectors.size}`);
  console.log(`   Total deals tracked: ${totalDeals}`);
  console.log(`   Unique tier-1 investors: ${totalTier1}`);
  
  console.log('\n' + '═'.repeat(80));
  console.log('✅ Sector momentum analysis complete!\n');
}

// Run main function
main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
