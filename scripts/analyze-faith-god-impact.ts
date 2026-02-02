#!/usr/bin/env node
/**
 * Analyze how faith signals SHOULD affect GOD scoring
 * Shows potential market_score boosts based on VC consensus
 */

import { config } from 'dotenv';
config({ path: '.env.bak' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function analyzeFaithImpactOnGOD() {
  console.log('\n🎯 Faith Signals → GOD Score Impact Analysis\n');

  // Get faith signal trends
  const { data: signals } = await supabase
    .from('vc_faith_signals')
    .select('*');

  if (!signals || signals.length === 0) {
    console.log('No faith signals yet.');
    return;
  }

  // Calculate theme momentum (weighted by conviction)
  const themeMomentum: Record<string, { count: number; totalConviction: number }> = {};

  signals.forEach(sig => {
    if (sig.categories && Array.isArray(sig.categories)) {
      sig.categories.forEach((cat: string) => {
        const theme = cat.toLowerCase();
        themeMomentum[theme] = themeMomentum[theme] || { count: 0, totalConviction: 0 };
        themeMomentum[theme].count++;
        themeMomentum[theme].totalConviction += (sig.conviction || 0.7);
      });
    }
  });

  // Calculate momentum score (frequency × avg conviction)
  const themeScores = Object.entries(themeMomentum)
    .map(([theme, data]) => ({
      theme,
      count: data.count,
      avgConviction: data.totalConviction / data.count,
      momentum: (data.count / signals.length) * (data.totalConviction / data.count)
    }))
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, 15);

  console.log('📈 VC Consensus Themes (sorted by momentum):\n');
  console.log('Theme'.padEnd(30) + ' Mentions  Avg Conviction  Momentum Score');
  console.log('-'.repeat(75));
  
  themeScores.forEach(t => {
    const momentumBar = '█'.repeat(Math.round(t.momentum * 100));
    console.log(
      `${t.theme.padEnd(30)} ${t.count.toString().padStart(4)}      ${t.avgConviction.toFixed(2)}           ${t.momentum.toFixed(3)} ${momentumBar}`
    );
  });

  // Calculate proposed market_score boost
  const marketBoostTable = themeScores.map(t => ({
    theme: t.theme,
    momentum: t.momentum,
    proposedBoost: Math.min(15, Math.round(t.momentum * 150)) // Cap at +15 points
  }));

  console.log('\n💰 Proposed Market Component Boost (illustrative, applied to market_score only):\n');
  console.log('Theme'.padEnd(30) + ' Base Market  →  Boosted Market  (+Points)');
  console.log('-'.repeat(75));

  marketBoostTable.forEach(t => {
    const baseMarket = 60; // Illustrative baseline for display
    const boosted = Math.min(100, baseMarket + t.proposedBoost);
    console.log(
      `${t.theme.padEnd(30)} ${baseMarket}       →  ${boosted}               (+${t.proposedBoost})`
    );
  });

  // Sample startups that would benefit
  console.log('\n🚀 Startups That Would Get Boosted:\n');

  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('id, name, description, sectors, total_god_score, market_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(100);

  if (startups) {
    const topThemes = themeScores.slice(0, 5).map(t => t.theme);
    const boostMap = new Map<string, number>();
    marketBoostTable.forEach(t => boostMap.set(t.theme, t.proposedBoost));

    const boostedStartups = startups
      .map(s => {
        const desc = (s.description || '').toLowerCase();
        const sectors = (s.sectors || []).map((sec: string) => sec.toLowerCase());
        
        let maxBoost = 0;
        let matchedTheme = '';

        topThemes.forEach(theme => {
          if (desc.includes(theme) || sectors.some((sec: string) => sec.includes(theme))) {
            const boost = boostMap.get(theme) || 0;
            if (boost > maxBoost) {
              maxBoost = boost;
              matchedTheme = theme;
            }
          }
        });

        const baseTotal = Number(s.total_god_score || 0);
        const baseMarketScore = Number(s.market_score || 0);
        const boostedMarketScore = Math.min(100, baseMarketScore + maxBoost);
        // Apply boost only to market_score component, then cap total at 100
        const newTotal = Math.min(100, baseTotal - baseMarketScore + boostedMarketScore);

        return {
          ...s,
          matchedTheme,
          marketBoost: maxBoost,
          newGodScore: newTotal
        };
      })
      .filter(s => s.marketBoost > 0)
      .sort((a, b) => b.newGodScore - a.newGodScore)
      .slice(0, 10);

    console.log('Startup'.padEnd(30) + ' Theme        Old GOD  →  New GOD  (Boost)');
    console.log('-'.repeat(80));

    boostedStartups.forEach(s => {
      console.log(
        `${s.name.substring(0, 28).padEnd(30)} ${s.matchedTheme.substring(0, 11).padEnd(13)} ${String(s.total_god_score ?? 0).padStart(2)}       →  ${String(s.newGodScore).padStart(2)}        (+${s.marketBoost})`
      );
    });

    // Impact statistics
    const avgBoost = boostedStartups.reduce((sum, s) => sum + s.marketBoost, 0) / boostedStartups.length;
    const startupsWith70Plus = boostedStartups.filter(s => s.newGodScore >= 70).length;

    console.log('\n📊 Impact Summary:\n');
    console.log(`   Startups boosted: ${boostedStartups.length} / ${startups.length} (${((boostedStartups.length / startups.length) * 100).toFixed(1)}%)`);
    console.log(`   Average boost: +${avgBoost.toFixed(1)} points`);
    console.log(`   Startups reaching "elite" (≥70): ${startupsWith70Plus}`);
    console.log(`   Top boosted theme: ${topThemes[0]} (+${boostMap.get(topThemes[0])} pts)`);
  }

  console.log('\n💡 Implementation Strategy:\n');
  console.log('   1. Calculate theme momentum from faith signals (weekly refresh)');
  console.log('   2. Add market_timing_boost to market_score component');
  console.log('   3. Cap boost at +15 points (prevents over-inflation)');
  console.log('   4. Decay boost over time (themes lose momentum)');
  console.log('   5. Require minimum VC consensus (≥10 mentions)');
  console.log('\n   Formula: market_score_new = market_score_base + (theme_momentum × 150, capped at 15)');
  console.log('   Result: Startups in hot themes get 10-15pt GOD score boost\n');
}

analyzeFaithImpactOnGOD().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
