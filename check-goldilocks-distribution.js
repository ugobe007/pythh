#!/usr/bin/env node
/**
 * CHECK GOLDILOCKS DISTRIBUTION
 * ==============================
 * 
 * Analyzes the "Goldilocks zone" - the ideal GOD score distribution.
 * 
 * The perfect distribution should be:
 * - Differentiated (not clustered)
 * - Bell curve centered around 60-65
 * - Elite tier (85+) exists but is rare (<1%)
 * - No basement tier (<40) due to database trigger
 * - Smooth gradient from good to great
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkGoldilocksDistribution() {
  console.log('═'.repeat(80));
  console.log('    🌟 GOLDILOCKS DISTRIBUTION ANALYSIS');
  console.log('═'.repeat(80));
  console.log('');

  try {
    // Fetch all approved startups with GOD scores
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, sectors, stage')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .order('total_god_score', { ascending: false });

    if (error) {
      console.error('❌ Error fetching startups:', error);
      return;
    }

    const scores = startups.map(s => s.total_god_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    // Calculate standard deviation
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Percentiles
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p50 = median;
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    console.log(`✅ Loaded ${startups.length} startups with GOD scores\n`);

    // Overall statistics
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                     OVERALL SCORE DISTRIBUTION                              │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');

    console.log(`📊 Mean:   ${avg.toFixed(2)}`);
    console.log(`📊 Median: ${median.toFixed(2)}`);
    console.log(`📊 StdDev: ${stdDev.toFixed(2)}`);
    console.log(`📊 Range:  ${min.toFixed(1)} - ${max.toFixed(1)}\n`);

    console.log('📈 Percentiles:');
    console.log(`   P10: ${p10.toFixed(1)} | P25: ${p25.toFixed(1)} | P50: ${p50.toFixed(1)} | P75: ${p75.toFixed(1)} | P90: ${p90.toFixed(1)} | P95: ${p95.toFixed(1)} | P99: ${p99.toFixed(1)}\n`);

    // Distribution buckets
    const buckets = [
      { range: '<40', min: 0, max: 40, color: '🔴' },
      { range: '40-50', min: 40, max: 50, color: '🟠' },
      { range: '50-60', min: 50, max: 60, color: '🟡' },
      { range: '60-70', min: 60, max: 70, color: '🟢' },
      { range: '70-80', min: 70, max: 80, color: '🔵' },
      { range: '80-85', min: 80, max: 85, color: '🟣' },
      { range: '85-90', min: 85, max: 90, color: '⭐' },
      { range: '90+', min: 90, max: 100, color: '🏆' }
    ];

    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                          SCORE BUCKETS                                      │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');

    buckets.forEach(bucket => {
      const count = scores.filter(s => s >= bucket.min && s < bucket.max).length;
      const pct = (count / scores.length * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(pct / 2));
      console.log(`${bucket.color} ${bucket.range.padEnd(8)} │ ${count.toString().padStart(5)} (${pct.toString().padStart(5)}%) ${bar}`);
    });

    // Goldilocks zone analysis
    console.log('\n\n┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                        GOLDILOCKS ZONE ANALYSIS                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');

    const goldilockZone = scores.filter(s => s >= 60 && s <= 75);
    const goldilockPct = (goldilockZone.length / scores.length * 100).toFixed(1);

    console.log('🎯 Goldilocks Zone (60-75 points):');
    console.log(`   Count: ${goldilockZone.length}`);
    console.log(`   Percentage: ${goldilockPct}%`);
    console.log(`   ${goldilockPct > 30 ? '✅' : '⚠️ '} Optimal range: 30-40% (current: ${goldilockPct}%)\n`);

    // Elite tier
    const eliteTier = scores.filter(s => s >= 85);
    const elitePct = (eliteTier.length / scores.length * 100).toFixed(2);

    console.log('⭐ Elite Tier (85+ points):');
    console.log(`   Count: ${eliteTier.length}`);
    console.log(`   Percentage: ${elitePct}%`);
    console.log(`   ${elitePct < 2 && elitePct > 0.1 ? '✅' : '⚠️ '} Target: 0.5-2% (current: ${elitePct}%)\n`);

    if (eliteTier.length > 0) {
      const eliteStartups = startups.filter(s => s.total_god_score >= 85).slice(0, 10);
      console.log('   Top Elite Startups:');
      eliteStartups.forEach((s, i) => {
        console.log(`   ${(i + 1).toString().padStart(2)}. ${s.name.padEnd(30)} ${s.total_god_score.toFixed(1)}`);
      });
    }

    // Low performers
    const lowPerformers = scores.filter(s => s < 40);
    const lowPct = (lowPerformers.length / scores.length * 100).toFixed(1);

    console.log(`\n🔴 Low Performers (<40 points):`);
    console.log(`   Count: ${lowPerformers.length}`);
    console.log(`   Percentage: ${lowPct}%`);
    console.log(`   ${lowPct === '0.0' ? '✅' : '⚠️ '} Target: 0% (database trigger prevents <40)\n`);

    // Distribution health check
    console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                         HEALTH CHECK                                        │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');

    const checks = [
      {
        name: 'Mean in target range (55-65)',
        pass: avg >= 55 && avg <= 65,
        value: avg.toFixed(1)
      },
      {
        name: 'Standard deviation (8-15)',
        pass: stdDev >= 8 && stdDev <= 15,
        value: stdDev.toFixed(1)
      },
      {
        name: 'Goldilocks zone (30-40%)',
        pass: goldilockPct >= 30 && goldilockPct <= 40,
        value: `${goldilockPct}%`
      },
      {
        name: 'Elite tier exists (0.5-2%)',
        pass: elitePct >= 0.5 && elitePct <= 2,
        value: `${elitePct}%`
      },
      {
        name: 'No basement tier (<40)',
        pass: lowPct === '0.0',
        value: `${lowPct}%`
      },
      {
        name: 'Good spread (max-min > 30)',
        pass: (max - min) > 30,
        value: (max - min).toFixed(1)
      }
    ];

    checks.forEach(check => {
      const icon = check.pass ? '✅' : '⚠️ ';
      console.log(`${icon} ${check.name.padEnd(40)} ${check.value}`);
    });

    const passedChecks = checks.filter(c => c.pass).length;
    const healthScore = (passedChecks / checks.length * 100).toFixed(0);

    console.log(`\n🎯 Distribution Health Score: ${healthScore}% (${passedChecks}/${checks.length} checks passed)`);

    // Component differentiation
    console.log('\n\n┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                    COMPONENT DIFFERENTIATION                                │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');

    const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
    components.forEach(comp => {
      const values = startups.map(s => s[comp] || 0).filter(v => v > 0);
      if (values.length === 0) return;
      
      const compAvg = values.reduce((a, b) => a + b, 0) / values.length;
      const compVariance = values.reduce((sum, v) => sum + Math.pow(v - compAvg, 2), 0) / values.length;
      const compStdDev = Math.sqrt(compVariance);
      const compMin = Math.min(...values);
      const compMax = Math.max(...values);
      
      const label = comp.replace('_score', '').toUpperCase();
      console.log(`${label.padEnd(12)} │ Avg: ${compAvg.toFixed(1)} │ StdDev: ${compStdDev.toFixed(1)} │ Range: ${compMin.toFixed(1)}-${compMax.toFixed(1)}`);
    });

    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      overall: {
        count: startups.length,
        mean: avg,
        median,
        stdDev,
        min,
        max
      },
      percentiles: { p10, p25, p50, p75, p90, p95, p99 },
      buckets: buckets.map(b => ({
        range: b.range,
        count: scores.filter(s => s >= b.min && s < b.max).length,
        percentage: (scores.filter(s => s >= b.min && s < b.max).length / scores.length * 100).toFixed(1)
      })),
      goldilocks: {
        count: goldilockZone.length,
        percentage: goldilockPct
      },
      elite: {
        count: eliteTier.length,
        percentage: elitePct
      },
      healthScore: parseInt(healthScore),
      checks
    };

    const fs = require('fs');
    fs.writeFileSync(
      'goldilocks-distribution-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n✅ Report saved to: goldilocks-distribution-report.json');
    console.log('\n' + '═'.repeat(80));

  } catch (err) {
    console.error('❌ Fatal error:', err);
  }
}

checkGoldilocksDistribution();
