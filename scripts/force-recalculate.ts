/**
 * FORCE RECALCULATE ALL GOD SCORES
 * Updates ALL startups regardless of score change (fixes component scaling)
 */

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
    pitch: startup.description || startup.pitch || extracted.pitch || extracted.description,
    problem: startup.problem || extracted.problem,
    solution: startup.solution || extracted.solution,
    market_size: startup.market_size || extracted.market_size,
    industries: startup.industries || startup.sectors || extracted.industries || extracted.sectors || [],
    team: startup.team_companies ? startup.team_companies.map((c: string) => ({
      name: 'Team Member',
      previousCompanies: [c]
    })) : (extracted.team || []),
    founders_count: startup.team_size || extracted.team_size || 1,
    technical_cofounders: (startup.has_technical_cofounder ? 1 : 0) || (extracted.has_technical_cofounder ? 1 : 0),
    mrr: startup.mrr || extracted.mrr,
    revenue: startup.arr || startup.revenue || extracted.revenue || extracted.arr,
    growth_rate: startup.growth_rate_monthly || extracted.growth_rate || extracted.growth_rate_monthly,
    customers: startup.customer_count || extracted.customers || extracted.customer_count,
    active_users: extracted.active_users || extracted.users,
    gmv: extracted.gmv,
    retention_rate: extracted.retention_rate,
    churn_rate: extracted.churn_rate,
    prepaying_customers: extracted.prepaying_customers,
    signed_contracts: extracted.signed_contracts,
    has_revenue: extracted.has_revenue,
    has_customers: extracted.has_customers,
    execution_signals: extracted.execution_signals || [],
    team_signals: extracted.team_signals || [],
    funding_amount: extracted.funding_amount,
    funding_stage: extracted.funding_stage,
    launched: startup.is_launched || extracted.is_launched || extracted.launched,
    demo_available: startup.has_demo || extracted.has_demo || extracted.demo_available,
    unique_ip: extracted.unique_ip,
    defensibility: extracted.defensibility,
    mvp_stage: extracted.mvp_stage,
    founded_date: startup.founded_date || startup.created_at || extracted.founded_date,
    value_proposition: startup.value_proposition || startup.tagline || extracted.value_proposition,
    backed_by: startup.backed_by || extracted.backed_by || extracted.investors,
    ...startup,
    ...extracted
  };
}

function calculateGODScore(startup: any) {
  const profile = toScoringProfile(startup);
  const result = calculateHotScore(profile);
  const total = Math.round(result.total * 10);
  
  // FIXED: Use correct divisors that match algorithm maxes
  const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
  const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
  
  return {
    team_score: Math.round((teamCombined / 4.0) * 100),       // max 4.0
    traction_score: Math.round(((result.breakdown.traction || 0) / 3.0) * 100), // max 3.0
    market_score: Math.round((marketCombined / 3.5) * 100),   // max 3.5
    product_score: Math.round(((result.breakdown.product || 0) / 2.0) * 100),   // max 2.0
    vision_score: Math.round(((result.breakdown.product_vision || 0) / 2.0) * 100), // max 2.0
    total_god_score: total
  };
}

async function forceRecalculate() {
  console.log('🔧 FORCE RECALCULATING ALL GOD SCORES (fixing component scaling)...\n');

  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('*')
    .in('status', ['pending', 'approved'])
    .order('updated_at', { ascending: true });

  if (error || !startups) {
    console.error('Error fetching startups:', error);
    return;
  }

  console.log(`📊 Processing ${startups.length} startups (ALL will be updated)...\n`);

  let updated = 0;
  let errors = 0;

  for (const startup of startups) {
    const scores = calculateGODScore(startup);

    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update({
        total_god_score: scores.total_god_score,
        market_score: scores.market_score,
        team_score: scores.team_score,
        traction_score: scores.traction_score,
        product_score: scores.product_score,
        vision_score: scores.vision_score,
        updated_at: new Date().toISOString()
      })
      .eq('id', startup.id);

    if (updateError) {
      console.error(`  ❌ ${startup.name}: ${updateError.message}`);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\n📊 SUMMARY`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${startups.length}`);

  // Verify component scores are now bounded
  console.log('\n🔍 Verifying component scores...');
  const { data: check } = await supabase
    .from('startup_uploads')
    .select('team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .limit(1000);

  if (check) {
    const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
    let allOk = true;
    for (const c of components) {
      const vals = check.map(d => (d as any)[c]).filter(v => v != null);
      const max = Math.max(...vals);
      const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
      const status = max <= 100 ? '✅' : '❌';
      console.log(`  ${c}: avg=${avg.toFixed(1)}, max=${max} ${status}`);
      if (max > 100) allOk = false;
    }
    console.log(allOk ? '\n✅ All component scores are now properly bounded (0-100)' : '\n❌ Some components still exceed 100!');
  }
}

forceRecalculate();
