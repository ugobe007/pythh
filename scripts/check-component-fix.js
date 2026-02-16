// Quick check if component scores are fixed (0-20 range)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkComponents() {
  // Get top 10 by team_score
  const { data } = await supabase
    .from('startup_uploads')
    .select('name, team_score, traction_score, market_score, product_score, vision_score, total_god_score')
    .eq('status', 'approved')
    .order('team_score', { ascending: false })
    .limit(10);
  
  console.log('TOP 10 STARTUPS BY TEAM SCORE:');
  console.log('(Should all be ≤20 if fix applied)\n');
  
  data.forEach(s => {
    const max = Math.max(s.team_score, s.traction_score, s.market_score, s.product_score, s.vision_score);
    const sum = s.team_score + s.traction_score + s.market_score + s.product_score + s.vision_score;
    const flag = max > 20 ? '❌ CORRUPTED' : '✅';
    console.log(`${flag} ${s.name.substring(0, 30).padEnd(30)} | T:${s.team_score} TR:${s.traction_score} M:${s.market_score} P:${s.product_score} V:${s.vision_score} | Sum:${sum} GOD:${s.total_god_score}`);
  });
  
  // Count corrupted
  const { count: corrupted } = await supabase
    .from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .or('team_score.gt.20,traction_score.gt.20,market_score.gt.20,product_score.gt.20,vision_score.gt.20');
  
  console.log(`\n📊 Startups with ANY component > 20: ${corrupted}/1000`);
  
  if (corrupted === 0) {
    console.log('✅ ALL COMPONENT SCORES FIXED!\n');
  } else {
    console.log(`❌ ${corrupted} startups still have corrupted component scores\n`);
  }
}

checkComponents().catch(console.error);
