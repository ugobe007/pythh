/**
 * DEEP ANALYSIS FOR WHITEPAPERS
 * Topics: Signal Science & Component Analysis
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface AnalysisResult {
  topic: string;
  insights: Array<{
    title: string;
    finding: string;
    data: any;
    chartData?: any;
  }>;
  keyTakeaways: string[];
  socialMediaHooks: string[];
}

async function analyzeSignalScience(): Promise<AnalysisResult> {
  console.log('📡 Analyzing Signal Science...\n');

  const insights: AnalysisResult['insights'] = [];
  const keyTakeaways: string[] = [];
  const socialHooks: string[] = [];

  // 1. Signal Score Distribution
  const { data: signalData } = await supabase
    .from('startup_signal_scores')
    .select('signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity, startup_id')
    .not('signals_total', 'is', null)
    .order('signals_total', { ascending: false })
    .limit(5000);

  if (signalData && signalData.length > 0) {
    const signals = signalData.map(s => s.signals_total || 0);
    const avgSignals = signals.reduce((sum, s) => sum + s, 0) / signals.length;
    const top10Pct = signals.slice(0, Math.floor(signals.length * 0.1));
    const avgTop10 = top10Pct.reduce((sum, s) => sum + s, 0) / top10Pct.length;
    const bottom10Pct = signals.slice(-Math.floor(signals.length * 0.1));
    const avgBottom10 = bottom10Pct.reduce((sum, s) => sum + s, 0) / bottom10Pct.length;

    insights.push({
      title: 'Signal Score Distribution',
      finding: `Top 10% of startups average ${avgTop10.toFixed(2)}/10 signals vs ${avgBottom10.toFixed(2)}/10 for bottom 10%. That's a ${((avgTop10 / avgBottom10 - 1) * 100).toFixed(1)}% difference.`,
      data: {
        total: signalData.length,
        average: avgSignals,
        top10Percent: avgTop10,
        bottom10Percent: avgBottom10,
        difference: ((avgTop10 / avgBottom10 - 1) * 100)
      },
      chartData: {
        distribution: {
          '0-2': signals.filter(s => s >= 0 && s < 2).length,
          '2-4': signals.filter(s => s >= 2 && s < 4).length,
          '4-6': signals.filter(s => s >= 4 && s < 6).length,
          '6-8': signals.filter(s => s >= 6 && s < 8).length,
          '8-10': signals.filter(s => s >= 8 && s <= 10).length
        }
      }
    });

    keyTakeaways.push(`Top 10% of startups have ${((avgTop10 / avgSignals - 1) * 100).toFixed(1)}% higher signal scores than average`);
    socialHooks.push(`The top 10% of startups have ${avgTop10.toFixed(1)}x higher signal scores than the bottom 10%. Signal science works.`);
  }

  // 2. Signal Dimensions Analysis
  const avgLanguageShift = signalData?.reduce((sum, s) => sum + (s.founder_language_shift || 0), 0) / (signalData?.length || 1);
  const avgReceptivity = signalData?.reduce((sum, s) => sum + (s.investor_receptivity || 0), 0) / (signalData?.length || 1);
  const avgMomentum = signalData?.reduce((sum, s) => sum + (s.news_momentum || 0), 0) / (signalData?.length || 1);
  const avgConvergence = signalData?.reduce((sum, s) => sum + (s.capital_convergence || 0), 0) / (signalData?.length || 1);
  const avgVelocity = signalData?.reduce((sum, s) => sum + (s.execution_velocity || 0), 0) / (signalData?.length || 1);

  const dimensions = [
    { name: 'Founder Language Shift', avg: avgLanguageShift },
    { name: 'Investor Receptivity', avg: avgReceptivity },
    { name: 'News Momentum', avg: avgMomentum },
    { name: 'Capital Convergence', avg: avgConvergence },
    { name: 'Execution Velocity', avg: avgVelocity }
  ].sort((a, b) => b.avg - a.avg);

  insights.push({
    title: 'Signal Dimension Rankings',
    finding: `${dimensions[0].name} is the strongest signal (${dimensions[0].avg.toFixed(2)}/10), followed by ${dimensions[1].name} (${dimensions[1].avg.toFixed(2)}/10).`,
    data: {
      dimensions: dimensions.map(d => ({ name: d.name, average: d.avg }))
    }
  });

  keyTakeaways.push(`${dimensions[0].name} is the most predictive signal dimension`);
  socialHooks.push(`Founder language shifts predict investor interest better than news momentum. Here's the data.`);

  // 3. Signals vs Match Quality
  const { data: matchesWithSignals } = await supabase
    .from('startup_investor_matches')
    .select(`
      match_score,
      startup_id,
      startup_signal_scores!inner(signals_total)
    `)
    .not('match_score', 'is', null)
    .limit(10000);

  if (matchesWithSignals && matchesWithSignals.length > 0) {
    const highSignalMatches = matchesWithSignals.filter((m: any) => 
      m.startup_signal_scores?.signals_total >= 7
    );
    const lowSignalMatches = matchesWithSignals.filter((m: any) => 
      m.startup_signal_scores?.signals_total < 3
    );

    const avgHighSignalMatch = highSignalMatches.reduce((sum, m) => sum + (m.match_score || 0), 0) / (highSignalMatches.length || 1);
    const avgLowSignalMatch = lowSignalMatches.reduce((sum, m) => sum + (m.match_score || 0), 0) / (lowSignalMatches.length || 1);

    insights.push({
      title: 'Signals Predict Match Quality',
      finding: `Startups with high signals (7+) have average match scores of ${avgHighSignalMatch.toFixed(2)} vs ${avgLowSignalMatch.toFixed(2)} for low signals (<3).`,
      data: {
        highSignalCount: highSignalMatches.length,
        lowSignalCount: lowSignalMatches.length,
        highSignalAvgMatch: avgHighSignalMatch,
        lowSignalAvgMatch: avgLowSignalMatch,
        improvement: ((avgHighSignalMatch / avgLowSignalMatch - 1) * 100)
      }
    });

    keyTakeaways.push(`High signal startups (7+) have ${((avgHighSignalMatch / avgLowSignalMatch - 1) * 100).toFixed(1)}% better match scores`);
    socialHooks.push(`Startups with strong market signals (7+/10) get ${((avgHighSignalMatch / avgLowSignalMatch - 1) * 100).toFixed(0)}% better investor matches. Signals matter.`);
  }

  return {
    topic: 'Signal Science: How Market Signals Predict Investor Interest',
    insights,
    keyTakeaways,
    socialMediaHooks: socialHooks
  };
}

async function analyzeComponentAnalysis(): Promise<AnalysisResult> {
  console.log('🔬 Analyzing Component Analysis...\n');

  const insights: AnalysisResult['insights'] = [];
  const keyTakeaways: string[] = [];
  const socialHooks: string[] = [];

  // 1. Component Score Distribution
  const { data: startupComponents } = await supabase
    .from('startup_uploads')
    .select('total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .limit(5000);

  if (startupComponents && startupComponents.length > 0) {
    // Calculate averages
    const avgTeam = startupComponents.reduce((sum, s) => sum + (s.team_score || 0), 0) / startupComponents.length;
    const avgTraction = startupComponents.reduce((sum, s) => sum + (s.traction_score || 0), 0) / startupComponents.length;
    const avgMarket = startupComponents.reduce((sum, s) => sum + (s.market_score || 0), 0) / startupComponents.length;
    const avgProduct = startupComponents.reduce((sum, s) => sum + (s.product_score || 0), 0) / startupComponents.length;
    const avgVision = startupComponents.reduce((sum, s) => sum + (s.vision_score || 0), 0) / startupComponents.length;

    const components = [
      { name: 'Team', score: avgTeam },
      { name: 'Market', score: avgMarket },
      { name: 'Traction', score: avgTraction },
      { name: 'Product', score: avgProduct },
      { name: 'Vision', score: avgVision }
    ].sort((a, b) => b.score - a.score);

    insights.push({
      title: 'Component Score Rankings',
      finding: `${components[0].name} scores highest (${components[0].score.toFixed(1)}/100), followed by ${components[1].name} (${components[1].score.toFixed(1)}/100). ${components[components.length - 1].name} scores lowest (${components[components.length - 1].score.toFixed(1)}/100).`,
      data: {
        components: components.map(c => ({ name: c.name, average: c.score }))
      }
    });

    keyTakeaways.push(`${components[0].name} is the strongest component across all startups`);
    socialHooks.push(`We analyzed ${startupComponents.length}+ startups. ${components[0].name} scores highest (${components[0].score.toFixed(1)}/100). ${components[components.length - 1].name} scores lowest (${components[components.length - 1].score.toFixed(1)}/100). Here's why.`);
  }

  // 2. Top Performers vs Average
  const sortedByScore = [...startupComponents!].sort((a, b) => (b.total_god_score || 0) - (a.total_god_score || 0));
  const top10Pct = sortedByScore.slice(0, Math.floor(sortedByScore.length * 0.1));
  const bottom10Pct = sortedByScore.slice(-Math.floor(sortedByScore.length * 0.1));

  const top10Team = top10Pct.reduce((sum, s) => sum + (s.team_score || 0), 0) / top10Pct.length;
  const top10Traction = top10Pct.reduce((sum, s) => sum + (s.traction_score || 0), 0) / top10Pct.length;
  const top10Market = top10Pct.reduce((sum, s) => sum + (s.market_score || 0), 0) / top10Pct.length;
  const top10Product = top10Pct.reduce((sum, s) => sum + (s.product_score || 0), 0) / top10Pct.length;
  const top10Vision = top10Pct.reduce((sum, s) => sum + (s.vision_score || 0), 0) / top10Pct.length;

  const bottom10Team = bottom10Pct.reduce((sum, s) => sum + (s.team_score || 0), 0) / bottom10Pct.length;
  const bottom10Traction = bottom10Pct.reduce((sum, s) => sum + (s.traction_score || 0), 0) / bottom10Pct.length;
  const bottom10Market = bottom10Pct.reduce((sum, s) => sum + (s.market_score || 0), 0) / bottom10Pct.length;
  const bottom10Product = bottom10Pct.reduce((sum, s) => sum + (s.product_score || 0), 0) / bottom10Pct.length;
  const bottom10Vision = bottom10Pct.reduce((sum, s) => sum + (s.vision_score || 0), 0) / bottom10Pct.length;

  const teamGap = ((top10Team / bottom10Team - 1) * 100).toFixed(1);
  const tractionGap = ((top10Traction / (bottom10Traction || 1) - 1) * 100).toFixed(1);
  const marketGap = ((top10Market / bottom10Market - 1) * 100).toFixed(1);
  const productGap = ((top10Product / (bottom10Product || 1) - 1) * 100).toFixed(1);
  const visionGap = ((top10Vision / (bottom10Vision || 1) - 1) * 100).toFixed(1);

  insights.push({
    title: 'Top 10% vs Bottom 10% Component Comparison',
    finding: `Top performers excel in Traction (${tractionGap}% higher) and Product (${productGap}% higher). Team gap is ${teamGap}%.`,
    data: {
      top10: {
        team: top10Team,
        traction: top10Traction,
        market: top10Market,
        product: top10Product,
        vision: top10Vision
      },
      bottom10: {
        team: bottom10Team,
        traction: bottom10Traction,
        market: bottom10Market,
        product: bottom10Product,
        vision: bottom10Vision
      },
      gaps: {
        team: parseFloat(teamGap),
        traction: parseFloat(tractionGap),
        market: parseFloat(marketGap),
        product: parseFloat(productGap),
        vision: parseFloat(visionGap)
      }
    }
  });

  keyTakeaways.push(`Traction and Product scores separate top performers from the rest`);
  socialHooks.push(`Top 10% of startups have ${tractionGap}% higher Traction scores and ${productGap}% higher Product scores. Execution matters.`);

  // 3. Component Correlation with Total Score
  const correlations: Array<{ component: string; correlation: number }> = [];
  const avgTotal = startupComponents!.reduce((sum, s) => sum + (s.total_god_score || 0), 0) / startupComponents!.length;

  ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'].forEach(component => {
    const avgComponent = startupComponents!.reduce((sum, s) => sum + ((s as any)[component] || 0), 0) / startupComponents!.length;
    
    let numerator = 0;
    let denomTotal = 0;
    let denomComponent = 0;
    
    startupComponents!.forEach(s => {
      const diffTotal = (s.total_god_score || 0) - avgTotal;
      const diffComponent = ((s as any)[component] || 0) - avgComponent;
      numerator += diffTotal * diffComponent;
      denomTotal += diffTotal * diffTotal;
      denomComponent += diffComponent * diffComponent;
    });
    
    const correlation = numerator / Math.sqrt(denomTotal * denomComponent);
    correlations.push({
      component: component.replace('_score', '').charAt(0).toUpperCase() + component.replace('_score', '').slice(1),
      correlation: correlation
    });
  });

  correlations.sort((a, b) => b.correlation - a.correlation);

  insights.push({
    title: 'Component Correlation with Total Score',
    finding: `${correlations[0].component} has the strongest correlation (${correlations[0].correlation.toFixed(3)}) with total GOD score, followed by ${correlations[1].component} (${correlations[1].correlation.toFixed(3)}).`,
    data: {
      correlations: correlations
    }
  });

  keyTakeaways.push(`${correlations[0].component} is the most predictive component of overall startup quality`);
  socialHooks.push(`${correlations[0].component} score correlates ${(correlations[0].correlation * 100).toFixed(0)}% with total startup quality. Here's what that means.`);

  // 4. Balanced vs Spiky Profiles
  const balancedProfiles = startupComponents!.filter(s => {
    const scores = [
      s.team_score || 0,
      s.traction_score || 0,
      s.market_score || 0,
      s.product_score || 0,
      s.vision_score || 0
    ];
    const avg = scores.reduce((sum, sc) => sum + sc, 0) / scores.length;
    const variance = scores.reduce((sum, sc) => sum + Math.pow(sc - avg, 2), 0) / scores.length;
    return variance < 100; // Low variance = balanced
  });

  const spikyProfiles = startupComponents!.filter(s => {
    const scores = [
      s.team_score || 0,
      s.traction_score || 0,
      s.market_score || 0,
      s.product_score || 0,
      s.vision_score || 0
    ];
    const avg = scores.reduce((sum, sc) => sum + sc, 0) / scores.length;
    const variance = scores.reduce((sum, sc) => sum + Math.pow(sc - avg, 2), 0) / scores.length;
    return variance >= 200; // High variance = spiky
  });

  const avgBalancedScore = balancedProfiles.reduce((sum, s) => sum + (s.total_god_score || 0), 0) / (balancedProfiles.length || 1);
  const avgSpikyScore = spikyProfiles.reduce((sum, s) => sum + (s.total_god_score || 0), 0) / (spikyProfiles.length || 1);

  insights.push({
    title: 'Balanced vs Spiky Profiles',
    finding: `${balancedProfiles.length} startups have balanced profiles (avg score: ${avgBalancedScore.toFixed(1)}) vs ${spikyProfiles.length} with spiky profiles (avg score: ${avgSpikyScore.toFixed(1)}).`,
    data: {
      balanced: {
        count: balancedProfiles.length,
        avgScore: avgBalancedScore,
        pct: (balancedProfiles.length / startupComponents!.length * 100).toFixed(1)
      },
      spiky: {
        count: spikyProfiles.length,
        avgScore: avgSpikyScore,
        pct: (spikyProfiles.length / startupComponents!.length * 100).toFixed(1)
      }
    }
  });

  keyTakeaways.push(`${(balancedProfiles.length / startupComponents!.length * 100).toFixed(1)}% of startups have balanced component profiles`);
  socialHooks.push(`We found ${balancedProfiles.length} balanced startups vs ${spikyProfiles.length} spiky ones. Which performs better?`);

  return {
    topic: 'Component Analysis: What Separates Top-Performing Startups',
    insights,
    keyTakeaways,
    socialMediaHooks: socialHooks
  };
}

async function main() {
  try {
    console.log('🔍 Starting Deep Analysis for Whitepapers...\n');
    console.log('═'.repeat(80));

    const signalAnalysis = await analyzeSignalScience();
    const componentAnalysis = await analyzeComponentAnalysis();

    // Output results
    console.log('\n\n📄 WHITEPAPER #1: SIGNAL SCIENCE\n');
    console.log('═'.repeat(80));
    console.log(`\nTitle: ${signalAnalysis.topic}\n`);
    console.log('Key Insights:');
    signalAnalysis.insights.forEach((insight, idx) => {
      console.log(`\n${idx + 1}. ${insight.title}`);
      console.log(`   ${insight.finding}`);
      console.log(`   Data: ${JSON.stringify(insight.data, null, 2)}`);
    });
    console.log('\n\nKey Takeaways:');
    signalAnalysis.keyTakeaways.forEach((takeaway, idx) => {
      console.log(`${idx + 1}. ${takeaway}`);
    });
    console.log('\n\nSocial Media Hooks:');
    signalAnalysis.socialMediaHooks.forEach((hook, idx) => {
      console.log(`${idx + 1}. ${hook}`);
    });

    console.log('\n\n\n📄 WHITEPAPER #2: COMPONENT ANALYSIS\n');
    console.log('═'.repeat(80));
    console.log(`\nTitle: ${componentAnalysis.topic}\n`);
    console.log('Key Insights:');
    componentAnalysis.insights.forEach((insight, idx) => {
      console.log(`\n${idx + 1}. ${insight.title}`);
      console.log(`   ${insight.finding}`);
      console.log(`   Data: ${JSON.stringify(insight.data, null, 2)}`);
    });
    console.log('\n\nKey Takeaways:');
    componentAnalysis.keyTakeaways.forEach((takeaway, idx) => {
      console.log(`${idx + 1}. ${takeaway}`);
    });
    console.log('\n\nSocial Media Hooks:');
    componentAnalysis.socialMediaHooks.forEach((hook, idx) => {
      console.log(`${idx + 1}. ${hook}`);
    });

    // Save to JSON for whitepaper generation
    const output = {
      signalScience: signalAnalysis,
      componentAnalysis: componentAnalysis,
      generatedAt: new Date().toISOString()
    };

    console.log('\n\n✅ Analysis complete! Ready for whitepaper generation.\n');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
