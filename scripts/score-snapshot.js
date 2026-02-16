/**
 * Score Snapshot - Captures GOD score distribution for before/after comparison
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function q(sql) {
  const { data, error } = await sb.rpc('exec_sql', { sql_query: sql });
  if (error) { console.error('SQL error:', error.message); return null; }
  return data;
}

async function snapshot() {
  console.log('=== GOD SCORE SNAPSHOT ===\n');

  // 1. Overall distribution
  const dist = await q(`
    SELECT json_build_object(
      'total', (SELECT count(*) FROM startup_uploads WHERE status = 'approved'),
      'avg_god', (SELECT round(avg(total_god_score)::numeric, 2) FROM startup_uploads WHERE status = 'approved'),
      'median_god', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY total_god_score) FROM startup_uploads WHERE status = 'approved'),
      'p10', (SELECT percentile_cont(0.1) WITHIN GROUP (ORDER BY total_god_score) FROM startup_uploads WHERE status = 'approved'),
      'p25', (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY total_god_score) FROM startup_uploads WHERE status = 'approved'),
      'p75', (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY total_god_score) FROM startup_uploads WHERE status = 'approved'),
      'p90', (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY total_god_score) FROM startup_uploads WHERE status = 'approved'),
      'min_score', (SELECT min(total_god_score) FROM startup_uploads WHERE status = 'approved'),
      'max_score', (SELECT max(total_god_score) FROM startup_uploads WHERE status = 'approved')
    ) as result
  `);
  console.log('Distribution:', JSON.stringify(dist, null, 2));

  // 2. Component averages
  const comp = await q(`
    SELECT json_build_object(
      'avg_traction', (SELECT round(avg(traction_score)::numeric, 2) FROM startup_uploads WHERE status = 'approved'),
      'avg_team', (SELECT round(avg(team_score)::numeric, 2) FROM startup_uploads WHERE status = 'approved'),
      'avg_market', (SELECT round(avg(market_score)::numeric, 2) FROM startup_uploads WHERE status = 'approved'),
      'avg_product', (SELECT round(avg(product_score)::numeric, 2) FROM startup_uploads WHERE status = 'approved'),
      'avg_vision', (SELECT round(avg(vision_score)::numeric, 2) FROM startup_uploads WHERE status = 'approved')
    ) as result
  `);
  console.log('Components:', JSON.stringify(comp, null, 2));

  // 3. Tier counts
  const tiers = await q(`
    SELECT json_build_object(
      'at_floor_40', (SELECT count(*) FROM startup_uploads WHERE status = 'approved' AND total_god_score = 40),
      'score_41_49', (SELECT count(*) FROM startup_uploads WHERE status = 'approved' AND total_god_score BETWEEN 41 AND 49),
      'score_50_59', (SELECT count(*) FROM startup_uploads WHERE status = 'approved' AND total_god_score BETWEEN 50 AND 59),
      'score_60_69', (SELECT count(*) FROM startup_uploads WHERE status = 'approved' AND total_god_score BETWEEN 60 AND 69),
      'score_70_79', (SELECT count(*) FROM startup_uploads WHERE status = 'approved' AND total_god_score BETWEEN 70 AND 79),
      'score_80_plus', (SELECT count(*) FROM startup_uploads WHERE status = 'approved' AND total_god_score >= 80)
    ) as result
  `);
  console.log('Tiers:', JSON.stringify(tiers, null, 2));

  // 4. Parsed metrics coverage
  const metrics = await q(`
    SELECT json_build_object(
      'has_arr', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND arr_usd IS NOT NULL AND arr_usd > 0),
      'has_revenue', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND revenue_usd IS NOT NULL AND revenue_usd > 0),
      'has_last_round', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND last_round_amount_usd IS NOT NULL AND last_round_amount_usd > 0),
      'has_customers', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND parsed_customers IS NOT NULL AND parsed_customers > 0),
      'has_users', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND parsed_users IS NOT NULL AND parsed_users > 0),
      'has_headcount', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND parsed_headcount IS NOT NULL AND parsed_headcount > 0),
      'has_burn', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND burn_monthly_usd IS NOT NULL AND burn_monthly_usd > 0),
      'has_runway', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND runway_months IS NOT NULL AND runway_months > 0),
      'has_valuation', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND valuation_usd IS NOT NULL AND valuation_usd > 0),
      'has_total_funding', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND total_funding_usd IS NOT NULL AND total_funding_usd > 0)
    ) as result
  `);
  console.log('Parsed Metrics:', JSON.stringify(metrics, null, 2));

  // 5. Cross-tab: startups WITH parsed funding vs WITHOUT - how do their current GOD scores compare?
  const cross = await q(`
    SELECT json_build_object(
      'with_funding_avg_god', (SELECT round(avg(total_god_score)::numeric, 2) FROM startup_uploads WHERE status='approved' AND last_round_amount_usd > 0),
      'without_funding_avg_god', (SELECT round(avg(total_god_score)::numeric, 2) FROM startup_uploads WHERE status='approved' AND (last_round_amount_usd IS NULL OR last_round_amount_usd = 0)),
      'with_arr_avg_god', (SELECT round(avg(total_god_score)::numeric, 2) FROM startup_uploads WHERE status='approved' AND arr_usd > 0),
      'without_arr_avg_god', (SELECT round(avg(total_god_score)::numeric, 2) FROM startup_uploads WHERE status='approved' AND (arr_usd IS NULL OR arr_usd = 0)),
      'with_customers_avg_god', (SELECT round(avg(total_god_score)::numeric, 2) FROM startup_uploads WHERE status='approved' AND parsed_customers > 0),
      'without_customers_avg_god', (SELECT round(avg(total_god_score)::numeric, 2) FROM startup_uploads WHERE status='approved' AND (parsed_customers IS NULL OR parsed_customers = 0))
    ) as result
  `);
  console.log('Cross-tab (current scores):', JSON.stringify(cross, null, 2));
}

snapshot().catch(console.error);
