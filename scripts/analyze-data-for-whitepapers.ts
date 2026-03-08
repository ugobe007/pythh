/**
 * DATA ANALYSIS FOR WHITEPAPERS
 * 
 * Analyzes startups, investors, matches, and signals to generate insights
 * for whitepapers and social media content.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface WhitepaperInsight {
  category: string;
  title: string;
  finding: string;
  data: any;
  socialMediaHook: string;
}

async function analyzeData(): Promise<WhitepaperInsight[]> {
  const insights: WhitepaperInsight[] = [];

  console.log('🔍 Analyzing data for whitepaper insights...\n');

  // ============================================================================
  // 1. STARTUP DATA ANALYSIS
  // ============================================================================
  console.log('📊 Analyzing startup data...');

  // Total startups
  const { count: totalStartups } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');

  // Score distribution
  const { data: startupScores } = await supabase
    .from('startup_uploads')
    .select('total_god_score, team_score, traction_score, market_score, product_score, vision_score, signals_bonus')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null);

  if (startupScores && startupScores.length > 0) {
    const scores = startupScores.map(s => s.total_god_score || 0);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const medianScore = [...scores].sort((a, b) => a - b)[Math.floor(scores.length / 2)];

    // Component analysis
    const avgTeam = startupScores.reduce((sum, s) => sum + (s.team_score || 0), 0) / startupScores.length;
    const avgTraction = startupScores.reduce((sum, s) => sum + (s.traction_score || 0), 0) / startupScores.length;
    const avgMarket = startupScores.reduce((sum, s) => sum + (s.market_score || 0), 0) / startupScores.length;
    const avgProduct = startupScores.reduce((sum, s) => sum + (s.product_score || 0), 0) / startupScores.length;
    const avgVision = startupScores.reduce((sum, s) => sum + (s.vision_score || 0), 0) / startupScores.length;
    const avgSignals = startupScores.reduce((sum, s) => sum + (s.signals_bonus || 0), 0) / startupScores.length;

    insights.push({
      category: 'Startup Quality',
      title: 'Average GOD Score Distribution',
      finding: `Analyzed ${totalStartups} approved startups. Average GOD score: ${avgScore.toFixed(2)}, Median: ${medianScore.toFixed(2)}`,
      data: {
        total: totalStartups,
        average: avgScore,
        median: medianScore,
        components: {
          team: avgTeam,
          traction: avgTraction,
          market: avgMarket,
          product: avgProduct,
          vision: avgVision,
          signals: avgSignals
        }
      },
      socialMediaHook: `We analyzed ${totalStartups}+ startups. The average quality score is ${avgScore.toFixed(1)}/100. Here's what separates the top performers...`
    });
  }

  // ============================================================================
  // 2. INVESTOR DATA ANALYSIS
  // ============================================================================
  console.log('👥 Analyzing investor data...');

  const { count: totalInvestors } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });

  const { data: investorScores } = await supabase
    .from('investors')
    .select('investor_score, sectors, stage, geography_focus')
    .not('investor_score', 'is', null);

  if (investorScores && investorScores.length > 0) {
    const scores = investorScores.map(i => i.investor_score || 0);
    const avgInvestorScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Sector analysis
    const sectorCounts: Record<string, number> = {};
    investorScores.forEach(inv => {
      if (inv.sectors && Array.isArray(inv.sectors)) {
        inv.sectors.forEach((sector: string) => {
          sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
        });
      }
    });
    const topSectors = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    insights.push({
      category: 'Investor Landscape',
      title: 'Investor Quality & Focus',
      finding: `Analyzed ${totalInvestors} investors. Average investor score: ${avgInvestorScore.toFixed(2)}/10. Top sectors: ${topSectors.map(s => s[0]).join(', ')}`,
      data: {
        total: totalInvestors,
        averageScore: avgInvestorScore,
        topSectors
      },
      socialMediaHook: `We mapped ${totalInvestors}+ investors. The average quality score is ${avgInvestorScore.toFixed(1)}/10. The most active sectors are...`
    });
  }

  // ============================================================================
  // 3. MATCH ANALYSIS
  // ============================================================================
  console.log('🎯 Analyzing match data...');

  const { count: totalMatches } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true });

  const { data: matchScores } = await supabase
    .from('startup_investor_matches')
    .select('match_score, fit_score, timing_score')
    .not('match_score', 'is', null)
    .limit(10000);

  if (matchScores && matchScores.length > 0) {
    const avgMatchScore = matchScores.reduce((sum, m) => sum + (m.match_score || 0), 0) / matchScores.length;
    const avgFitScore = matchScores.reduce((sum, m) => sum + (m.fit_score || 0), 0) / matchScores.length;
    const avgTimingScore = matchScores.reduce((sum, m) => sum + (m.timing_score || 0), 0) / matchScores.length;

    // High-quality matches
    const highQualityMatches = matchScores.filter(m => (m.match_score || 0) >= 80).length;
    const highQualityPct = (highQualityMatches / matchScores.length * 100).toFixed(1);

    insights.push({
      category: 'Match Quality',
      title: 'Startup-Investor Match Distribution',
      finding: `Analyzed ${totalMatches} matches. Average match score: ${avgMatchScore.toFixed(2)}. ${highQualityPct}% are high-quality matches (80+).`,
      data: {
        total: totalMatches,
        averageMatch: avgMatchScore,
        averageFit: avgFitScore,
        averageTiming: avgTimingScore,
        highQualityCount: highQualityMatches,
        highQualityPct: parseFloat(highQualityPct)
      },
      socialMediaHook: `We analyzed ${totalMatches}+ startup-investor matches. Only ${highQualityPct}% are truly high-quality (80+ score). Here's what makes them different...`
    });
  }

  // ============================================================================
  // 4. SIGNAL ANALYSIS
  // ============================================================================
  console.log('📡 Analyzing signal data...');

  const { data: signalScores } = await supabase
    .from('startup_signal_scores')
    .select('signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity')
    .not('signals_total', 'is', null)
    .limit(5000);

  if (signalScores && signalScores.length > 0) {
    const avgSignals = signalScores.reduce((sum, s) => sum + (s.signals_total || 0), 0) / signalScores.length;
    const avgLanguageShift = signalScores.reduce((sum, s) => sum + (s.founder_language_shift || 0), 0) / signalScores.length;
    const avgReceptivity = signalScores.reduce((sum, s) => sum + (s.investor_receptivity || 0), 0) / signalScores.length;
    const avgMomentum = signalScores.reduce((sum, s) => sum + (s.news_momentum || 0), 0) / signalScores.length;
    const avgConvergence = signalScores.reduce((sum, s) => sum + (s.capital_convergence || 0), 0) / signalScores.length;
    const avgVelocity = signalScores.reduce((sum, s) => sum + (s.execution_velocity || 0), 0) / signalScores.length;

    insights.push({
      category: 'Market Signals',
      title: 'Signal Score Distribution',
      finding: `Analyzed ${signalScores.length} startups with signal data. Average total signals: ${avgSignals.toFixed(2)}/10.`,
      data: {
        total: signalScores.length,
        averageTotal: avgSignals,
        dimensions: {
          languageShift: avgLanguageShift,
          receptivity: avgReceptivity,
          momentum: avgMomentum,
          convergence: avgConvergence,
          velocity: avgVelocity
        }
      },
      socialMediaHook: `We tracked market signals across ${signalScores.length}+ startups. The average signal score is ${avgSignals.toFixed(1)}/10. Here's what the data reveals about market timing...`
    });
  }

  // ============================================================================
  // 5. CORRELATION ANALYSIS
  // ============================================================================
  console.log('🔗 Analyzing correlations...');

  // Get startups with both GOD scores and match data
  const { data: correlationData } = await supabase
    .from('startup_uploads')
    .select(`
      id,
      total_god_score,
      startup_investor_matches!inner(match_score, fit_score)
    `)
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .limit(1000);

  if (correlationData && correlationData.length > 0) {
    const correlations: Array<{ godScore: number; matchScore: number }> = [];
    correlationData.forEach(startup => {
      const godScore = startup.total_god_score || 0;
      if (startup.startup_investor_matches && Array.isArray(startup.startup_investor_matches)) {
        startup.startup_investor_matches.forEach((match: any) => {
          correlations.push({
            godScore,
            matchScore: match.match_score || 0
          });
        });
      }
    });

    if (correlations.length > 0) {
      // Calculate correlation coefficient
      const avgGod = correlations.reduce((sum, c) => sum + c.godScore, 0) / correlations.length;
      const avgMatch = correlations.reduce((sum, c) => sum + c.matchScore, 0) / correlations.length;
      
      let numerator = 0;
      let denomGod = 0;
      let denomMatch = 0;
      
      correlations.forEach(c => {
        const diffGod = c.godScore - avgGod;
        const diffMatch = c.matchScore - avgMatch;
        numerator += diffGod * diffMatch;
        denomGod += diffGod * diffGod;
        denomMatch += diffMatch * diffMatch;
      });
      
      const correlation = numerator / Math.sqrt(denomGod * denomMatch);

      insights.push({
        category: 'Correlation',
        title: 'GOD Score vs Match Quality',
        finding: `Analyzed ${correlations.length} matches. Correlation between GOD score and match quality: ${correlation.toFixed(3)}`,
        data: {
          sampleSize: correlations.length,
          correlation: correlation,
          interpretation: correlation > 0.7 ? 'Strong positive correlation' : correlation > 0.4 ? 'Moderate correlation' : 'Weak correlation'
        },
        socialMediaHook: `Does startup quality predict investor match quality? We analyzed ${correlations.length} matches. The correlation is ${correlation.toFixed(2)}. Here's what it means...`
      });
    }
  }

  return insights;
}

async function main() {
  try {
    const insights = await analyzeData();
    
    console.log('\n📄 WHITEPAPER INSIGHTS SUMMARY\n');
    console.log('═'.repeat(80));
    
    insights.forEach((insight, idx) => {
      console.log(`\n${idx + 1}. ${insight.category}: ${insight.title}`);
      console.log(`   Finding: ${insight.finding}`);
      console.log(`   Social Hook: ${insight.socialMediaHook}`);
      console.log(`   Data: ${JSON.stringify(insight.data, null, 2)}`);
    });
    
    console.log('\n\n📊 RECOMMENDED WHITEPAPER TOPICS:\n');
    
    const topics = [
      'The 50-59 Score Gap: Why Most Startups Fall in the "Good But Not Great" Range',
      'Signal Science: How Market Signals Predict Investor Interest',
      'The Match Quality Paradox: Why High-Quality Startups Don\'t Always Get Matched',
      'Component Analysis: What Separates Top-Performing Startups',
      'Investor Landscape: Sector Focus and Quality Distribution',
      'Timing Matters: The Role of Market Signals in Fundraising Success'
    ];
    
    topics.forEach((topic, idx) => {
      console.log(`${idx + 1}. ${topic}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
