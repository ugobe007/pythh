// Check GOD score distribution and health
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGodScores() {
  console.log('🏆 GOD SCORE HEALTH CHECK\n' + '='.repeat(80));
  
  // Show current config (load dynamically)
  try {
    const configModule = await import('./server/services/startupScoringService.js');
    const GOD_SCORE_CONFIG = configModule.GOD_SCORE_CONFIG;
    console.log('\n⚙️  CURRENT CONFIG:');
    console.log(`   Normalization Divisor: ${GOD_SCORE_CONFIG.normalizationDivisor} (expected range: 19.0-22.0)`);
    console.log(`   Base Boost Minimum:    ${GOD_SCORE_CONFIG.baseBoostMinimum} (expected range: 2.0-3.5)`);
    console.log(`   Expected avg score:    55-65`);
  } catch (err) {
    console.warn('   ⚠️  Could not load config (may need to build first)');
  }
  
  // Overall statistics
  const { data: stats, error: statsError } = await supabase
    .from('startup_uploads')
    .select('total_god_score, status')
    .not('total_god_score', 'is', null);
  
  if (statsError) {
    console.error('❌ Error fetching stats:', statsError.message);
    return;
  }
  
  const allScores = stats.map(s => s.total_god_score);
  const approvedScores = stats.filter(s => s.status === 'approved').map(s => s.total_god_score);
  
  // Calculate statistics
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  
  console.log('\n📊 OVERALL DISTRIBUTION:');
  console.log(`   Total startups with scores: ${allScores.length}`);
  console.log(`   Approved startups: ${approvedScores.length}`);
  console.log(`   Average GOD score: ${avg(allScores).toFixed(1)}`);
  console.log(`   Median GOD score: ${median(allScores).toFixed(1)}`);
  console.log(`   Min: ${Math.min(...allScores)}, Max: ${Math.max(...allScores)}`);
  
  // Distribution by tier
  console.log('\n🎯 TIER DISTRIBUTION (Approved only):');
  const elite = approvedScores.filter(s => s >= 80).length;
  const excellent = approvedScores.filter(s => s >= 70 && s < 80).length;
  const strong = approvedScores.filter(s => s >= 60 && s < 70).length;
  const good = approvedScores.filter(s => s >= 50 && s < 60).length;
  const fair = approvedScores.filter(s => s >= 40 && s < 50).length;
  const weak = approvedScores.filter(s => s < 40).length;
  
  console.log(`   🌟 Elite (80+):      ${elite.toString().padStart(5)} (${(elite/approvedScores.length*100).toFixed(1)}%)`);
  console.log(`   ⭐ Excellent (70-79): ${excellent.toString().padStart(5)} (${(excellent/approvedScores.length*100).toFixed(1)}%)`);
  console.log(`   💪 Strong (60-69):    ${strong.toString().padStart(5)} (${(strong/approvedScores.length*100).toFixed(1)}%)`);
  console.log(`   ✅ Good (50-59):      ${good.toString().padStart(5)} (${(good/approvedScores.length*100).toFixed(1)}%)`);
  console.log(`   ⚠️  Fair (40-49):      ${fair.toString().padStart(5)} (${(fair/approvedScores.length*100).toFixed(1)}%)`);
  console.log(`   ❌ Weak (<40):        ${weak.toString().padStart(5)} (${(weak/approvedScores.length*100).toFixed(1)}%)`);
  
  // Component score breakdown (sample)
  console.log('\n🔍 COMPONENT BREAKDOWN (Top 10 Approved):');
  const { data: topStartups } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: false })
    .limit(10);
  
  if (topStartups && topStartups.length > 0) {
    console.log('\n   Name                    GOD  Team Trac Mrkt Prod Vis');
    console.log('   ' + '-'.repeat(70));
    topStartups.forEach(s => {
      const name = (s.name || 'Unknown').substring(0, 20).padEnd(20);
      console.log(`   ${name}  ${(s.total_god_score || 0).toString().padStart(3)}  ${(s.team_score || 0).toString().padStart(4)} ${(s.traction_score || 0).toString().padStart(4)} ${(s.market_score || 0).toString().padStart(4)} ${(s.product_score || 0).toString().padStart(4)} ${(s.vision_score || 0).toString().padStart(3)}`);
    });
  }
  
  // Recent score updates
  console.log('\n⏰ RECENT ACTIVITY:');
  const { data: recent } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, updated_at')
    .not('total_god_score', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5);
  
  if (recent) {
    recent.forEach(s => {
      const timeSince = Math.floor((Date.now() - new Date(s.updated_at).getTime()) / 1000 / 60);
      console.log(`   ${(s.name || 'Unknown').substring(0, 30).padEnd(30)} GOD: ${s.total_god_score.toString().padStart(3)} (${timeSince}m ago)`);
    });
  }
  
  // Health warnings
  console.log('\n⚠️  HEALTH CHECKS:');
  const avgApproved = avg(approvedScores);
  if (avgApproved < 45) {
    console.log(`   ❌ Average too low: ${avgApproved.toFixed(1)} (target: 55-65)`);
  } else if (avgApproved > 75) {
    console.log(`   ⚠️  Average too high: ${avgApproved.toFixed(1)} (target: 55-65)`);
  } else {
    console.log(`   ✅ Average in healthy range: ${avgApproved.toFixed(1)} (target: 55-65)`);
  }
  
  if (elite / approvedScores.length > 0.15) {
    console.log(`   ⚠️  Too many Elite (${(elite/approvedScores.length*100).toFixed(1)}%) - scores may be inflated`);
  } else {
    console.log(`   ✅ Elite tier size healthy: ${(elite/approvedScores.length*100).toFixed(1)}%`);
  }
  
  if (weak > 0) {
    console.log(`   ⚠️  ${weak} startups below floor (40) - should be rejected or recalculated`);
  } else {
    console.log(`   ✅ No startups below floor (40)`);
  }
  
  console.log('\n' + '='.repeat(80));
}

checkGodScores().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
