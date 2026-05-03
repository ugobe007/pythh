/**
 * Run the live_signal_pairings_v1 migration
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  console.log('=== Running live_signal_pairings_v1 migration ===\n');
  
  // 1. Drop view
  console.log('1. Dropping existing view...');
  let r = await supabase.rpc('exec_sql', { 
    sql_query: 'DROP VIEW IF EXISTS public.live_signal_pairings_v1 CASCADE;' 
  });
  console.log(r.error ? '   Error: ' + r.error.message : '   ✓ Dropped');
  
  // 2. Create view
  console.log('2. Creating view...');
  const viewSql = `
CREATE OR REPLACE VIEW public.live_signal_pairings_v1 AS
WITH
top_startups AS (
  SELECT id, name, sector_key, investor_signal_sector_0_10, investor_state_sector,
         sector_momentum_0_10, sector_evidence_0_10, sector_narrative_0_10
  FROM public.startup_intel_v5_sector
  WHERE sector_key IS NOT NULL 
    AND investor_signal_sector_0_10 IS NOT NULL 
    AND investor_signal_sector_0_10 >= 3
  ORDER BY 
    CASE WHEN investor_state_sector = 'hot' THEN 0 ELSE 1 END,
    investor_signal_sector_0_10 DESC NULLS LAST
  LIMIT 100
),
raw_pairings AS (
  SELECT 
    s.id AS startup_id, 
    s.name AS startup_name, 
    i.id AS investor_id, 
    i.name AS investor_name,
    s.sector_key, 
    s.investor_signal_sector_0_10, 
    s.investor_state_sector,
    s.sector_momentum_0_10, 
    s.sector_evidence_0_10, 
    s.sector_narrative_0_10,
    ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY random()) AS inv_rank
  FROM top_startups s
  JOIN public.investors i ON (
    (i.sectors IS NOT NULL AND s.sector_key = ANY(i.sectors))
    OR (i.investment_thesis ILIKE '%' || s.sector_key || '%')
    OR (i.firm_description_normalized ILIKE '%' || s.sector_key || '%')
  )
  WHERE i.name IS NOT NULL
)
SELECT 
  startup_id, 
  startup_name, 
  investor_id, 
  investor_name,
  CASE
    WHEN COALESCE(sector_momentum_0_10, 0) >= COALESCE(sector_evidence_0_10, 0)
     AND COALESCE(sector_momentum_0_10, 0) >= COALESCE(sector_narrative_0_10, 0) 
    THEN 'Capital velocity'
    WHEN COALESCE(sector_evidence_0_10, 0) >= COALESCE(sector_momentum_0_10, 0)
     AND COALESCE(sector_evidence_0_10, 0) >= COALESCE(sector_narrative_0_10, 0) 
    THEN 'Stage readiness'
    ELSE 'Thesis convergence'
  END AS reason,
  LEAST(GREATEST(COALESCE(investor_signal_sector_0_10, 0) / 10.0, 0), 1) AS confidence,
  sector_key, 
  NOW() AS created_at
FROM raw_pairings 
WHERE inv_rank = 1
ORDER BY 
  CASE WHEN investor_state_sector = 'hot' THEN 0 ELSE 1 END, 
  confidence DESC;
`;

  r = await supabase.rpc('exec_sql', { sql_query: viewSql });
  console.log(r.error ? '   Error: ' + r.error.message : '   ✓ Created');
  
  // 3. Grant permissions
  console.log('3. Granting permissions...');
  r = await supabase.rpc('exec_sql', { 
    sql_query: 'GRANT SELECT ON public.live_signal_pairings_v1 TO anon, authenticated;' 
  });
  console.log(r.error ? '   Error: ' + r.error.message : '   ✓ Granted');
  
  // 4. Test query
  console.log('4. Testing view...');
  const test = await supabase
    .from('live_signal_pairings_v1')
    .select('*')
    .limit(5);
    
  if (test.error) {
    console.log('   Error:', test.error.message);
  } else {
    console.log('   ✓ Got', test.data?.length, 'rows:');
    test.data?.forEach((row, i) => {
      console.log(`   ${i+1}. ${row.startup_name} → ${row.investor_name} (${row.reason}, ${(row.confidence * 100).toFixed(0)}%)`);
    });
  }
  
  console.log('\n=== Migration complete ===');
}

run().catch(console.error);
