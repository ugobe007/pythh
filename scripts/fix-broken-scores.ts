import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateHotScore } from '../server/services/startupScoringService';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

function toScoringProfile(startup: any): any {
  const extracted = startup.extracted_data || {};
  return {
    tagline: startup.tagline || extracted.tagline,
    pitch: startup.description || startup.pitch || extracted.pitch,
    problem: startup.problem || extracted.problem,
    solution: startup.solution || extracted.solution,
    market_size: startup.market_size || extracted.market_size,
    industries: startup.industries || startup.sectors || extracted.industries || extracted.sectors || [],
    team: startup.team_companies ? startup.team_companies.map((c: string) => ({
      name: 'Team Member',
      previousCompanies: [c]
    })) : (extracted.team || []),
    founders_count: startup.team_size || extracted.team_size || 1,
    technical_cofounders: (startup.has_technical_cofounder ? 1 : 0),
    launched: startup.is_launched || extracted.is_launched,
    demo_available: startup.has_demo,
    founded_date: startup.founded_date || startup.created_at,
    value_proposition: startup.value_proposition || startup.tagline,
    ...startup,
    ...extracted
  };
}

async function fixBroken() {
  console.log('Finding startups with component scores > 100...\n');

  const { data: broken } = await supabase
    .from('startup_uploads')
    .select('*')
    .or('team_score.gt.100,traction_score.gt.100,vision_score.gt.100')
    .limit(500);

  if (!broken || broken.length === 0) {
    console.log('No broken records found!');
    return;
  }

  console.log(`Found ${broken.length} startups with scores > 100\n`);

  let fixed = 0;
  for (const startup of broken) {
    const profile = toScoringProfile(startup);
    const result = calculateHotScore(profile);
    
    const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
    const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
    
    const newScores = {
      team_score: Math.round((teamCombined / 4.0) * 100),
      traction_score: Math.round(((result.breakdown.traction || 0) / 3.0) * 100),
      market_score: Math.round((marketCombined / 3.5) * 100),
      product_score: Math.round(((result.breakdown.product || 0) / 2.0) * 100),
      vision_score: Math.round(((result.breakdown.product_vision || 0) / 2.0) * 100),
      total_god_score: Math.round(result.total * 10)
    };

    // Cap all at 100
    newScores.team_score = Math.min(newScores.team_score, 100);
    newScores.traction_score = Math.min(newScores.traction_score, 100);
    newScores.market_score = Math.min(newScores.market_score, 100);
    newScores.product_score = Math.min(newScores.product_score, 100);
    newScores.vision_score = Math.min(newScores.vision_score, 100);

    const { error } = await supabase
      .from('startup_uploads')
      .update(newScores)
      .eq('id', startup.id);

    if (error) {
      console.log(`  ❌ ${startup.name}: ${error.message}`);
    } else {
      console.log(`  ✅ ${startup.name}: team ${startup.team_score}→${newScores.team_score}, traction ${startup.traction_score}→${newScores.traction_score}, vision ${startup.vision_score}→${newScores.vision_score}`);
      fixed++;
    }
  }

  console.log(`\n✅ Fixed ${fixed}/${broken.length} records`);
}

fixBroken();
