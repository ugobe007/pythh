require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkPsychologicalBonuses() {
  console.log('\n📊 PSYCHOLOGICAL BONUS DATA CHECK\n');
  
  // Get top 10 with highest bonuses
  const { data: topBonuses } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, psychological_bonus, enhanced_god_score')
    .eq('status', 'approved')
    .not('psychological_bonus', 'is', null)
    .order('psychological_bonus', { ascending: false })
    .limit(10);
  
  if (topBonuses && topBonuses.length > 0) {
    console.log('✅ Psychological bonuses ARE being calculated!\n');
    console.log('Top 10 startups with highest psychological bonuses:\n');
    
    topBonuses.forEach((s, i) => {
      console.log(`${i+1}. ${s.name}`);
      console.log(`   Base GOD: ${s.total_god_score}`);
      console.log(`   Psych Bonus: ${s.psychological_bonus}`);
      console.log(`   Enhanced: ${s.enhanced_god_score}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No psychological bonuses found\n');
  }
  
  // Get stats
  const { data: allBonuses } = await supabase
    .from('startup_uploads')
    .select('psychological_bonus')
    .eq('status', 'approved')
    .not('psychological_bonus', 'is', null);
  
  const { data: allApproved } = await supabase
    .from('startup_uploads')
    .select('id')
    .eq('status', 'approved');
  
  const withBonuses = allBonuses?.length || 0;
  const total = allApproved?.length || 0;
  const pct = ((withBonuses / total) * 100).toFixed(1);
  
  console.log(`\n📈 STATISTICS\n`);
  console.log(`Total approved startups: ${total}`);
  console.log(`With psychological bonuses: ${withBonuses} (${pct}%)`);
  
  if (withBonuses > 0) {
    const sum = allBonuses.reduce((acc, s) => acc + (s.psychological_bonus || 0), 0);
    const avg = sum / withBonuses;
    const max = Math.max(...allBonuses.map(s => s.psychological_bonus || 0));
    const min = Math.min(...allBonuses.map(s => s.psychological_bonus || 0));
    
    console.log(`Average bonus: ${avg.toFixed(2)} points`);
    console.log(`Range: ${min.toFixed(2)} to ${max.toFixed(2)} points`);
  }
  
  console.log('\n');
}

checkPsychologicalBonuses().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
