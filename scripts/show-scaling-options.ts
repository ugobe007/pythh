/**
 * GOD SCORE COMPONENT SCALING OPTIONS
 * 
 * The total_god_score is calculated correctly - it's the component scores
 * (team_score, traction_score, etc.) that need the right scaling.
 * 
 * These component scores are FOR DISPLAY ONLY - they don't affect total_god_score.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateHotScore } from '../server/services/startupScoringService';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Get sample startups
async function showOptions() {
  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('status', 'approved')
    .limit(10);

  if (!startups || startups.length === 0) {
    console.log('No startups found');
    return;
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         COMPONENT SCORE SCALING OPTIONS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('OPTION A: Strict 0-100 (percentage of max)');
  console.log('  team_score = (team_exec + team_age) / 4.0 * 100');
  console.log('  Guarantees scores never exceed 100');
  console.log('  But: Many scores cluster at low end if data is sparse\n');

  console.log('OPTION B: Expanded scale (allow >100)');
  console.log('  team_score = (team_exec + team_age) / 2.0 * 100');
  console.log('  Spreads distribution, more differentiation');
  console.log('  But: Scores can exceed 100 (confusing)\n');

  console.log('OPTION C: Normalized to match total_god_score');
  console.log('  Each component scaled so its average matches % contribution');
  console.log('  Example: if team contributes 25% of GOD, team_score avg ≈ 25\n');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         SAMPLE DATA WITH DIFFERENT SCALINGS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const startup of startups.slice(0, 5)) {
    const profile = {
      tagline: startup.tagline,
      pitch: startup.description || startup.pitch,
      problem: startup.problem,
      solution: startup.solution,
      industries: startup.industries || startup.sectors || [],
      team: startup.team_companies ? startup.team_companies.map((c: string) => ({
        name: 'Team Member', previousCompanies: [c]
      })) : [],
      founders_count: startup.team_size || 1,
      technical_cofounders: startup.has_technical_cofounder ? 1 : 0,
      launched: startup.is_launched,
      demo_available: startup.has_demo,
      founded_date: startup.founded_date,
      value_proposition: startup.value_proposition,
      ...(startup.extracted_data || {})
    };

    const result = calculateHotScore(profile);
    
    const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
    const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
    const traction = result.breakdown.traction || 0;
    const product = result.breakdown.product || 0;
    const vision = result.breakdown.product_vision || 0;

    console.log(`\n${startup.name}:`);
    console.log(`  total_god_score: ${Math.round(result.total * 10)} (this is always correct)`);
    console.log(`  RAW values: team=${teamCombined.toFixed(2)}, traction=${traction.toFixed(2)}, market=${marketCombined.toFixed(2)}, product=${product.toFixed(2)}, vision=${vision.toFixed(2)}`);
    
    // Option A: Strict 0-100
    console.log(`  OPTION A (0-100): team=${Math.round(teamCombined/4*100)}, traction=${Math.round(traction/3*100)}, market=${Math.round(marketCombined/3.5*100)}, product=${Math.round(product/2*100)}, vision=${Math.round(vision/2*100)}`);
    
    // Option B: Expanded
    console.log(`  OPTION B (expanded): team=${Math.round(teamCombined/2*100)}, traction=${Math.round(traction/2.5*100)}, market=${Math.round(marketCombined/2.5*100)}, product=${Math.round(product/2*100)}, vision=${Math.round(vision/0.5*100)}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('         WHAT DO YOU WANT?');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('1. Keep Option A (0-100 strict) - current setting');
  console.log('2. Revert to Option B (expanded, can exceed 100)');
  console.log('3. Define a custom scaling that makes sense for your use case\n');
}

showOptions();
