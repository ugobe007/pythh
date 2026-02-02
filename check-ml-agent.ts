import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkMLAgent() {
  console.log('🤖 CHECKING ML AGENT STATUS\n');
  console.log('=' .repeat(60));

  // 1. Check ml_recommendations table
  console.log('\n📊 ML Recommendations Table:');
  const { data: mlRecs, error: mlError } = await supabase
    .from('ml_recommendations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (mlError) {
    console.log('   ❌ Error accessing ml_recommendations:', mlError.message);
    if (mlError.message.includes('does not exist')) {
      console.log('   ⚠️  Table does not exist - ML agent may not be set up');
    }
  } else if (!mlRecs || mlRecs.length === 0) {
    console.log('   ⚠️  No recommendations found in database');
    console.log('   This means ML agent has NOT generated any insights yet');
  } else {
    console.log(`   ✅ Found ${mlRecs.length} recommendations:\n`);
    mlRecs.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec.created_at}`);
      console.log(`      Type: ${rec.type}`);
      console.log(`      Status: ${rec.status}`);
      if (rec.recommendation_data) {
        console.log(`      Data: ${JSON.stringify(rec.recommendation_data, null, 8)}`);
      }
      console.log('');
    });
  }

  // 2. Check ai_logs for ML training activity
  console.log('\n📝 ML Training Activity (ai_logs):');
  const { data: logs, error: logsError } = await supabase
    .from('ai_logs')
    .select('*')
    .eq('type', 'ml_training')
    .order('created_at', { ascending: false })
    .limit(5);

  if (logsError) {
    console.log('   ❌ Error accessing ai_logs:', logsError.message);
  } else if (!logs || logs.length === 0) {
    console.log('   ⚠️  No ML training logs found');
    console.log('   ML training service may never have run');
  } else {
    console.log(`   ✅ Found ${logs.length} training runs:\n`);
    logs.forEach((log, i) => {
      console.log(`   ${i + 1}. ${log.created_at}`);
      console.log(`      Action: ${log.action}`);
      console.log(`      Status: ${log.status}`);
      if (log.output) {
        const output = typeof log.output === 'string' ? JSON.parse(log.output) : log.output;
        console.log(`      Details: ${JSON.stringify(output, null, 8)}`);
      }
      console.log('');
    });
  }

  // 3. Check match outcomes (training data availability)
  console.log('\n🎯 Match Outcomes (Training Data):');
  const { data: outcomes, error: outcomesError } = await supabase
    .from('startup_investor_matches')
    .select('status, contacted_at, viewed_at')
    .not('status', 'eq', 'suggested')
    .limit(100);

  if (outcomesError) {
    console.log('   ❌ Error:', outcomesError.message);
  } else if (!outcomes || outcomes.length === 0) {
    console.log('   ⚠️  No match outcomes available for training');
    console.log('   ML agent needs feedback data to learn');
  } else {
    // Count outcomes by status
    const statusCounts: Record<string, number> = {};
    outcomes.forEach(m => {
      statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
    });

    console.log(`   ✅ Found ${outcomes.length} matches with outcomes:\n`);
    Object.entries(statusCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`      ${status}: ${count}`);
      });
  }

  // 4. Check if ML training is scheduled in PM2
  console.log('\n⚙️  PM2 Schedule Check:');
  console.log('   Run: pm2 list');
  console.log('   Look for: ml-training or similar process\n');

  // 5. Summary & recommendations
  console.log('\n💡 SUMMARY:\n');
  
  if (!mlRecs || mlRecs.length === 0) {
    console.log('   🔴 ML AGENT NOT GENERATING RECOMMENDATIONS');
    console.log('   \n   Possible reasons:');
    console.log('   1. ML training service never executed');
    console.log('   2. Not enough training data (match outcomes)');
    console.log('   3. Service configured but not scheduled');
    console.log('   4. Table schema mismatch\n');
    
    console.log('   📋 ACTION ITEMS:');
    console.log('   1. Check if ml-training is in ecosystem.config.js');
    console.log('   2. Run training manually: npx tsx server/services/mlTrainingService.ts');
    console.log('   3. Verify match outcomes exist (status != "suggested")');
    console.log('   4. Ensure ml_recommendations table schema is correct\n');
  } else {
    console.log('   ✅ ML AGENT IS ACTIVE');
    console.log(`   Last recommendation: ${mlRecs[0].created_at}`);
    console.log('   Review recommendations above and apply as needed\n');
  }

  console.log('=' .repeat(60));
}

checkMLAgent().catch(console.error);
