#!/usr/bin/env node
/**
 * CHECK BACKFILL STATUS
 * =====================
 * Analyze current state of signal cascade and inference enrichment
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkStatus() {
  console.log('🔍 Checking backfill status...\n');

  try {
    // 1. Count approved startups
    const { count: approvedCount } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    console.log(`📊 Approved startups: ${approvedCount}`);

    // 2. Count signals
    const { count: signalCount } = await supabase
      .from('startup_signals')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Total signals: ${signalCount}`);
    console.log(`📊 Avg signals/startup: ${(signalCount / approvedCount).toFixed(1)}`);

    // 3. Check extracted_data coverage
    const { data: sampleStartups } = await supabase
      .from('startup_uploads')
      .select('id, name, extracted_data')
      .eq('status', 'approved')
      .limit(100);

    const withRichData = sampleStartups.filter(s => {
      if (!s.extracted_data) return false;
      const keys = Object.keys(s.extracted_data);
      // Has at least 3 of: traction, team, market, product data
      const hasData = keys.some(k => ['revenue', 'mrr', 'customers', 'active_users', 'growth_rate'].includes(k)) ||
                     keys.some(k => ['team_companies', 'founders_count', 'technical_cofounders'].includes(k)) ||
                     keys.some(k => ['market_size', 'problem', 'solution'].includes(k)) ||
                     keys.some(k => ['is_launched', 'has_demo', 'mvp_stage'].includes(k));
      return hasData && keys.length > 3;
    });

    const withSomeData = sampleStartups.filter(s => {
      if (!s.extracted_data) return false;
      return Object.keys(s.extracted_data).length > 0;
    });

    const withoutData = sampleStartups.filter(s => !s.extracted_data || Object.keys(s.extracted_data).length === 0);

    console.log(`\n📊 Extracted Data Coverage (sample of 100):`);
    console.log(`   Rich data (3+ fields): ${withRichData.length}%`);
    console.log(`   Some data: ${withSomeData.length}%`);
    console.log(`   No data: ${withoutData.length}%`);

    // 4. Estimate what's needed
    const estimatedMissingSignals = approvedCount - (signalCount / 10); // Assuming target of 10 signals/startup
    const estimatedMissingEnrichment = approvedCount * (withoutData.length / 100);

    console.log(`\n🎯 Backfill Estimates:`);
    console.log(`   Startups needing signals: ~${Math.max(0, Math.round(estimatedMissingSignals))}`);
    console.log(`   Startups needing inference: ~${Math.round(estimatedMissingEnrichment)}`);

    // 5. Check unique startups with signals
    const { data: uniqueStartupsWithSignals } = await supabase
      .from('startup_signals')
      .select('startup_id')
      .limit(10000);

    const uniqueStartupIds = new Set(uniqueStartupsWithSignals.map(s => s.startup_id));
    const signalCoverage = (uniqueStartupIds.size / approvedCount * 100).toFixed(1);

    console.log(`   Startups with ANY signals: ${uniqueStartupIds.size} (${signalCoverage}%)`);
    console.log(`   Startups WITHOUT signals: ${approvedCount - uniqueStartupIds.size}`);

    // 6. Example data
    if (withRichData.length > 0) {
      console.log(`\n✅ Example startup with rich data:`);
      console.log(`   Name: ${withRichData[0].name}`);
      console.log(`   Data:`, JSON.stringify(withRichData[0].extracted_data, null, 2).substring(0, 400));
    }

    if (withoutData.length > 0) {
      console.log(`\n❌ Example startup without data:`);
      console.log(`   Name: ${withoutData[0].name}`);
      console.log(`   Data:`, withoutData[0].extracted_data);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 RECOMMENDATION:');
    console.log('='.repeat(60));
    
    if (signalCoverage < 50) {
      console.log('1. ⚠️  LOW SIGNAL COVERAGE - Run signal cascade backfill first');
      console.log('   Command: node scripts/backfill-startup-signals.js');
    } else {
      console.log('1. ✅ Signal coverage is good');
    }

    if (withoutData.length > 50) {
      console.log('2. ⚠️  MISSING ENRICHMENT DATA - Run inference enrichment');
      console.log('   Command: npx tsx scripts/enrich-startups-inference.ts --all');
    } else {
      console.log('2. ✅ Enrichment coverage is good');
    }

    console.log('3. 🔄 After backfilling, recalculate GOD scores');
    console.log('   Command: npx tsx scripts/recalculate-scores.ts');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkStatus();
