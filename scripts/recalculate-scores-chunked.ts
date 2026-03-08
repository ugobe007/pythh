/**
 * CHUNKED GOD SCORE RECALCULATION
 * 
 * Processes startups in chunks to avoid timeouts.
 * Usage:
 *   npx tsx scripts/recalculate-scores-chunked.ts --chunk 0 --total-chunks 10
 *   npx tsx scripts/recalculate-scores-chunked.ts --chunk 1 --total-chunks 10
 *   ... (run 10 times for 10 chunks)
 * 
 * Or via PM2:
 *   pm2 start ecosystem.config.js --only score-recalc-chunked
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

// Import the core scoring functions (matching original script)
import { calculateHotScore } from '../server/services/startupScoringService';
const { calculateMomentumScore, loadScoreHistoryBatch } = require('../server/services/momentumScoringService');
const { calculateAPOrPromisingBonus } = require('../server/services/apScoringService');
const { calculateEliteBoost } = require('../server/services/eliteScoringService');
const { calculateSpikyAndHotBonus } = require('../server/services/spikyBachelorService');
const { calculateInvestorPedigreeBonus } = require('../server/services/investorPedigreeScoringService');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Parse command line arguments
const args = process.argv.slice(2);
const chunkArg = args.find(arg => arg.startsWith('--chunk='))?.split('=')[1] || args[args.indexOf('--chunk') + 1];
const totalChunksArg = args.find(arg => arg.startsWith('--total-chunks='))?.split('=')[1] || args[args.indexOf('--total-chunks') + 1];

const chunk = chunkArg ? parseInt(chunkArg, 10) : 0;
const totalChunks = totalChunksArg ? parseInt(totalChunksArg, 10) : 1;

if (isNaN(chunk) || isNaN(totalChunks) || chunk < 0 || chunk >= totalChunks) {
  console.error('Usage: npx tsx scripts/recalculate-scores-chunked.ts --chunk=0 --total-chunks=10');
  console.error(`Invalid arguments: chunk=${chunkArg}, totalChunks=${totalChunksArg}`);
  process.exit(1);
}

console.log(`\n🔢 Starting CHUNKED GOD Score recalculation...`);
console.log(`   Chunk ${chunk + 1} of ${totalChunks}\n`);

// Helper function to convert startup to scoring profile (from original script)
function toScoringProfile(startup: any): any {
  return {
    name: startup.name,
    website: startup.website,
    value_proposition: startup.value_proposition,
    tagline: startup.tagline,
    pitch: startup.pitch,
    team: startup.team || startup.extracted_data?.team,
    founders_count: startup.founders_count || startup.extracted_data?.founders_count,
    team_size: startup.team_size || startup.extracted_data?.team_size,
    technical_cofounders: startup.technical_cofounders || startup.extracted_data?.technical_cofounders,
    revenue: startup.revenue || startup.extracted_data?.revenue,
    mrr: startup.mrr || startup.extracted_data?.mrr,
    arr: startup.arr || startup.extracted_data?.arr,
    active_users: startup.active_users || startup.extracted_data?.active_users,
    customers: startup.customers || startup.extracted_data?.customers,
    growth_rate: startup.growth_rate || startup.extracted_data?.growth_rate,
    funding_amount: startup.funding_amount || startup.extracted_data?.funding_amount,
    funding_stage: startup.funding_stage || startup.extracted_data?.funding_stage,
    industries: startup.industries || startup.extracted_data?.industries,
    problem: startup.problem || startup.extracted_data?.problem,
    solution: startup.solution || startup.extracted_data?.solution,
    founded_date: startup.founded_date || startup.extracted_data?.founded_date,
    has_revenue: startup.has_revenue,
    has_customers: startup.has_customers,
    social_signals: startup.social_signals,
    fomo_signal_strength: startup.fomo_signal_strength,
    conviction_signal_strength: startup.conviction_signal_strength,
    urgency_signal_strength: startup.urgency_signal_strength,
    risk_signal_strength: startup.risk_signal_strength,
    pivot_strength: startup.pivot_strength,
    cascade_strength: startup.cascade_strength,
    founder_strength: startup.founder_strength,
    exit_risk_strength: startup.exit_risk_strength
  };
}

// Helper function to calculate GOD score (from original script)
function calculateGODScore(startup: any): any {
  const profile = toScoringProfile(startup);
  const result = calculateHotScore(profile);
  
  const total = Math.round(result.total * 10);
  const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
  const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
  
  return {
    team_score: Math.min(Math.round((teamCombined / 4.0) * 100), 100),
    traction_score: Math.min(Math.round(((result.breakdown.traction || 0) / 3.0) * 100), 100),
    market_score: Math.min(Math.round((marketCombined / 3.5) * 100), 100),
    product_score: Math.min(Math.round(((result.breakdown.product || 0) / 2.0) * 100), 100),
    vision_score: Math.min(Math.round(((result.breakdown.product_vision || 0) / 2.0) * 100), 100),
    total_god_score: total,
    psychological_multiplier: result.psychological_multiplier || 0,
    enhanced_god_score: result.enhanced_total ? Math.round(result.enhanced_total * 10) : total
  };
}

// Helper function to classify data richness (from original script)
function classifyDataRichness(startup: any): number {
  const hasRevenue = startup.revenue || startup.mrr || startup.arr;
  const hasCustomers = startup.customers || startup.active_users || startup.customer_count;
  const hasFunding = startup.funding_amount;
  const hasTeam = startup.team && Array.isArray(startup.team) && startup.team.length > 0;
  const hasTraction = hasRevenue || hasCustomers;
  
  const dataPoints = [
    hasTraction,
    hasFunding,
    hasTeam,
    startup.value_proposition,
    startup.industries && startup.industries.length > 0
  ].filter(Boolean).length;
  
  if (dataPoints >= 4 && hasTraction) return 1; // Data Rich
  if (dataPoints >= 3) return 2; // Good Data
  if (dataPoints >= 2) return 3; // Medium
  return 4; // Sparse
}

async function recalculateChunk(): Promise<void> {
  // Get total count first
  const { count: totalCount } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'approved']);
  
  if (!totalCount) {
    console.log('No startups found');
    return;
  }
  
  const chunkSize = Math.ceil(totalCount / totalChunks);
  const startOffset = chunk * chunkSize;
  const endOffset = Math.min(startOffset + chunkSize, totalCount);
  
  console.log(`📊 Processing chunk ${chunk + 1}/${totalChunks}: startups ${startOffset + 1}-${endOffset} of ${totalCount}`);
  
  // Fetch chunk of startups
  const { data: startups, error: fetchError } = await supabase
    .from('startup_uploads')
    .select('*')
    .in('status', ['pending', 'approved'])
    .order('updated_at', { ascending: true })
    .range(startOffset, endOffset - 1);
  
  if (fetchError) {
    console.error('Error fetching startups:', fetchError);
    process.exit(1);
  }
  
  if (!startups || startups.length === 0) {
    console.log('No startups in this chunk');
    return;
  }
  
  // Classify into phases
  const phases = {
    1: startups.filter(s => classifyDataRichness(s) === 1),
    2: startups.filter(s => classifyDataRichness(s) === 2),
    3: startups.filter(s => classifyDataRichness(s) === 3),
    4: startups.filter(s => classifyDataRichness(s) === 4)
  };
  
  console.log(`   Phase 1 (Data Rich):  ${phases[1].length}`);
  console.log(`   Phase 2 (Good Data):  ${phases[2].length}`);
  console.log(`   Phase 3 (Medium):     ${phases[3].length}`);
  console.log(`   Phase 4 (Sparse):     ${phases[4].length}\n`);
  
  // Load score history for momentum
  const startupIds = startups.map((s: any) => s.id);
  let scoreHistoryMap: Map<string, any[]> = new Map();
  try {
    scoreHistoryMap = await loadScoreHistoryBatch(supabase, startupIds);
  } catch (e) {
    console.warn('⚠️  Score history load failed — momentum disabled');
  }
  
  // Check momentum column
  let momentumColumnExists = false;
  try {
    const { error: colTest } = await supabase
      .from('startup_uploads')
      .select('momentum_score')
      .limit(1);
    momentumColumnExists = !colTest || !colTest.message?.includes('momentum_score');
  } catch {
    momentumColumnExists = false;
  }
  
  let updated = 0;
  let unchanged = 0;
  
  // Process each phase
  for (const phaseNum of [1, 2, 3, 4]) {
    const phaseStartups = phases[phaseNum as keyof typeof phases];
    if (phaseStartups.length === 0) continue;
    
    const isDataRich = phaseNum <= 2;
    
    for (const startup of phaseStartups) {
      const oldScore = startup.total_god_score || 0;
      
      // Calculate GOD score
      const scores = calculateGODScore(startup);
      
      // Get signals bonus
      const signalsBonus = Math.min(startup.signals_bonus || 0, 9);
      
      // Conditional bonuses (only for data-rich)
      let momentumBonus = 0;
      let apPromisingBonus = 0;
      let eliteSpikyBonus = 0;
      let pedigreeBonus = 0;
      
      if (isDataRich) {
        try {
          const momentumResult = calculateMomentumScore(startup, {
            scoreHistory: scoreHistoryMap.get(startup.id) || [],
          });
          if (momentumResult.applied && momentumResult.total > 0) {
            momentumBonus = momentumResult.total;
          }
        } catch (e) {}
        
        try {
          const apPromResult = calculateAPOrPromisingBonus(
            { ...startup, team_score: scores.team_score, traction_score: scores.traction_score, market_score: scores.market_score, product_score: scores.product_score, vision_score: scores.vision_score },
            scores.total_god_score + signalsBonus + momentumBonus
          );
          if (apPromResult.applied && apPromResult.bonus > 0) {
            apPromisingBonus = apPromResult.bonus;
          }
        } catch (e) {}
        
        try {
          const preEliteScore = Math.round(scores.total_god_score + signalsBonus + momentumBonus + apPromisingBonus);
          const eliteResult = calculateEliteBoost(startup, preEliteScore);
          let eliteBoost = 0;
          if (eliteResult.applied && eliteResult.boost > 0) {
            eliteBoost = eliteResult.boost;
          }
          
          const spikyResult = calculateSpikyAndHotBonus(
            { ...startup, team_score: scores.team_score, traction_score: scores.traction_score, market_score: scores.market_score, product_score: scores.product_score, vision_score: scores.vision_score },
            preEliteScore + eliteBoost
          );
          let spikyHotBonus = 0;
          if (spikyResult.applied && spikyResult.totalBonus > 0) {
            spikyHotBonus = spikyResult.totalBonus;
          }
          
          eliteSpikyBonus = eliteBoost + spikyHotBonus;
        } catch (e) {}
      }
      
      // Investor pedigree (applies to all)
      try {
        const pedigreeResult = calculateInvestorPedigreeBonus(startup);
        if (pedigreeResult.applied && pedigreeResult.bonus > 0) {
          pedigreeBonus = pedigreeResult.bonus;
        }
      } catch (e) {}
      
      // Calculate final score
      const psychBonus = scores.psychological_multiplier || 0;
      const psychBonusGOD = Math.min(Math.max(psychBonus * 10, -5), 7);
      
      const rawBonuses = signalsBonus + momentumBonus + apPromisingBonus + eliteSpikyBonus + psychBonusGOD + pedigreeBonus;
      const cappedBonuses = Math.min(rawBonuses, 10);
      const finalScore = Math.min(Math.round(scores.total_god_score + cappedBonuses), 100);
      
      // Update if changed
      if (finalScore !== oldScore) {
        const updatePayload: any = {
          total_god_score: finalScore,
          market_score: scores.market_score,
          team_score: scores.team_score,
          traction_score: scores.traction_score,
          product_score: scores.product_score,
          vision_score: scores.vision_score,
          psychological_multiplier: psychBonus,
          enhanced_god_score: finalScore,
          updated_at: new Date().toISOString()
        };
        
        if (momentumColumnExists) {
          updatePayload.momentum_score = momentumBonus;
        }
        
        const { error: updateError } = await supabase
          .from('startup_uploads')
          .update(updatePayload)
          .eq('id', startup.id);
        
        if (updateError) {
          console.error(`Error updating ${startup.name}:`, updateError);
        } else {
          updated++;
        }
      } else {
        unchanged++;
      }
    }
  }
  
  console.log(`\n✅ Chunk ${chunk + 1}/${totalChunks} complete:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Unchanged: ${unchanged}`);
}

recalculateChunk().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
