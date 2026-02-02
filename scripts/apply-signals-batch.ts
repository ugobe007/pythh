/**
 * ============================================================================
 * APPLY SIGNALS BATCH JOB
 * ============================================================================
 * 
 * Calculates and applies signal bonuses to all approved startups
 * 
 * SIGNAL DIMENSIONS (5 total, max 10 points):
 *   - product_velocity (max 2.0 pts)
 *   - funding_acceleration (max 2.5 pts)
 *   - customer_adoption (max 2.0 pts)
 *   - market_momentum (max 1.5 pts)
 *   - competitive_dynamics (max 2.0 pts)
 * 
 * Run: npx tsx scripts/apply-signals-batch.ts
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

// ============================================================================
// SIGNAL DIMENSION CALCULATORS
// ============================================================================

function calculateProductVelocity(startup: any): number {
  let score = 0;
  
  // Launched product
  if (startup.launched || startup.is_launched) {
    score += 0.3;
  }
  
  // Has demo
  if (startup.has_demo || startup.demo_available) {
    score += 0.2;
  }
  
  // Recent launch (within 6 months of founding)
  if (startup.founded_date && startup.launched) {
    const foundedDate = new Date(startup.founded_date);
    const now = new Date();
    const monthsSinceFounding = (now.getTime() - foundedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsSinceFounding <= 6) {
      score += 0.3;
    } else if (monthsSinceFounding <= 12) {
      score += 0.15;
    }
  }
  
  // Check extracted_data for product signals
  const extracted = startup.extracted_data || {};
  if (extracted.launched || extracted.has_product || extracted.product_live) {
    score += 0.2;
  }
  
  // Text signals
  const text = [
    startup.tagline || '', 
    startup.pitch || '', 
    startup.description || '',
    startup.value_proposition || '',
    startup.product || '',
    extracted.product_description || ''
  ].join(' ').toLowerCase();
  
  if (text.includes('shipped') || text.includes('launched') || text.includes('live')) {
    score += 0.1;
  }
  if (text.includes('fast') || text.includes('rapid') || text.includes('agile')) {
    score += 0.1;
  }
  if (text.includes('mvp') || text.includes('beta') || text.includes('prototype')) {
    score += 0.15;
  }
  
  return Math.min(1, score);
}

function calculateFundingAcceleration(startup: any): number {
  let score = 0;
  const extracted = startup.extracted_data || {};
  
  // Has previous funding
  if (startup.previous_funding || startup.funding_amount || extracted.funding_raised) {
    score += 0.3;
  }
  
  // YC or top-tier accelerator
  if (startup.is_yc || startup.accelerator === 'YC' || extracted.accelerator?.toLowerCase().includes('y combinator')) {
    score += 0.3;
  }
  
  // Multiple investors interested
  if (startup.investor_interest_count && startup.investor_interest_count > 3) {
    score += 0.2;
  }
  
  // Recent funding (within last 6 months)
  if (startup.last_funding_date) {
    const fundingDate = new Date(startup.last_funding_date);
    const now = new Date();
    const monthsSinceFunding = (now.getTime() - fundingDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsSinceFunding <= 6) {
      score += 0.2;
    }
  }
  
  // Text signals
  const text = [
    startup.tagline || '', 
    startup.pitch || '', 
    startup.description || '',
    startup.investment || '',
    extracted.funding_info || ''
  ].join(' ').toLowerCase();
  
  if (text.includes('raised') || text.includes('funded') || text.includes('investment')) {
    score += 0.1;
  }
  if (text.includes('yc') || text.includes('sequoia') || text.includes('a16z') || text.includes('tier 1')) {
    score += 0.1;
  }
  if (text.includes('oversubscribed') || text.includes('pre-empted')) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

function calculateCustomerAdoption(startup: any): number {
  let score = 0;
  const extracted = startup.extracted_data || {};
  
  // Has customers
  if (startup.customers || startup.customer_count || startup.has_customers || extracted.customers) {
    score += 0.3;
  }
  
  // Has revenue
  if (startup.revenue || startup.mrr || startup.arr || startup.has_revenue || extracted.revenue) {
    score += 0.3;
  }
  
  // Growth rate
  if (startup.growth_rate && startup.growth_rate > 20) {
    score += 0.2;
  }
  
  // Waitlist
  if (startup.waitlist_count && startup.waitlist_count > 100) {
    score += 0.15;
  }
  
  // Text signals
  const text = [
    startup.tagline || '', 
    startup.pitch || '', 
    startup.description || '',
    startup.traction || '',
    startup.problem || '',
    extracted.traction_info || ''
  ].join(' ').toLowerCase();
  
  if (text.includes('customers') || text.includes('users') || text.includes('clients')) {
    score += 0.1;
  }
  if (text.includes('growth') || text.includes('growing') || text.includes('traction')) {
    score += 0.1;
  }
  if (text.includes('revenue') || text.includes('mrr') || text.includes('arr')) {
    score += 0.1;
  }
  if (text.includes('paying') || text.includes('subscribers')) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

function calculateMarketMomentum(startup: any): number {
  let score = 0;
  const extracted = startup.extracted_data || {};
  
  // Press mentions
  if (startup.press_mentions && startup.press_mentions > 0) {
    score += Math.min(0.4, startup.press_mentions * 0.1);
  }
  
  // News signals
  if (startup.news_count && startup.news_count > 0) {
    score += Math.min(0.3, startup.news_count * 0.05);
  }
  
  // Product Hunt launch
  if (startup.product_hunt_rank || extracted.product_hunt) {
    score += 0.2;
  }
  
  // Text signals
  const text = [
    startup.tagline || '', 
    startup.pitch || '', 
    startup.description || '',
    startup.market || '',
    extracted.market_info || ''
  ].join(' ').toLowerCase();
  
  if (text.includes('featured') || text.includes('press') || text.includes('techcrunch')) {
    score += 0.2;
  }
  if (text.includes('trending') || text.includes('viral') || text.includes('buzz')) {
    score += 0.15;
  }
  if (text.includes('product hunt') || text.includes('#1')) {
    score += 0.2;
  }
  
  return Math.min(1, score);
}

function calculateCompetitiveDynamics(startup: any): number {
  let score = 0;
  const extracted = startup.extracted_data || {};
  
  // Defensibility
  if (startup.defensibility === 'high' || startup.unique_ip || extracted.patents) {
    score += 0.4;
  } else if (startup.defensibility === 'medium') {
    score += 0.2;
  }
  
  // Strategic partners
  if (startup.strategic_partners && startup.strategic_partners.length > 0) {
    score += Math.min(0.3, startup.strategic_partners.length * 0.1);
  }
  
  // Strong team signals
  if (startup.team_score && startup.team_score > 80) {
    score += 0.2;
  }
  
  // Text signals
  const text = [
    startup.tagline || '', 
    startup.pitch || '', 
    startup.description || '',
    startup.solution || '',
    startup.team || '',
    extracted.competitive_advantage || ''
  ].join(' ').toLowerCase();
  
  if (text.includes('moat') || text.includes('defensible') || text.includes('patent')) {
    score += 0.2;
  }
  if (text.includes('network effect') || text.includes('flywheel') || text.includes('unfair advantage')) {
    score += 0.15;
  }
  if (text.includes('only') || text.includes('first') || text.includes('unique')) {
    score += 0.1;
  }
  if (text.includes('google') || text.includes('meta') || text.includes('stanford') || text.includes('mit')) {
    score += 0.15;  // Prestigious team background
  }
  
  return Math.min(1, score);
}

// Signal max points
const SIGNAL_MAX_POINTS = {
  product_velocity: 2.0,
  funding_acceleration: 2.5,
  customer_adoption: 2.0,
  market_momentum: 1.5,
  competitive_dynamics: 2.0,
} as const;

// ============================================================================
// MAIN BATCH PROCESSOR
// ============================================================================

async function applySignalsBatch() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    APPLYING SIGNALS TO ALL STARTUPS');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  // Fetch all approved startups
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null);
  
  if (error) {
    console.error('Error fetching startups:', error);
    return;
  }
  
  console.log(`Found ${startups?.length || 0} approved startups\n`);
  
  if (!startups || startups.length === 0) return;
  
  let processed = 0;
  let updated = 0;
  const bonusDistribution = { minimal: 0, typical: 0, strong: 0, hot: 0, rare: 0 };
  let totalBonus = 0;
  
  for (const startup of startups) {
    // Calculate signal dimensions
    const dimensions = {
      product_velocity: calculateProductVelocity(startup),
      funding_acceleration: calculateFundingAcceleration(startup),
      customer_adoption: calculateCustomerAdoption(startup),
      market_momentum: calculateMarketMomentum(startup),
      competitive_dynamics: calculateCompetitiveDynamics(startup),
    };
    
    // Calculate bonus points
    const bonus_points = {
      product_velocity: dimensions.product_velocity * SIGNAL_MAX_POINTS.product_velocity,
      funding_acceleration: dimensions.funding_acceleration * SIGNAL_MAX_POINTS.funding_acceleration,
      customer_adoption: dimensions.customer_adoption * SIGNAL_MAX_POINTS.customer_adoption,
      market_momentum: dimensions.market_momentum * SIGNAL_MAX_POINTS.market_momentum,
      competitive_dynamics: dimensions.competitive_dynamics * SIGNAL_MAX_POINTS.competitive_dynamics,
    };
    
    // Total signals bonus (0-10)
    let signals_bonus = 
      bonus_points.product_velocity +
      bonus_points.funding_acceleration +
      bonus_points.customer_adoption +
      bonus_points.market_momentum +
      bonus_points.competitive_dynamics;
    
    // Round to 1 decimal and clamp
    signals_bonus = Math.round(signals_bonus * 10) / 10;
    signals_bonus = Math.max(0, Math.min(10, signals_bonus));
    
    // Track distribution
    if (signals_bonus < 1) bonusDistribution.minimal++;
    else if (signals_bonus < 3) bonusDistribution.typical++;
    else if (signals_bonus < 5) bonusDistribution.strong++;
    else if (signals_bonus < 7) bonusDistribution.hot++;
    else bonusDistribution.rare++;
    
    totalBonus += signals_bonus;
    
    // Update startup_uploads with signal columns
    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update({
        signals_bonus: signals_bonus,
        product_velocity_signal: dimensions.product_velocity,
        funding_acceleration_signal: dimensions.funding_acceleration,
        customer_adoption_signal: dimensions.customer_adoption,
        market_momentum_signal: dimensions.market_momentum,
        competitive_dynamics_signal: dimensions.competitive_dynamics,
        signals_updated_at: new Date().toISOString(),
      })
      .eq('id', startup.id);
    
    if (updateError) {
      console.error(`Error updating ${startup.name}:`, updateError);
    } else {
      updated++;
    }
    
    // Also upsert into startup_signals_state for 50% threshold tracking
    await supabase
      .from('startup_signals_state')
      .upsert({
        startup_id: startup.id,
        dimensions: dimensions,
        signals_bonus: signals_bonus,
        last_significant_change: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'startup_id' });
    
    processed++;
    
    if (processed % 100 === 0) {
      console.log(`  Processed ${processed}/${startups.length}...`);
    }
  }
  
  console.log(`\n✅ COMPLETE: ${updated}/${processed} startups updated\n`);
  
  // Show distribution
  const avgBonus = totalBonus / processed;
  console.log('SIGNAL BONUS DISTRIBUTION:');
  console.log(`  0-1 (minimal):   ${bonusDistribution.minimal} (${(bonusDistribution.minimal/processed*100).toFixed(1)}%)`);
  console.log(`  1-3 (typical):   ${bonusDistribution.typical} (${(bonusDistribution.typical/processed*100).toFixed(1)}%)`);
  console.log(`  3-5 (strong):    ${bonusDistribution.strong} (${(bonusDistribution.strong/processed*100).toFixed(1)}%)`);
  console.log(`  5-7 (hot):       ${bonusDistribution.hot} (${(bonusDistribution.hot/processed*100).toFixed(1)}%)`);
  console.log(`  7-10 (rare):     ${bonusDistribution.rare} (${(bonusDistribution.rare/processed*100).toFixed(1)}%)`);
  console.log(`\n  Average bonus: ${avgBonus.toFixed(2)}`);
  
  // Show top 10 by signals
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    TOP 10 BY SIGNAL BONUS');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const { data: topSignals } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, signals_bonus')
    .eq('status', 'approved')
    .not('signals_bonus', 'is', null)
    .order('signals_bonus', { ascending: false })
    .limit(10);
  
  if (topSignals) {
    console.log('Name                                    GOD    Signals  Final');
    console.log('─'.repeat(65));
    topSignals.forEach(s => {
      const final = Math.min(100, (s.total_god_score || 0) + (s.signals_bonus || 0));
      const name = (s.name || 'Unknown').substring(0, 38).padEnd(40);
      console.log(`${name}${(s.total_god_score || 0).toFixed(1).padStart(5)}  ${(s.signals_bonus || 0).toFixed(1).padStart(7)}  ${final.toFixed(1).padStart(5)}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    SIGNALS DEPLOYMENT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

applySignalsBatch();
