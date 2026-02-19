const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  console.log('\n=== FULL STATUS BREAKDOWN ===\n');
  
  // Get ALL statuses
  const { data: allRecords } = await supabase
    .from('startup_uploads')
    .select('status, total_god_score');
  
  const statusMap = {};
  const scoresByStatus = {};
  
  allRecords.forEach(r => {
    const status = r.status || 'null';
    statusMap[status] = (statusMap[status] || 0) + 1;
    
    if (r.total_god_score != null) {
      if (!scoresByStatus[status]) scoresByStatus[status] = [];
      scoresByStatus[status].push(r.total_god_score);
    }
  });
  
  console.log('Status counts (all records):', statusMap);
  
  console.log('\nGOD Score stats by status:');
  Object.entries(scoresByStatus).forEach(([status, scores]) => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    console.log(`  ${status}: avg=${avg.toFixed(1)}, min=${min}, max=${max}, count=${scores.length}`);
  });
  
  process.exit(0);
})();
