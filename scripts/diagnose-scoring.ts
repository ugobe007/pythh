/**
 * GOD SCORE SYSTEM HEALTH CHECK
 * Diagnoses issues with component scores and their scaling
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateHotScore } from '../server/services/startupScoringService';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function diagnose() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    GOD SCORING SYSTEM HEALTH CHECK');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Get a few startups to test
  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('status', 'approved')
    .limit(10);

  if (!startups || startups.length === 0) {
    console.log('No startups found');
    return;
  }

  console.log('PROBLEM 1: Mismatch between algorithm output and stored values\n');
  console.log('The algorithm returns breakdown on 0-3 scale (e.g., team_execution: 2.5)');
  console.log('But recalculate-scores.ts scales these to 0-100 before storing.\n');

  console.log('Current scaling in recalculate-scores.ts (lines 156-170):');
  console.log('  team_score = (team_execution + team_age) / 2.0 * 100');
  console.log('  traction_score = traction / 2.5 * 100');
  console.log('  market_score = (market + market_insight) / 2.5 * 100');
  console.log('  product_score = product / 2.0 * 100');
  console.log('  vision_score = product_vision / 0.5 * 100');
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    TESTING RAW ALGORITHM OUTPUT');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const startup of startups.slice(0, 5)) {
    // Run the scoring algorithm
    const profile = {
      tagline: startup.tagline,
      pitch: startup.description || startup.pitch,
      problem: startup.problem,
      solution: startup.solution,
      market_size: startup.market_size,
      industries: startup.industries || startup.sectors || [],
      team: startup.team_companies ? startup.team_companies.map((c: string) => ({
        name: 'Team Member',
        previousCompanies: [c]
      })) : [],
      founders_count: startup.team_size || 1,
      technical_cofounders: startup.has_technical_cofounder ? 1 : 0,
      launched: startup.is_launched,
      demo_available: startup.has_demo,
      founded_date: startup.founded_date || startup.created_at,
      value_proposition: startup.value_proposition || startup.tagline,
      ...(startup.extracted_data || {})
    };

    const result = calculateHotScore(profile);
    
    console.log(`\n${startup.name}:`);
    console.log('  RAW ALGORITHM OUTPUT (0-3 or 0-2 scale):');
    console.log(`    team_execution: ${result.breakdown.team_execution?.toFixed(2) || 0}`);
    console.log(`    team_age: ${result.breakdown.team_age?.toFixed(2) || 0}`);
    console.log(`    product_vision: ${result.breakdown.product_vision?.toFixed(2) || 0}`);
    console.log(`    traction: ${result.breakdown.traction?.toFixed(2) || 0}`);
    console.log(`    market: ${result.breakdown.market?.toFixed(2) || 0}`);
    console.log(`    market_insight: ${result.breakdown.market_insight?.toFixed(2) || 0}`);
    console.log(`    product: ${result.breakdown.product?.toFixed(2) || 0}`);
    console.log(`    total (0-10): ${result.total.toFixed(2)} → GOD score: ${Math.round(result.total * 10)}`);
    
    console.log('  STORED IN DATABASE (0-100 scale):');
    console.log(`    team_score: ${startup.team_score}`);
    console.log(`    traction_score: ${startup.traction_score}`);
    console.log(`    market_score: ${startup.market_score}`);
    console.log(`    product_score: ${startup.product_score}`);
    console.log(`    vision_score: ${startup.vision_score}`);
    console.log(`    total_god_score: ${startup.total_god_score}`);

    // Show what the scaling SHOULD produce
    const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
    const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
    
    console.log('  WHAT SCALING FORMULA PRODUCES:');
    console.log(`    team_score: ${Math.round((teamCombined / 2.0) * 100)} (formula: ${teamCombined.toFixed(2)} / 2.0 * 100)`);
    console.log(`    traction_score: ${Math.round(((result.breakdown.traction || 0) / 2.5) * 100)}`);
    console.log(`    market_score: ${Math.round((marketCombined / 2.5) * 100)}`);
    console.log(`    product_score: ${Math.round(((result.breakdown.product || 0) / 2.0) * 100)}`);
    console.log(`    vision_score: ${Math.round(((result.breakdown.product_vision || 0) / 0.5) * 100)}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    ISSUES IDENTIFIED');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('ISSUE 1: team_score scaling is WRONG');
  console.log('  - Algorithm max: team_execution (3.0) + team_age (1.0) = 4.0');
  console.log('  - Formula uses: / 2.0 * 100 → allows scores > 100');
  console.log('  - Should use: / 4.0 * 100\n');

  console.log('ISSUE 2: vision_score scaling is WRONG');
  console.log('  - Algorithm max: product_vision = 2.0');
  console.log('  - Formula uses: / 0.5 * 100 → always produces scores > 100');
  console.log('  - Should use: / 2.0 * 100\n');

  console.log('ISSUE 3: market_score scaling is WRONG');
  console.log('  - Algorithm max: market (2.0) + market_insight (1.5) = 3.5');
  console.log('  - Formula uses: / 2.5 * 100 → allows scores > 100');
  console.log('  - Should use: / 3.5 * 100\n');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    RECOMMENDED FIX');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('Update recalculate-scores.ts with CORRECT maxes:');
  console.log('');
  console.log('  team_score = (team_execution + team_age) / 4.0 * 100');
  console.log('  traction_score = traction / 3.0 * 100');
  console.log('  market_score = (market + market_insight) / 3.5 * 100');
  console.log('  product_score = product / 2.0 * 100');
  console.log('  vision_score = product_vision / 2.0 * 100');
  console.log('');
  console.log('After fix, run: npx tsx scripts/recalculate-scores.ts');
}

diagnose();
