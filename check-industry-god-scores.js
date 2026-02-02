#!/usr/bin/env node
/**
 * CHECK INDUSTRY GOD SCORES & INDUSTRY TIERS
 * ===========================================
 * 
 * Analyzes GOD score distribution by industry/sector to identify:
 * - Industry bias (some industries consistently scoring higher/lower)
 * - Industry tiers (which industries have best/worst startups)
 * - Goldilocks zones (ideal score ranges per industry)
 * - Score variance and differentiation per industry
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkIndustryScores() {
  console.log('═'.repeat(80));
  console.log('    📊 INDUSTRY GOD SCORE ANALYSIS');
  console.log('═'.repeat(80));
  console.log('');

  try {
    // Fetch all approved startups with GOD scores and sectors
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, sectors')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .order('total_god_score', { ascending: false });

    if (error) {
      console.error('❌ Error fetching startups:', error);
      return;
    }

    console.log(`✅ Loaded ${startups.length} startups with GOD scores\n`);

    // Build industry stats
    const industryStats = {};

    for (const startup of startups) {
      const sectors = startup.sectors || [];
      
      // Each startup can belong to multiple sectors
      for (const sector of sectors) {
        if (!sector || sector.trim() === '') continue;
        
        const normalized = sector.trim();
        
        if (!industryStats[normalized]) {
          industryStats[normalized] = {
            count: 0,
            scores: [],
            teamScores: [],
            tractionScores: [],
            marketScores: [],
            productScores: [],
            visionScores: [],
            topStartups: []
          };
        }

        industryStats[normalized].count++;
        industryStats[normalized].scores.push(startup.total_god_score);
        industryStats[normalized].teamScores.push(startup.team_score || 0);
        industryStats[normalized].tractionScores.push(startup.traction_score || 0);
        industryStats[normalized].marketScores.push(startup.market_score || 0);
        industryStats[normalized].productScores.push(startup.product_score || 0);
        industryStats[normalized].visionScores.push(startup.vision_score || 0);
        
        // Keep top 3 startups per industry
        if (industryStats[normalized].topStartups.length < 3) {
          industryStats[normalized].topStartups.push({
            name: startup.name,
            score: startup.total_god_score
          });
        }
      }
    }

    // Calculate statistics for each industry
    const industryAnalysis = Object.entries(industryStats)
      .map(([industry, data]) => {
        const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const sorted = [...data.scores].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = Math.min(...data.scores);
        const max = Math.max(...data.scores);
        
        // Standard deviation
        const variance = data.scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / data.scores.length;
        const stdDev = Math.sqrt(variance);
        
        // Component averages
        const avgTeam = data.teamScores.reduce((a, b) => a + b, 0) / data.teamScores.length;
        const avgTraction = data.tractionScores.reduce((a, b) => a + b, 0) / data.tractionScores.length;
        const avgMarket = data.marketScores.reduce((a, b) => a + b, 0) / data.marketScores.length;
        const avgProduct = data.productScores.reduce((a, b) => a + b, 0) / data.productScores.length;
        const avgVision = data.visionScores.reduce((a, b) => a + b, 0) / data.visionScores.length;
        
        // Goldilocks zone (50th to 75th percentile)
        const p50 = sorted[Math.floor(sorted.length * 0.5)];
        const p75 = sorted[Math.floor(sorted.length * 0.75)];
        const p90 = sorted[Math.floor(sorted.length * 0.9)];
        
        // Distribution
        const below40 = data.scores.filter(s => s < 40).length;
        const range40to60 = data.scores.filter(s => s >= 40 && s < 60).length;
        const range60to75 = data.scores.filter(s => s >= 60 && s < 75).length;
        const range75to85 = data.scores.filter(s => s >= 75 && s < 85).length;
        const above85 = data.scores.filter(s => s >= 85).length;

        return {
          industry,
          count: data.count,
          avg,
          median,
          min,
          max,
          stdDev,
          p50,
          p75,
          p90,
          components: {
            team: avgTeam,
            traction: avgTraction,
            market: avgMarket,
            product: avgProduct,
            vision: avgVision
          },
          distribution: {
            below40: (below40 / data.count * 100).toFixed(1),
            range40to60: (range40to60 / data.count * 100).toFixed(1),
            range60to75: (range60to75 / data.count * 100).toFixed(1),
            range75to85: (range75to85 / data.count * 100).toFixed(1),
            above85: (above85 / data.count * 100).toFixed(1)
          },
          topStartups: data.topStartups
        };
      })
      .filter(i => i.count >= 10) // Only industries with 10+ startups
      .sort((a, b) => b.avg - a.avg);

    // Display results
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                          INDUSTRY TIERS                                     │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');

    // Top 10 industries
    console.log('🏆 TOP 10 INDUSTRIES (Highest Avg GOD Score):\n');
    industryAnalysis.slice(0, 10).forEach((ind, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${ind.industry.padEnd(30)} │ Avg: ${ind.avg.toFixed(1)} │ Count: ${ind.count.toString().padStart(4)} │ StdDev: ${ind.stdDev.toFixed(1)}`);
      console.log(`    Range: ${ind.min.toFixed(1)}-${ind.max.toFixed(1)} │ Median: ${ind.median.toFixed(1)} │ P75: ${ind.p75.toFixed(1)} │ P90: ${ind.p90.toFixed(1)}`);
      console.log(`    Distribution: <40: ${ind.distribution.below40}% | 40-60: ${ind.distribution.range40to60}% | 60-75: ${ind.distribution.range60to75}% | 75-85: ${ind.distribution.range75to85}% | >85: ${ind.distribution.above85}%`);
      console.log('');
    });

    // Bottom 10 industries
    console.log('\n⚠️  BOTTOM 10 INDUSTRIES (Lowest Avg GOD Score):\n');
    industryAnalysis.slice(-10).reverse().forEach((ind, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${ind.industry.padEnd(30)} │ Avg: ${ind.avg.toFixed(1)} │ Count: ${ind.count.toString().padStart(4)} │ StdDev: ${ind.stdDev.toFixed(1)}`);
      console.log(`    Range: ${ind.min.toFixed(1)}-${ind.max.toFixed(1)} │ Median: ${ind.median.toFixed(1)} │ P75: ${ind.p75.toFixed(1)} │ P90: ${ind.p90.toFixed(1)}`);
      console.log('');
    });

    // Component analysis
    console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                    COMPONENT SCORE ANALYSIS                                 │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');

    // Find industries with strongest components
    const strongestInTeam = [...industryAnalysis].sort((a, b) => b.components.team - a.components.team).slice(0, 5);
    const strongestInTraction = [...industryAnalysis].sort((a, b) => b.components.traction - a.components.traction).slice(0, 5);
    const strongestInMarket = [...industryAnalysis].sort((a, b) => b.components.market - a.components.market).slice(0, 5);
    
    console.log('💪 Strongest Team Scores:');
    strongestInTeam.forEach((ind, i) => {
      console.log(`   ${i + 1}. ${ind.industry.padEnd(30)} ${ind.components.team.toFixed(1)}/20`);
    });

    console.log('\n📈 Strongest Traction Scores:');
    strongestInTraction.forEach((ind, i) => {
      console.log(`   ${i + 1}. ${ind.industry.padEnd(30)} ${ind.components.traction.toFixed(1)}/20`);
    });

    console.log('\n🌍 Strongest Market Scores:');
    strongestInMarket.forEach((ind, i) => {
      console.log(`   ${i + 1}. ${ind.industry.padEnd(30)} ${ind.components.market.toFixed(1)}/20`);
    });

    // Industry bias analysis
    console.log('\n\n┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                         BIAS DETECTION                                      │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');

    const globalAvg = startups.reduce((sum, s) => sum + s.total_god_score, 0) / startups.length;
    console.log(`📊 Global Average GOD Score: ${globalAvg.toFixed(2)}\n`);

    const biasedIndustries = industryAnalysis
      .filter(ind => Math.abs(ind.avg - globalAvg) > 5)
      .map(ind => ({
        ...ind,
        bias: ind.avg - globalAvg
      }))
      .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));

    console.log('⚖️  Industries with Score Bias (>5 points from global avg):\n');
    biasedIndustries.slice(0, 15).forEach(ind => {
      const direction = ind.bias > 0 ? '↑' : '↓';
      const color = ind.bias > 0 ? '' : '';
      console.log(`   ${direction} ${ind.industry.padEnd(30)} ${color}${ind.bias > 0 ? '+' : ''}${ind.bias.toFixed(1)}${color} (Avg: ${ind.avg.toFixed(1)})`);
    });

    // Save to file
    const report = {
      timestamp: new Date().toISOString(),
      globalAvg,
      totalStartups: startups.length,
      totalIndustries: industryAnalysis.length,
      topIndustries: industryAnalysis.slice(0, 10),
      bottomIndustries: industryAnalysis.slice(-10).reverse(),
      biasedIndustries: biasedIndustries.slice(0, 15),
      allIndustries: industryAnalysis
    };

    const fs = require('fs');
    fs.writeFileSync(
      'industry-god-scores-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n✅ Report saved to: industry-god-scores-report.json');

    console.log('\n' + '═'.repeat(80));

  } catch (err) {
    console.error('❌ Fatal error:', err);
  }
}

checkIndustryScores();
