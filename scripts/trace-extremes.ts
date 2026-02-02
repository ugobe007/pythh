/**
 * Trace why component scores exceed expected maximums
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateHotScore } from '../server/services/startupScoringService';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
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
    mrr: startup.mrr || extracted.mrr,
    revenue: startup.arr || startup.revenue,
    growth_rate: startup.growth_rate_monthly || extracted.growth_rate,
    customers: startup.customer_count || extracted.customers,
    active_users: extracted.active_users,
    has_revenue: extracted.has_revenue,
    has_customers: extracted.has_customers,
    execution_signals: extracted.execution_signals || [],
    launched: startup.is_launched || extracted.is_launched,
    demo_available: startup.has_demo,
    founded_date: startup.founded_date || startup.created_at,
    value_proposition: startup.value_proposition || startup.tagline,
    backed_by: startup.backed_by || extracted.backed_by,
    ...startup,
    ...extracted
  };
}

async function trace() {
  // Find startups with extreme component values
  const { data: extremes } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('status', 'approved')
    .or('team_score.gt.100,traction_score.gt.100,vision_score.gt.100')
    .limit(5);

  if (!extremes || extremes.length === 0) {
    console.log('No extreme values found');
    return;
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         TRACING EXTREME COMPONENT VALUES');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const startup of extremes) {
    console.log(`\n▶ ${startup.name}`);
    console.log('  DB values: team=' + startup.team_score + ', traction=' + startup.traction_score + ', vision=' + startup.vision_score);
    
    const profile = toScoringProfile(startup);
    const result = calculateHotScore(profile);
    
    console.log('\n  RAW ALGORITHM OUTPUT (should be bounded):');
    console.log('    team_execution: ' + (result.breakdown.team_execution?.toFixed(2) || 0) + ' (expected max: 3.0)');
    console.log('    team_age: ' + (result.breakdown.team_age?.toFixed(2) || 0) + ' (expected max: 1.0)');
    console.log('    traction: ' + (result.breakdown.traction?.toFixed(2) || 0) + ' (expected max: 3.0)');
    console.log('    product_vision: ' + (result.breakdown.product_vision?.toFixed(2) || 0) + ' (expected max: 2.0)');
    console.log('    market: ' + (result.breakdown.market?.toFixed(2) || 0) + ' (expected max: 2.0)');
    console.log('    market_insight: ' + (result.breakdown.market_insight?.toFixed(2) || 0) + ' (expected max: 1.5)');
    console.log('    product: ' + (result.breakdown.product?.toFixed(2) || 0) + ' (expected max: 2.0)');
    
    // Check for values exceeding max
    const issues = [];
    if ((result.breakdown.team_execution || 0) > 3.0) issues.push('team_execution > 3.0');
    if ((result.breakdown.team_age || 0) > 1.0) issues.push('team_age > 1.0');
    if ((result.breakdown.traction || 0) > 3.0) issues.push('traction > 3.0');
    if ((result.breakdown.product_vision || 0) > 2.0) issues.push('product_vision > 2.0');
    if ((result.breakdown.market || 0) > 2.0) issues.push('market > 2.0');
    if ((result.breakdown.market_insight || 0) > 1.5) issues.push('market_insight > 1.5');
    if ((result.breakdown.product || 0) > 2.0) issues.push('product > 2.0');
    
    if (issues.length > 0) {
      console.log('\n  ⚠️  ISSUES: Algorithm returning values EXCEEDING declared maximums:');
      issues.forEach(i => console.log('    - ' + i));
    } else {
      console.log('\n  ✅ Algorithm values are within bounds - issue is in scaling formula');
    }
    
    // Calculate what the stored scores should be with fixed scaling
    const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
    const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
    
    console.log('\n  CALCULATED COMPONENT SCORES (should be 0-100):');
    console.log('    team: ' + teamCombined.toFixed(2) + ' / 4.0 * 100 = ' + Math.round((teamCombined / 4.0) * 100));
    console.log('    traction: ' + (result.breakdown.traction || 0).toFixed(2) + ' / 3.0 * 100 = ' + Math.round(((result.breakdown.traction || 0) / 3.0) * 100));
    console.log('    vision: ' + (result.breakdown.product_vision || 0).toFixed(2) + ' / 2.0 * 100 = ' + Math.round(((result.breakdown.product_vision || 0) / 2.0) * 100));
  }
}

trace();
